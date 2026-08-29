import httpx
from django.conf import settings
from django.http import StreamingHttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

# Single global client for proxying to Orthanc
orthanc_client = httpx.AsyncClient(timeout=30.0)

class OrthancWadoProxyView(APIView):
    """
    Proxies WADO-RS requests to the internal Orthanc server.
    Protected by S2S JWT.
    """
    permission_classes = [IsAuthenticated]
    
    async def get(self, request, study_uid, series_uid=None, instance_uid=None):
        base_url = settings.ORTHANC_WADO_URL
        
        if instance_uid and series_uid:
            path = f"/wado/studies/{study_uid}/series/{series_uid}/instances/{instance_uid}"
        elif series_uid:
            path = f"/wado/studies/{study_uid}/series/{series_uid}"
        else:
            path = f"/wado/studies/{study_uid}"
            
        url = f"{base_url}{path}"
        
        headers = {
            "Accept": request.headers.get("Accept", "multipart/related; type=application/dicom")
        }
        
        async def stream_generator():
            async with orthanc_client.stream("GET", url, headers=headers) as response:
                if response.status_code >= 400:
                    yield await response.aread()
                    return
                async for chunk in response.aiter_bytes(chunk_size=65536):
                    yield chunk
                    
        try:
            head_resp = await orthanc_client.head(url, headers=headers)
            content_type = head_resp.headers.get("Content-Type", "application/dicom")
            status_code = head_resp.status_code
        except Exception:
            content_type = "application/dicom"
            status_code = 200

        if status_code >= 400:
            return JsonResponse({"error": "Orthanc WADO-RS failed"}, status=status_code)

        return StreamingHttpResponse(stream_generator(), content_type=content_type)
