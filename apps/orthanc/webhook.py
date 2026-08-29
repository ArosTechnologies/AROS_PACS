import orthanc
import json
import urllib.request
import hmac
import hashlib
import os

CLINIC_API_URL = os.environ.get("CLINIC_API_URL", "http://clinic-api:8000")
WEBHOOK_SECRET = os.environ.get("ORTHANC_WEBHOOK_SECRET", "local-orthanc-secret")

def OnChange(changeType, level, resourceId):
    if changeType == orthanc.ChangeType.STABLE_STUDY:
        orthanc.LogWarning(f"Study {resourceId} is stable, sending webhook to Clinic API.")
        
        try:
            # Get study details
            study_tags = json.loads(orthanc.RestApiGet(f'/studies/{resourceId}'))
            
            # Construct payload
            patient_tags = study_tags.get('PatientMainDicomTags', {})
            study_main_tags = study_tags.get('MainDicomTags', {})
            
            # Optionally grab modality from a series
            series_list = study_tags.get('Series', [])
            modality = ""
            if series_list:
                series_tags = json.loads(orthanc.RestApiGet(f'/series/{series_list[0]}'))
                modality = series_tags.get('MainDicomTags', {}).get('Modality', '')
            
            payload = {
                "PatientID": patient_tags.get('PatientID', ''),
                "PatientName": patient_tags.get('PatientName', ''),
                "StudyInstanceUID": study_main_tags.get('StudyInstanceUID', ''),
                "AccessionNumber": study_main_tags.get('AccessionNumber', ''),
                "StudyDescription": study_main_tags.get('StudyDescription', ''),
                "Modality": modality
            }
            
            payload_bytes = json.dumps(payload).encode('utf-8')
            
            # Generate HMAC
            signature = hmac.new(
                WEBHOOK_SECRET.encode('utf-8'),
                payload_bytes,
                hashlib.sha256
            ).hexdigest()
            
            # Send request
            req = urllib.request.Request(
                f"{CLINIC_API_URL}/api/v1/clinic/webhooks/orthanc/",
                data=payload_bytes,
                headers={
                    'Content-Type': 'application/json',
                    'X-Orthanc-Webhook-Signature': signature
                },
                method='POST'
            )
            
            with urllib.request.urlopen(req) as response:
                orthanc.LogWarning(f"Webhook sent successfully. Status: {response.getcode()}")
                
        except Exception as e:
            orthanc.LogError(f"Failed to send webhook: {str(e)}")

orthanc.RegisterOnChangeCallback(OnChange)
