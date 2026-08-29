import hmac
import hashlib
import json
from django.conf import settings
from django.http import JsonResponse
from rest_framework.views import APIView
from clinical_data.models import Study

class OrthancWebhookView(APIView):
    """
    Receives webhooks from the local Orthanc instance when new studies arrive (OnStableStudy event).
    Validates HMAC signature using X-Orthanc-Webhook-Signature header.
    """
    permission_classes = [] # Uses HMAC instead of JWT

    def post(self, request):
        signature = request.headers.get("X-Orthanc-Webhook-Signature")
        
        if not signature:
            return JsonResponse({"error": "Missing signature"}, status=401)
            
        # Verify HMAC against local secret
        orthanc_secret = getattr(settings, 'ORTHANC_WEBHOOK_SECRET', 'local-orthanc-secret')
        
        expected_signature = hmac.new(
            orthanc_secret.encode('utf-8'),
            request.body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_signature, signature):
            return JsonResponse({"error": "Invalid signature"}, status=401)
            
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
            
        # Orthanc OnStableStudy sends: ID, PatientID, StudyInstanceUID, etc.
        patient_id_str = payload.get("PatientID")  # DICOM Patient ID tag value
        study_uid = payload.get("StudyInstanceUID")
        
        if not patient_id_str or not study_uid:
            return JsonResponse({"status": "ok", "detail": "No patient/study data in payload"}, status=200)
            
        # Create study record aligned with the Study model fields
        Study.objects.get_or_create(
            study_uid=study_uid,
            defaults={
                "aros_patient_id": patient_id_str,
                "accession_number": payload.get("AccessionNumber", ""),
                "study_description": payload.get("StudyDescription", ""),
                "modality": payload.get("Modality", ""),
                "pacs_url": f"{settings.ORTHANC_WADO_URL}/studies/{study_uid}"
            }
        )
            
        return JsonResponse({"status": "ok"}, status=200)
