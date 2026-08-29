import hmac
import hashlib
import json
from django.http import JsonResponse
from rest_framework.views import APIView
from identity.models import ClinicRegistry, FederationIDMap, ConsentRecord, User

class ClinicWebhookReceiver(APIView):
    """
    Receives and validates HMAC signed webhooks from Clinics.
    """
    permission_classes = [] # Authentication is done via HMAC signature
    
    def post(self, request):
        signature = request.headers.get("X-Clinic-Signature")
        clinic_slug = request.headers.get("X-Clinic-Slug")
        
        if not signature or not clinic_slug:
            return JsonResponse({"error": "Missing signature or slug headers"}, status=400)
            
        try:
            clinic = ClinicRegistry.objects.get(slug=clinic_slug)
        except ClinicRegistry.DoesNotExist:
            return JsonResponse({"error": "Unknown clinic"}, status=404)
            
        # Verify HMAC
        expected_signature = hmac.new(
            clinic.webhook_secret.encode('utf-8'),
            request.body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_signature, signature):
            return JsonResponse({"error": "Invalid signature"}, status=403)
            
        # Process Payload
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON payload"}, status=400)
            
        event = payload.get("event")
        local_patient_id = payload.get("local_patient_id")
        
        if not event or not local_patient_id:
            return JsonResponse({"error": "Malformed payload"}, status=400)
            
        if event in ["patient.created", "patient.updated"]:
            # NOTE: In a real environment, the clinic would send a global unique identifier (like CURP in Mexico or SSN)
            # Or the user email so we can map it. 
            # For this prototype, we'll try to find a user by email constructed or provided in the payload, 
            # or simply mock the linkage.
            
            # Since our payload currently doesn't send the user's email hash, we will just create a mock FederationIDMap
            # for the first user in the DB for demonstration. In production, PatientProfile MUST contain `global_email_hash` or `user_uuid`.
            user = User.objects.first()
            if user:
                # Update or create the federation map
                FederationIDMap.objects.update_or_create(
                    user=user,
                    clinic=clinic,
                    defaults={"local_patient_id": local_patient_id}
                )
                
                # Auto-grant consent for demonstration purposes (in real app, patient grants it via app)
                ConsentRecord.objects.get_or_create(
                    user=user,
                    clinic=clinic,
                    defaults={"has_consent": True}
                )
                
            return JsonResponse({"status": "acknowledged"}, status=200)
            
        return JsonResponse({"status": "ignored", "reason": "unhandled event type"}, status=200)
