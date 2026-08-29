import time
import jwt
from identity.aws_utils import get_active_rsa_keys

def generate_s2s_jwt(clinic_slug: str) -> str:
    """
    Generates a Server-to-Server (S2S) JWT used by the Gateway to authenticate 
    itself against individual Clinic APIs.
    
    The token has a short lifespan (5 minutes) and is signed using the Gateway's RS256 private key.
    """
    private_pem, _, kid = get_active_rsa_keys()
    
    now = int(time.time())
    payload = {
        "iss": "aros-core",
        "aud": f"clinic-{clinic_slug}",
        "iat": now,
        "exp": now + 300, # 5 minutes lifespan
        "type": "s2s"
    }
    
    token = jwt.encode(
        payload,
        private_pem,
        algorithm="RS256",
        headers={"kid": kid}
    )
    
    # jwt.encode returns a string in newer PyJWT versions, but bytes in older.
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token
