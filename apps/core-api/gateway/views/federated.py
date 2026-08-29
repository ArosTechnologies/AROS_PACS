import asyncio
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from asgiref.sync import async_to_sync

from django.core.cache import cache

from identity.models import FederationIDMap, ConsentRecord, ClinicRegistry
from gateway.services.clinic_integration import ClinicService

class FederatedStudiesView(APIView):
    """
    Query multiple clinics concurrently for a user's studies.
    Returns aggregated results.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient_id = str(request.user.id)
        
        cache_key = f"gateway_studies_{patient_id}"
        cached_response = cache.get(cache_key)
        if cached_response:
            return JsonResponse(cached_response)
        
        # Try to get active clinics from cache
        clinics = cache.get('active_clinics_list')
        if clinics is None:
            # Evaluate queryset to list in sync context to avoid SynchronousOnlyOperation
            clinics = list(ClinicRegistry.objects.filter(is_active=True))
            # Cache the list for 1 hour
            cache.set('active_clinics_list', clinics, timeout=3600)
        
        async def fetch_all():
            tasks = []
            for clinic in clinics:
                tasks.append(ClinicService.get_studies(clinic, patient_id))
            return await asyncio.gather(*tasks)
            
        results = async_to_sync(fetch_all)()
        
        studies = []
        unavailable = []
        for result in results:
            if result.get("status") == "ok":
                clinic_slug = result["clinic_slug"]
                for study in result.get("data", []):
                    study["_source_clinic"] = clinic_slug
                    studies.append(study)
            else:
                unavailable.append({"clinic": result["clinic_slug"], "reason": result.get("reason")})
                
        response_data = {
            "studies": studies,
            "partial_history": len(unavailable) > 0,
            "unavailable_sources": unavailable
        }
        cache.set(cache_key, response_data, timeout=300)
        
        return JsonResponse(response_data)
