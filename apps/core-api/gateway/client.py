import httpx
import pybreaker

# Global Async HTTPX client for multiplexing connections across clinics
# Configured with a 5.0 seconds global timeout to avoid hanging the Gateway
http_client = httpx.AsyncClient(timeout=5.0)

# In-memory dictionary to store Circuit Breakers per Clinic Slug
# This prevents one failing clinic from dragging down the rest of the Federated Query.
# Fail Max = 5 consecutive failures before opening the circuit
# Reset Timeout = 60 seconds before trying again (Half-Open state)
clinic_breakers = {}

def get_clinic_breaker(clinic_slug: str) -> pybreaker.CircuitBreaker:
    """
    Returns the CircuitBreaker instance for a specific clinic.
    Creates one if it doesn't exist yet.
    """
    if clinic_slug not in clinic_breakers:
        clinic_breakers[clinic_slug] = pybreaker.CircuitBreaker(
            fail_max=5,
            reset_timeout=60
        )
    return clinic_breakers[clinic_slug]
