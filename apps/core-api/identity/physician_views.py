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
        
        # Pre-fetch federation maps for all consenting patients
        patient_ids = [c.patient_id for c in consenting_patients]
        from identity.models import FederationIDMap
        federation_maps = FederationIDMap.objects.filter(user_id__in=patient_ids)
        fed_dict = {(f.user_id, f.clinic_id): f.local_patient_id for f in federation_maps}
        
        async def fetch_patient_studies(p_id):
            tasks = []
            for clinic in clinics:
                local_id = fed_dict.get((p_id, clinic.slug))
                if local_id:
                    tasks.append(ClinicService.get_studies(clinic, local_id))
            return await asyncio.gather(*tasks)

        all_studies = []
        seen_uids = set()
        for c in consenting_patients:
            p = c.patient
            prof = getattr(p, 'patient_profile', None)
            patient_name = f"{prof.first_name} {prof.last_name}".strip() if prof and (prof.first_name or prof.last_name) else p.email_hash
            
            results = async_to_sync(fetch_patient_studies)(p.id)
            for res in results:
                if res.get("status") == "ok":
                    for st in res.get("data", []):
                        uid = st.get("study_uid") or st.get("study_instance_uid")
                        if uid and uid in seen_uids:
                            continue
                        if uid:
                            seen_uids.add(uid)

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

        from identity.models import FederationIDMap
        federation_maps = FederationIDMap.objects.filter(user_id__in=consenting_patient_ids)
        fed_dict = {(f.user_id, f.clinic_id): f.local_patient_id for f in federation_maps}

        async def fetch_patient_studies(p_id):
            tasks = []
            for clinic in clinics:
                local_id = fed_dict.get((p_id, clinic.slug))
                if local_id:
                    tasks.append(ClinicService.get_studies(clinic, local_id))
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

class PhysicianAppointmentsView(APIView):
    """
    Returns appointments for the physician's patients across all clinics.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from identity.models import Appointment, PatientDoctorConsent
        consenting_patient_ids = PatientDoctorConsent.objects.filter(doctor=request.user, has_consent=True).values_list('patient_id', flat=True)
        appointments = Appointment.objects.filter(patient_id__in=consenting_patient_ids).order_by('-requested_date')
        
        result = []
        for a in appointments:
            p_prof = getattr(a.patient, 'patient_profile', None)
            patient_name = f"{p_prof.first_name} {p_prof.last_name}".strip() if p_prof and (p_prof.first_name or p_prof.last_name) else a.patient.email_hash
            
            result.append({
                "id": a.id,
                "patient_id": str(a.patient.id),
                "patient_name": patient_name,
                "clinic_id": a.clinic.slug,
                "clinic_name": a.clinic.name,
                "created_by": a.created_by.email_hash,
                "modality": a.modality,
                "requested_date": a.requested_date.isoformat() if a.requested_date else None,
                "proposed_date": a.proposed_date.isoformat() if a.proposed_date else None,
                "status": a.status,
                "notes": a.notes,
                "clinic_notes": a.clinic_notes,
                "clinic_opening_hours": getattr(a.clinic, 'opening_hours', '')
            })
        return JsonResponse(result, safe=False)

    def post(self, request):
        from identity.models import Appointment, PatientDoctorConsent, ClinicRegistry
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        patient_id = request.data.get('patient_id')
        clinic_id = request.data.get('clinic_id')
        requested_date = request.data.get('requested_date')
        modality = request.data.get('modality', '')
        notes = request.data.get('notes', '')
        
        try:
            if not PatientDoctorConsent.objects.filter(doctor=request.user, patient_id=patient_id, has_consent=True).exists():
                return JsonResponse({"error": "No tienes consentimiento para agendar una cita para este paciente."}, status=403)
                
            clinic = ClinicRegistry.objects.get(slug=clinic_id)
            patient = User.objects.get(id=patient_id)
            
            appointment = Appointment.objects.create(
                patient=patient,
                clinic=clinic,
                created_by=request.user,
                requested_date=requested_date,
                modality=modality,
                notes=notes
            )
            from core.notifications import notify_new_appointment
            notify_new_appointment(appointment)
            return JsonResponse({"status": "success", "appointment_id": appointment.id})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
            
    def put(self, request):
        from identity.models import Appointment, PatientDoctorConsent
        appointment_id = request.data.get('appointment_id')
        action = request.data.get('action')
        try:
            appointment = Appointment.objects.get(id=appointment_id)
            if not PatientDoctorConsent.objects.filter(doctor=request.user, patient_id=appointment.patient_id, has_consent=True).exists():
                return JsonResponse({"error": "No autorizado."}, status=403)
                
            if action == 'accept' and appointment.status == 'PROPOSED':
                appointment.status = 'ACCEPTED'
                appointment.requested_date = appointment.proposed_date
                appointment.save()
            elif action == 'cancel':
                appointment.status = 'CANCELLED'
                appointment.save()
            elif action == 'propose':
                proposed_date = request.data.get('proposed_date')
                reason = request.data.get('reason', '')
                if proposed_date:
                    appointment.proposed_date = proposed_date
                appointment.status = 'PROPOSED'
                appointment.proposed_by = 'PATIENT'
                if reason:
                    appointment.notes = reason
                appointment.save()
            return JsonResponse({"status": "success", "appointment_status": appointment.status})
        except Appointment.DoesNotExist:
            return JsonResponse({"error": "Appointment not found"}, status=404)
