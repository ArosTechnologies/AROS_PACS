"""
Raditech PACS/RIS API Client.

Encapsulates all interactions with the Raditech API for patient management,
study scheduling, and image retrieval. Handles JWT authentication with
automatic token refresh.
"""
import logging
import time
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class RaditechClient:
    """Singleton-style client for the Raditech PACS/RIS API."""

    def __init__(self):
        self.base_url = settings.RADITECH_API_URL
        self.key = settings.RADITECH_KEY
        self.email = settings.RADITECH_EMAIL
        self.password = settings.RADITECH_PASSWORD
        self.org_id = settings.RADITECH_ORG_ID
        self.study_source_id = settings.RADITECH_STUDY_SOURCE_ID
        self.hospital_aet = settings.RADITECH_HOSPITAL_AET
        self.rsp = settings.RADITECH_RSP

        self._access_token = None
        self._refresh_token = None
        self._token_expiry = 0  # Unix timestamp when token expires

    # ── Authentication ──────────────────────────────────────────────

    def _ensure_auth(self):
        """Ensure we have a valid access token, refreshing if needed."""
        if self._access_token and time.time() < self._token_expiry:
            return
        self.start_session()

    def start_session(self):
        """
        Authenticate with Raditech and obtain JWT tokens.
        POST /externalehr/startsession
        """
        url = f"{self.base_url}/externalehr/startsession"
        payload = {
            "Key": self.key,
            "Email": self.email,
            "Password": self.password,
            "OrgId": self.org_id,
        }

        resp = self._raw_post(url, payload, auth=False)

        self._access_token = resp.get("AccessToken")
        self._refresh_token = resp.get("RefreshToken")
        # ExpiresIn is in minutes; add a 1-minute safety margin
        expires_in_seconds = (resp.get("ExpiresIn", 15) - 1) * 60
        self._token_expiry = time.time() + expires_in_seconds

        logger.info(
            "Raditech session started. User: %s, Permissions: %s",
            resp.get("UserName"),
            resp.get("Permissions"),
        )
        return resp

    # ── Modalities & Procedures ─────────────────────────────────────

    def get_modalities(self):
        """
        Fetch available modalities for the configured study source.
        POST /schedulemaster/modalities
        """
        url = f"{self.base_url}/schedulemaster/modalities"
        payload = {"ssid": self.study_source_id}
        resp = self._post(url, payload)
        return resp.get("data", [])

    def get_procedures(self, modality_id):
        """
        Fetch procedures available for a specific modality.
        POST /masters/getprocedureformodality
        """
        url = f"{self.base_url}/masters/getprocedureformodality"
        payload = {"id": modality_id}
        return self._post(url, payload)

    # ── Patient Management ──────────────────────────────────────────

    def add_patient(self, patient):
        """
        Register a patient in the Raditech system.
        POST /scheduler/addpatient

        Args:
            patient: A Patient model instance.

        Returns:
            dict with the full Raditech response including _id and MRNumber.
        """
        url = f"{self.base_url}/scheduler/addpatient"

        # Map gender
        gender_map = {"M": "M", "F": "F", "O": "O"}
        gender = gender_map.get(patient.gender, "O")

        # Generate a unique MRN if the patient doesn't have one
        mrn = patient.mrn or f"RX-{patient.id_patient}"

        payload = {
            "StudySourceId": self.study_source_id,
            "Salutation": "Sra" if gender == "F" else "Sr",
            "MRNumber": mrn,
            "FirstName": patient.first_name,
            "LastName": patient.last_name,
            "Gender": gender,
            "DOB": "2000-01-01T00:00:00",
            "Age": 25,
            "AgeDuration": "Year",
            "Email": "",
            "Phone": "",
            "Address1": "",
            "Address2": "",
            "Country": "",
            "State": "",
            "City": "",
            "Remarks": "",
        }

        resp = self._post(url, payload)

        if resp.get("Success"):
            patient_data = resp.get("resp", {})
            logger.info(
                "Patient registered in Raditech: %s (ID: %s, MRN: %s)",
                f"{patient.first_name} {patient.last_name}",
                patient_data.get("_id"),
                patient_data.get("MRNumber"),
            )
            return patient_data
        else:
            raise RaditechAPIError(f"Failed to add patient: {resp}")

    # ── Visit / Procedure Scheduling ────────────────────────────────

    def add_visit_procedure(
        self, patient, procedure_id, modality_id, clinical_history, scan_day, scan_slot="09:00"
    ):
        """
        Schedule a visit procedure for a patient on Raditech.
        POST /scheduler/addvisitprocedure

        Args:
            patient: Patient model instance (must have raditech_patient_id and mrn).
            procedure_id: Raditech procedure ID string.
            modality_id: Raditech modality station ID string.
            clinical_history: Clinical notes/diagnosis string.
            scan_day: Date string in YYYY-MM-DD format.
            scan_slot: Time string like "09:00".

        Returns:
            dict with the full Raditech response including _id, AccessionNumber, etc.
        """
        url = f"{self.base_url}/scheduler/addvisitprocedure"

        gender_map = {"M": "M", "F": "F", "O": "O"}

        payload = {
            "PatientId": patient.raditech_patient_id,
            "PatientName": f"{patient.first_name} {patient.last_name}",
            "PatientMRN": patient.mrn,
            "PatientGender": gender_map.get(patient.gender, "O"),
            "ProcedureId": procedure_id,
            "StudySourceId": self.study_source_id,
            "ModalityStationId": modality_id,
            "ClinicalHistory": clinical_history,
            "ScanDay": scan_day,
            "ScanSlot": scan_slot,
        }

        resp = self._post(url, payload)

        if resp.get("Success"):
            visit_data = resp.get("resp", {})
            accession = None
            investigations = visit_data.get("Investigations", [])
            if investigations:
                accession = investigations[0].get("AccessionNumber")

            logger.info(
                "Visit scheduled in Raditech: Visit ID=%s, Accession=%s",
                visit_data.get("_id"),
                accession,
            )
            return visit_data
        else:
            raise RaditechAPIError(f"Failed to schedule visit: {resp}")

    # ── Reports / Image Retrieval ───────────────────────────────────

    def get_reports(self, patient_mrn):
        """
        Fetch reports/images for a patient from Raditech.
        POST /externalehr/getreports

        This endpoint does NOT require Authorization header — it uses
        the Key for auth directly in the payload.

        Args:
            patient_mrn: The patient's Medical Record Number.

        Returns:
            list of report dicts, each containing 'sharedurl', 'modality', etc.
        """
        url = f"{self.base_url}/externalehr/getreports"
        payload = {
            "Key": self.key,
            "RSP": self.rsp,
            "HospitalAET": self.hospital_aet,
            "PatientMRN": patient_mrn,
        }

        # This endpoint uses Key auth, not Bearer token
        resp = self._raw_post(url, payload, auth=False)

        # Response is a list (not wrapped in {"Success": ...})
        if isinstance(resp, list):
            logger.info("Found %d reports for MRN=%s", len(resp), patient_mrn)
            return resp
        else:
            logger.warning("Unexpected getreports response for MRN=%s: %s", patient_mrn, resp)
            return []

    # ── Internal HTTP helpers ───────────────────────────────────────

    def _post(self, url, payload):
        """Authenticated POST request with automatic token refresh."""
        self._ensure_auth()
        return self._raw_post(url, payload, auth=True)

    def _raw_post(self, url, payload, auth=True):
        """
        Execute a POST request against the Raditech API.

        Args:
            url: Full endpoint URL.
            payload: Dict to send as JSON body.
            auth: Whether to include Authorization header.

        Returns:
            Parsed JSON response.

        Raises:
            RaditechAPIError on HTTP or connection errors.
        """
        headers = {"Content-Type": "application/json"}
        if auth and self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            logger.error("Raditech HTTP error %s: %s", url, e)
            raise RaditechAPIError(f"HTTP {response.status_code}: {response.text}") from e
        except requests.exceptions.ConnectionError as e:
            logger.error("Raditech connection error %s: %s", url, e)
            raise RaditechAPIError(f"Connection error: {e}") from e
        except requests.exceptions.Timeout as e:
            logger.error("Raditech timeout %s: %s", url, e)
            raise RaditechAPIError(f"Request timeout: {e}") from e
        except Exception as e:
            logger.error("Raditech unexpected error %s: %s", url, e)
            raise RaditechAPIError(f"Unexpected error: {e}") from e


class RaditechAPIError(Exception):
    """Raised when a Raditech API call fails."""
    pass


# Module-level singleton instance
_client_instance = None


def get_raditech_client():
    """Get or create the shared RaditechClient instance."""
    global _client_instance
    if _client_instance is None:
        _client_instance = RaditechClient()
    return _client_instance
