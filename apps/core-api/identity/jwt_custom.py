from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.settings import api_settings
from .aws_utils import get_active_rsa_keys
import jwt

_, _, KID = get_active_rsa_keys()

class CustomTokenBackend(TokenBackend):
    def encode(self, payload):
        """
        Returns an encoded token for the given payload dictionary, injecting the KID header.
        """
        jwt_payload = payload.copy()
        if api_settings.AUDIENCE is not None:
            jwt_payload["aud"] = api_settings.AUDIENCE
        if api_settings.ISSUER is not None:
            jwt_payload["iss"] = api_settings.ISSUER

        token = jwt.encode(
            jwt_payload,
            self.signing_key,
            algorithm=self.algorithm,
            headers={"kid": KID},
        )
        if isinstance(token, bytes):
            return token.decode("utf-8")
        return token
