import requests
from django.http import StreamingHttpResponse, JsonResponse, HttpResponse
from django.views import View

class WadoRsProxyView(View):
    """
    Synchronous View to proxy DICOMWeb requests directly to Orthanc for local simulation.
    Bypasses the empty Clinic API database and avoids DRF async compatibility issues.
    Rewrites BulkDataURI to route back through this gateway proxy with CORS support.
    """

    def options(self, request, *args, **kwargs):
        response = HttpResponse(status=204)
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS, POST"
        response["Access-Control-Allow-Headers"] = "*"
        return response
    
    def get(self, request, clinic_slug, dicom_path):
        orthanc_url = f"http://localhost:8042/dicom-web/{dicom_path}"
        
        # Forward headers
        headers = {}
        if "Accept" in request.headers:
            headers["Accept"] = request.headers["Accept"]
            
        try:
            orthanc_resp = requests.get(
                orthanc_url, 
                headers=headers, 
                stream=True, 
                auth=('orthanc', 'orthanc')
            )
            
            content_type = orthanc_resp.headers.get("Content-Type", "application/json")

            # If DICOM JSON / Metadata, rewrite BulkDataURI so OHIF can fetch pixel data through Gateway
            if "json" in content_type.lower():
                body_text = orthanc_resp.text
                gateway_wado_base = f"http://localhost:8000/api/v1/gateway/wado/{clinic_slug}/"
                body_text = body_text.replace("http://localhost/dicom-web/", gateway_wado_base)
                body_text = body_text.replace("http://localhost:8042/dicom-web/", gateway_wado_base)
                
                response = HttpResponse(
                    body_text,
                    content_type=content_type,
                    status=orthanc_resp.status_code
                )
                response["Access-Control-Allow-Origin"] = "*"
                response["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
                response["Access-Control-Allow-Headers"] = "*"
                return response
            
            # Binary stream for bulk data / multipart / frames
            response = StreamingHttpResponse(
                orthanc_resp.iter_content(chunk_size=65536), 
                content_type=content_type, 
                status=orthanc_resp.status_code
            )
            response["Access-Control-Allow-Origin"] = "*"
            response["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
            response["Access-Control-Allow-Headers"] = "*"
            return response
            
        except Exception as e:
            err_resp = JsonResponse({"error": str(e)}, status=500)
            err_resp["Access-Control-Allow-Origin"] = "*"
            return err_resp
