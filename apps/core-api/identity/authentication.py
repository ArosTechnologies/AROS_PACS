import redis
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.conf import settings

# Conexión global a Redis (en producción, usar URL desde settings o environment variables)
redis_client = redis.StrictRedis(host='localhost', port=6379, db=0, decode_responses=True)

class RedisBlacklistJWTAuthentication(JWTAuthentication):
    def get_validated_token(self, raw_token):
        """
        Validates the token against the standard SimpleJWT rules and 
        additionally checks if it exists in the Redis Blacklist.
        """
        validated_token = super().get_validated_token(raw_token)
        
        jti = validated_token.get('jti')
        if jti and redis_client.exists(f"bl_{jti}"):
            raise AuthenticationFailed('Token has been revoked/blacklisted.', code='token_not_valid')
            
        return validated_token

def blacklist_token(jti, exp_seconds):
    """
    Saves a JTI into Redis for the duration of the token's remaining lifetime.
    """
    if exp_seconds > 0:
        redis_client.setex(f"bl_{jti}", exp_seconds, "blacklisted")
