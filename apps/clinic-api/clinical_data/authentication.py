import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from jwt import PyJWKClient

# Lazy singleton for the JWK client.
# We do NOT instantiate at module load time to avoid crashing Django startup
# if core-api is unavailable when clinic-api boots.
_jwks_client = None

def get_jwks_client() -> PyJWKClient:
    """
    Returns the singleton PyJWKClient, creating it on first use.
    This lazy pattern prevents startup failures when core-api is unreachable.
    """
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.CORE_API_JWKS_URL)
    return _jwks_client


class S2SAuthentication(BaseAuthentication):
    """
    Validates Machine-to-Machine JWTs sent by the core-api gateway.
    It mathematically validates the token using the Public RSA Key fetched from core-api's JWKS.
    """
    def authenticate(self, request):
        auth_header = request.headers.get("X-Core-Service-Token")
        if not auth_header:
            return None # Proceed to other authenticators if any, or fail

        try:
            # Format: "Bearer <token>"
            token = auth_header.split(" ")[1]
        except IndexError:
            raise AuthenticationFailed("Invalid S2S token header format.")

        try:
            # Extract signing key from the JWKS (fetched lazily)
            signing_key = get_jwks_client().get_signing_key_from_jwt(token)
            
            # We expect the token to be issued by aros-core and intended for this specific clinic
            expected_audience = f"clinic-{settings.CLINIC_SLUG}"
            
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer="aros-core",
                audience=expected_audience
            )
            
            if payload.get("type") != "s2s":
                raise AuthenticationFailed("Token is not an S2S token.")
                
        except jwt.PyJWKClientError as e:
            raise AuthenticationFailed(f"Unable to fetch public key from JWKS: {str(e)}")
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("S2S token has expired.")
        except jwt.InvalidAudienceError:
            raise AuthenticationFailed("S2S token was not intended for this clinic.")
        except jwt.InvalidIssuerError:
            raise AuthenticationFailed("S2S token was not issued by aros-core.")
        except jwt.DecodeError:
            raise AuthenticationFailed("Invalid S2S token.")
        except Exception as e:
            raise AuthenticationFailed(f"S2S Authentication failed: {str(e)}")

        # Return a lightweight ServiceUser — DRF requires (user, auth) tuple
        class ServiceUser:
            is_authenticated = True
        
        return (ServiceUser(), payload)
