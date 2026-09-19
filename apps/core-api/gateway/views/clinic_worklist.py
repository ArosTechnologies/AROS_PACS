from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from asgiref.sync import async_to_sync

from gateway.services.clinic_integration import ClinicService
from identity.models import ClinicRegistry

class ClinicWorklistProxyView(APIView):
    """
    Proxies worklist requests from clinic-portal to the specific clinic-api.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'staff_profile', None)
        if not profile or not profile.clinic:
            return JsonResponse({"studies": []})
        
        clinic = profile.clinic
        patient_id = request.GET.get('patient_id', "")
        
        local_id = patient_id
        if patient_id:
            from identity.models import FederationIDMap
            try:
                fed = FederationIDMap.objects.get(user_id=patient_id, clinic=clinic)
                local_id = fed.local_patient_id
            except FederationIDMap.DoesNotExist:
                pass

        async def fetch_worklist():
            return await ClinicService.get_studies(clinic, local_id)
            
        result = async_to_sync(fetch_worklist)()
        
        if result.get("status") == "ok":
            studies = result.get("data", [])
            from identity.models import PatientProfile
            for s in studies:
                aros_id = s.get("aros_patient_id")
                if aros_id:
                    try:
                        p = PatientProfile.objects.get(curp_or_mrn=aros_id)
                        s["patient_name"] = f"{p.first_name} {p.last_name}".strip()
                        s["patient_dob"] = str(p.dob) if p.dob else None
                    except PatientProfile.DoesNotExist:
                        s["patient_name"] = "Paciente Desconocido"
            return JsonResponse({"studies": studies})
        else:
            return JsonResponse({"error": result.get("reason")}, status=500)

class ClinicReportProxyView(APIView):
    """
    Proxies report creation requests from clinic-portal to the specific clinic-api.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, 'staff_profile', None)
        if not profile or not profile.clinic:
            return JsonResponse({"error": "Unauthorized"}, status=403)
        
        clinic = profile.clinic

        async def submit_report():
            return await ClinicService.post_report(clinic, request.data)
            
        result = async_to_sync(submit_report)()
        
        if result.get("status") == "ok":
            data = result.get("data", {})
            if request.data.get("status") == "COM" and data.get("local_patient_id"):
                try:
                    from core.notifications import notify_federated_report_completed
                    from identity.models import PatientProfile
                    
                    patient_name = data.get("patient_name", "Paciente")
                    try:
                        p = PatientProfile.objects.get(curp_or_mrn=data.get("local_patient_id"))
                        patient_name = f"{p.first_name} {p.last_name}".strip()
                    except PatientProfile.DoesNotExist:
                        pass
                        
                    notify_federated_report_completed(clinic, data.get("local_patient_id"), patient_name)
                except Exception as e:
                    print(f"Error notifying report completed: {e}")
            return JsonResponse(data, status=201)
        else:
            return JsonResponse({"error": result.get("reason")}, status=500)
