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
            return JsonResponse({"studies": result.get("data", [])})
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
            return JsonResponse(result.get("data", {}), status=201)
        else:
            return JsonResponse({"error": result.get("reason")}, status=500)
