from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from identity.models import Appointment

class ClinicAgendaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role.name not in ["Administrador", "Asistente Médico", "Superadministrador"]:
            return JsonResponse({"error": "Unauthorized"}, status=403)
            
        clinic_slug = request.GET.get('clinic_id')
        if not clinic_slug:
            if hasattr(request.user, 'staff_profile') and request.user.staff_profile.clinic:
                clinic_slug = request.user.staff_profile.clinic.slug
            else:
                clinic_slug = 'demo-clinic'
        
        appointments = Appointment.objects.filter(clinic__slug=clinic_slug).order_by('-requested_date')
        
        result = []
        for a in appointments:
            prof = getattr(a.patient, 'patient_profile', None)
            patient_name = f"{prof.first_name} {prof.last_name}".strip() if prof else a.patient.email_hash
            result.append({
                "id": a.id,
                "patient_name": patient_name,
                "patient_email": a.patient.email_hash,
                "patient_phone": prof.phone if prof else "",
                "created_by": a.created_by.email_hash,
                "modality": a.modality,
                "requested_date": a.requested_date.isoformat() if a.requested_date else None,
                "proposed_date": a.proposed_date.isoformat() if a.proposed_date else None,
                "status": a.status,
                "notes": a.notes,
                "clinic_notes": a.clinic_notes
            })
            
        return JsonResponse(result, safe=False)

    def put(self, request):
        if request.user.role.name not in ["Administrador", "Asistente Médico", "Superadministrador"]:
            return JsonResponse({"error": "Unauthorized"}, status=403)
            
        appointment_id = request.data.get('appointment_id')
        action = request.data.get('action') # 'accept', 'reject', 'propose'
        proposed_date = request.data.get('proposed_date')
        reason = request.data.get('reason', '')
        
        try:
            appointment = Appointment.objects.get(id=appointment_id)
            
            user_clinic = request.user.staff_profile.clinic if hasattr(request.user, 'staff_profile') else None
            if user_clinic and appointment.clinic != user_clinic and user_clinic.slug != 'demo-clinic':
                return JsonResponse({"error": "Appointment belongs to a different clinic"}, status=403)
            
            if action == 'accept':
                appointment.status = 'ACCEPTED'
            elif action == 'reject':
                appointment.status = 'REJECTED'
                appointment.clinic_notes = reason
            elif action == 'propose' and proposed_date:
                appointment.status = 'PROPOSED'
                appointment.proposed_date = proposed_date
                appointment.clinic_notes = reason
                
            appointment.save()
            
            from core.notifications import notify_appointment_status_changed
            notify_appointment_status_changed(appointment)
            
            return JsonResponse({"status": "success", "appointment_status": appointment.status})
            
        except Appointment.DoesNotExist:
            return JsonResponse({"error": "Appointment not found"}, status=404)
