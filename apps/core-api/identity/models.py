import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

class UserManager(BaseUserManager):
    def create_user(self, email_hash, password=None, **extra_fields):
        if not email_hash:
            raise ValueError("The Email Hash must be set")
        user = self.model(email_hash=email_hash, **extra_fields)
        user.set_password(password) # Argon2 via settings
        user.save(using=self._db)
        return user

    def create_superuser(self, email_hash, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email_hash, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    """
    AROS Identity Provider User.
    Uses Argon2 for passwords. Email is stored as a deterministic hash (for search)
    and an asymmetrically encrypted string (KMS) to preserve Zero Trust.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email_hash = models.CharField(max_length=255, unique=True, help_text="Deterministic hash for exact match lookups")
    email_encrypted = models.TextField(help_text="KMS encrypted email string")
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    objects = UserManager()

    USERNAME_FIELD = 'email_hash'
    
    def __str__(self):
        return str(self.id)

class ClinicRegistry(models.Model):
    """
    Registry of clinics authorized in the AROS network.
    """
    slug = models.SlugField(primary_key=True, max_length=100)
    name = models.CharField(max_length=255)
    public_key = models.TextField(help_text="Public key for webhook and S2S validation from this clinic")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class Roles(models.Model):
    """
    Global roles definition.
    """
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class FederationIDMap(models.Model):
    """
    Maps a global AROS User to a specific Clinic's local ID.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="federated_identities")
    clinic = models.ForeignKey(ClinicRegistry, on_delete=models.CASCADE)
    local_patient_id = models.CharField(max_length=255, help_text="ID of the PatientProfile in the clinic's RDS")

    class Meta:
        indexes = [
            models.Index(fields=['user', 'clinic'], name='idx_federation_user_clinic'),
        ]
        unique_together = ('user', 'clinic')

class ConsentRecord(models.Model):
    """
    HIPAA Consent record for accessing clinical data.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    clinic = models.ForeignKey(ClinicRegistry, on_delete=models.CASCADE)
    granted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'clinic'], name='idx_consent_user_clinic'),
        ]
