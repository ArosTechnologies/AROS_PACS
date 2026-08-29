import pybreaker
from gateway.client import http_client, get_clinic_breaker
from gateway.s2s_auth import generate_s2s_jwt

class ClinicService:
    """
    Service class for abstracting network calls and circuit breaker logic
    to external clinic APIs.
    """
    @staticmethod
    async def get_studies(clinic, local_patient_id: str):
        """
        Executes an HTTP request to a single clinic via Circuit Breaker.
        Uses clinic.api_url from ClinicRegistry for dynamic routing.
        """
        breaker = get_clinic_breaker(clinic.slug)
        s2s_token = generate_s2s_jwt(clinic.slug)
        
        # Use the api_url stored in ClinicRegistry for dynamic per-clinic routing.
        base_url = clinic.api_url or "http://localhost:8001"
        url = f"{base_url}/api/v1/clinical/studies/?patient_id={local_patient_id}"
        
        headers = {
            "X-Core-Service-Token": f"Bearer {s2s_token}"
        }

        try:
            # Wrap the httpx request inside the CircuitBreaker
            @breaker
            async def do_request():
                response = await http_client.get(url, headers=headers)
                response.raise_for_status()
                return response.json()
                
            data = await do_request()
            return {"clinic_slug": clinic.slug, "status": "ok", "data": data}
            
        except (pybreaker.CircuitBreakerError, Exception) as e:
            return {"clinic_slug": clinic.slug, "status": "error", "reason": str(e)}
            
    @staticmethod
    async def get_study(clinic, study_id: str):
        """
        Executes an HTTP request to fetch a specific study via Circuit Breaker.
        """
        breaker = get_clinic_breaker(clinic.slug)
        s2s_token = generate_s2s_jwt(clinic.slug)
        
        base_url = clinic.api_url or "http://localhost:8001"
        url = f"{base_url}/api/v1/clinical/studies/{study_id}/"
        
        headers = {
            "X-Core-Service-Token": f"Bearer {s2s_token}"
        }

        try:
            @breaker
            async def do_request():
                response = await http_client.get(url, headers=headers)
                response.raise_for_status()
                return response.json()
                
            data = await do_request()
            return {"status": "ok", "data": data}
            
        except (pybreaker.CircuitBreakerError, Exception) as e:
            return {"status": "error", "reason": str(e)}
