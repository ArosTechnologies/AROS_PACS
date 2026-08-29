import asyncio
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from asgiref.sync import async_to_sync

from identity.models import PatientDoctorConsent, User, PatientProfile, ClinicRegistry
from gateway.services.clinic_integration import ClinicService

class PhysicianPatientsView(APIView):
    """
    Returns all patients that have granted active consent to this physician.
    Enforces HIPAA/Zero-Trust security filtering.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        consents = PatientDoctorConsent.objects.filter(doctor=request.user, has_consent=True).select_related('patient', 'patient__patient_profile')

        patients = []
        for c in consents:
            p = c.patient
            prof = getattr(p, 'patient_profile', None)
            patient_name = f"{prof.first_name} {prof.last_name}".strip() if prof and (prof.first_name or prof.last_name) else p.email_hash
            
            patients.append({
                "id": str(p.id),
                "name": patient_name,
                "email": p.email_hash,
                "phone": prof.phone if prof else "",
                "dob": str(prof.dob) if prof and prof.dob else None,
                "gender": prof.gender if prof else "O",
                "curp_or_mrn": prof.curp_or_mrn if prof else "",
                "blood_type": prof.blood_type if prof else "O+",
                "allergies": prof.allergies if prof else "Ninguna",
                "consent_date": c.granted_at.strftime('%Y-%m-%d') if c.granted_at else "2026-08-25",
                "last_study": "Estudios diagnósticos activos",
                "avatar": (patient_name.split(' ')[0][:1] + (patient_name.split(' ')[-1][:1] if ' ' in patient_name else '')).upper()
            })

        return JsonResponse(patients, safe=False)


class PhysicianStudiesView(APIView):
    """
    Returns all studies and reports of patients who have granted active consent to this physician.
    Strictly verifies HIPAA Patient-Doctor consent before querying federated clinical sources.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        consenting_patients = PatientDoctorConsent.objects.filter(doctor=request.user, has_consent=True).select_related('patient', 'patient__patient_profile')
        
        clinics = list(ClinicRegistry.objects.filter(is_active=True))
        
        async def fetch_patient_studies(p_id):
            tasks = [ClinicService.get_studies(clinic, str(p_id)) for clinic in clinics]
            return await asyncio.gather(*tasks)

        all_studies = []
        for c in consenting_patients:
            p = c.patient
            prof = getattr(p, 'patient_profile', None)
            patient_name = f"{prof.first_name} {prof.last_name}".strip() if prof and (prof.first_name or prof.last_name) else p.email_hash
            
            results = async_to_sync(fetch_patient_studies)(p.id)
            for res in results:
                if res.get("status") == "ok":
                    for st in res.get("data", []):
                        all_studies.append({
                            "id": st.get("id_study"),
                            "patient_id": str(p.id),
                            "patient_name": patient_name,
                            "patient_email": p.email_hash,
                            "patient_phone": prof.phone if prof else "",
                            "patient_dob": str(prof.dob) if prof and prof.dob else None,
                            "patient_gender": prof.gender if prof else "O",
                            "patient_curp": prof.curp_or_mrn if prof else "",
                            "patient_blood_type": prof.blood_type if prof else "O+",
                            "patient_allergies": prof.allergies if prof else "Ninguna",
                            "study_uid": st.get("study_uid"),
                            "accession_number": st.get("accession_number"),
                            "study_date": st.get("study_date"),
                            "study_description": st.get("study_description"),
                            "modality": st.get("modality"),
                            "clinic_slug": res.get("clinic_slug"),
                            "report": st.get("report")
                        })

        all_studies.sort(key=lambda x: x.get('study_date') or '', reverse=True)
        return JsonResponse(all_studies, safe=False)


class PhysicianStudyDetailView(APIView):
    """
    Returns single study & diagnostic report details.
    Enforces HIPAA check: Requesting doctor must have active consent from the study owner.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, study_uid):
        # 1. Fetch active consenting patient IDs for this doctor
        consenting_patient_ids = set(
            PatientDoctorConsent.objects.filter(doctor=request.user, has_consent=True).values_list('patient_id', flat=True)
        )

        clinics = list(ClinicRegistry.objects.filter(is_active=True))

        async def fetch_patient_studies(p_id):
            tasks = [ClinicService.get_studies(clinic, str(p_id)) for clinic in clinics]
            return await asyncio.gather(*tasks)

        for p_id in consenting_patient_ids:
            results = async_to_sync(fetch_patient_studies)(p_id)
            for res in results:
                if res.get("status") == "ok":
                    for st in res.get("data", []):
                        if st.get("study_uid") == study_uid:
                            # Patient match with valid consent verified
                            patient = User.objects.get(id=p_id)
                            prof = getattr(patient, 'patient_profile', None)
                            patient_name = f"{prof.first_name} {prof.last_name}".strip() if prof and (prof.first_name or prof.last_name) else patient.email_hash

                            return JsonResponse({
                                "id": st.get("id_study"),
                                "patient_id": str(p_id),
                                "patient_name": patient_name,
                                "patient_email": patient.email_hash,
                                "patient_phone": prof.phone if prof else "",
                                "patient_dob": str(prof.dob) if prof and prof.dob else None,
                                "patient_gender": prof.gender if prof else "O",
                                "patient_curp": prof.curp_or_mrn if prof else "",
                                "patient_blood_type": prof.blood_type if prof else "O+",
                                "patient_allergies": prof.allergies if prof else "Ninguna",
                                "study_uid": st.get("study_uid"),
                                "accession_number": st.get("accession_number"),
                                "study_date": st.get("study_date"),
                                "study_description": st.get("study_description"),
                                "modality": st.get("modality"),
                                "clinic_slug": res.get("clinic_slug"),
                                "report": st.get("report")
                            })

        return JsonResponse({
            "error": "Acceso no autorizado o estudio no encontrado. Verifique que el paciente mantenga activo el consentimiento médico hacia su cuenta."
        }, status=403)
