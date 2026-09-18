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
        
        # We need to map the clinic to the user's local patient ID
        federation_maps = FederationIDMap.objects.filter(user=request.user)
        fed_dict = {f.clinic_id: f.local_patient_id for f in federation_maps}
        
        async def fetch_all_mapped():
            tasks = []
            for clinic in clinics:
                local_id = fed_dict.get(clinic.slug)
                if local_id:
                    tasks.append(ClinicService.get_studies(clinic, local_id))
            return await asyncio.gather(*tasks)
            
        results = async_to_sync(fetch_all_mapped)()
        
        studies_dict = {}
        unavailable = []
        for result in results:
            if result.get("status") == "ok":
                clinic_slug = result["clinic_slug"]
                for study in result.get("data", []):
                    study["_source_clinic"] = clinic_slug
                    # Deduplicate by study_uid. Keep the first one found.
                    uid = study.get("study_uid") or study.get("study_instance_uid")
                    if uid and uid not in studies_dict:
                        studies_dict[uid] = study
            else:
                unavailable.append({"clinic": result["clinic_slug"], "reason": result.get("reason")})
                
        response_data = {
            "studies": list(studies_dict.values()),
            "partial_history": len(unavailable) > 0,
            "unavailable_sources": unavailable
        }
        cache.set(cache_key, response_data, timeout=300)
        
        return JsonResponse(response_data)
