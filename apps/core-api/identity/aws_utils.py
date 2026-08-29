import os
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

KEYS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'local_keys')
KID = "local-dev-key-1"

def _generate_local_keys():
    if not os.path.exists(KEYS_DIR):
        os.makedirs(KEYS_DIR)
        
    private_key_path = os.path.join(KEYS_DIR, 'private_key.pem')
    public_key_path = os.path.join(KEYS_DIR, 'public_key.pem')
    
    if os.path.exists(private_key_path) and os.path.exists(public_key_path):
        with open(private_key_path, 'rb') as f:
            private_pem = f.read()
        with open(public_key_path, 'rb') as f:
            public_pem = f.read()
        return private_pem, public_pem

    # Generate new RSA key pair
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    with open(private_key_path, 'wb') as f:
        f.write(private_pem)
    with open(public_key_path, 'wb') as f:
        f.write(public_pem)
        
    return private_pem, public_pem

def get_active_rsa_keys():
    """
    Returns the private key, public key, and kid (Key ID).
    In a production environment, this should query AWS Secrets Manager.
    """
    # TODO: Add AWS Secrets Manager logic here for production
    # if os.getenv('DJANGO_ENV') == 'production': ...
    
    private_pem, public_pem = _generate_local_keys()
    return private_pem, public_pem, KID

def kms_encrypt(text: str) -> str:
    """
    Encrypts text using AWS KMS. (Mocked for dev)
    """
    # TODO: Implement boto3 KMS encryption
    return f"encrypted_{text}"

def kms_decrypt(text: str) -> str:
    """
    Decrypts text using AWS KMS. (Mocked for dev)
    """
    # TODO: Implement boto3 KMS decryption
    if text.startswith("encrypted_"):
        return text.replace("encrypted_", "")
    return text
