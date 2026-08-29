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
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, help_text="Global profile picture")
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    role = models.ForeignKey('Roles', on_delete=models.SET_NULL, null=True, blank=True)
    
    objects = UserManager()

    USERNAME_FIELD = 'email_hash'
    
    def __str__(self):
        return str(self.id)

class PatientProfile(models.Model):
    """
    Global Patient Profile residing in AROS Core.
    """
    MALE = 'M'
    FEMALE = 'F'
    OTHER = 'O'
    GENDER_CHOICES = [
        (MALE, 'Male'),
        (FEMALE, 'Female'),
        (OTHER, 'Other'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255, blank=True, default='')
    dob = models.DateField(null=True, blank=True, help_text="Date of birth")
    address = models.CharField(max_length=100, blank=True, default='')
    phone = models.CharField(max_length=100, blank=True, default='')
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default=OTHER)
    curp_or_mrn = models.CharField(max_length=100, null=True, blank=True, unique=True)
    blood_type = models.CharField(max_length=10, blank=True, default='O+')
    allergies = models.CharField(max_length=255, blank=True, default='Ninguna')
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class StaffProfile(models.Model):
    """
    Profile for clinical staff (Radiologist, Assistant, Admin, Superadmin).
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='staff_profile')
    first_name = models.CharField(max_length=255, blank=True, default='')
    last_name = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    cedula_profesional = models.CharField(max_length=100, blank=True, default='', help_text="Cédula profesional médica")
    specialty = models.CharField(max_length=255, blank=True, default='Radiología General')
    bio = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.user.role})"

class ClinicRegistry(models.Model):
    """
    Registry of clinics authorized in the AROS network.
    """
    slug = models.SlugField(primary_key=True, max_length=100)
    name = models.CharField(max_length=255)
    primary_color = models.CharField(max_length=7, default="#0284c7", help_text="HEX color for the clinic's white-label UI")
    
    # Clinic details for patients and network discovery
    address = models.CharField(max_length=500, blank=True, default='Av. Insurgentes Sur 123, Roma Norte, CDMX', help_text="Dirección física completa")
    phone = models.CharField(max_length=50, blank=True, default='+52 55 1234 5678', help_text="Teléfono de atención")
    email = models.EmailField(max_length=255, blank=True, default='contacto@clinica.com', help_text="Correo institucional")
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=5.0, help_text="Calificación calculada de la clínica (1.0 - 5.0)")
    total_reviews = models.IntegerField(default=0, help_text="Total de calificaciones recibidas por pacientes")
    specialties = models.JSONField(
        default=list, 
        blank=True, 
        help_text="Especialidades médicas y estudios ofrecidos"
    )
    latitude = models.FloatField(default=19.4326, help_text="Latitud calculada para el mapa")
    longitude = models.FloatField(default=-99.1332, help_text="Longitud calculada para el mapa")
    opening_hours = models.CharField(max_length=255, blank=True, default='Lun - Vie: 07:00 - 20:00 | Sáb: 08:00 - 14:00')
    report_layout = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configuración visual estructurada del membrete para reportes médicos PDF"
    )

    public_key = models.TextField(help_text="Public key for S2S JWT validation from this clinic", blank=True)
    webhook_secret = models.CharField(
        max_length=255,
        default='',
        help_text="HMAC SHA-256 shared secret for validating incoming webhooks from this clinic"
    )
    api_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text="Internal ALB/Peer2Peer URL of the clinic's API (e.g. http://10.0.1.5:8001)"
    )
    is_active = models.BooleanField(default=True)

    def update_rating_stats(self):
        ratings = self.ratings.all()
        if ratings.exists():
            from django.db.models import Avg
            avg_score = ratings.aggregate(Avg('score'))['score__avg'] or 5.0
            self.rating = round(avg_score, 1)
            self.total_reviews = ratings.count()
        else:
            self.rating = 5.0
            self.total_reviews = 0
        self.save(update_fields=['rating', 'total_reviews'])

    def __str__(self):
        return self.name

class ClinicRating(models.Model):
    """
    Patient rating and feedback for a clinic in the AROS network.
    """
    clinic = models.ForeignKey(ClinicRegistry, on_delete=models.CASCADE, related_name='ratings')
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='clinic_ratings')
    score = models.IntegerField(default=5, help_text="Puntaje de 1 a 5 estrellas")
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('clinic', 'patient')

    def __str__(self):
        return f"{self.patient.email_hash} -> {self.clinic.name}: {self.score}★"



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
    Supports granting and revoking consent per clinic.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    clinic = models.ForeignKey(ClinicRegistry, on_delete=models.CASCADE)
    has_consent = models.BooleanField(
        default=True,
        help_text="Whether the user currently has active consent for this clinic"
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of consent revocation. Null if consent is still active."
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'clinic')
        indexes = [
            models.Index(fields=['user', 'clinic'], name='idx_consent_user_clinic'),
        ]

class PatientDoctorConsent(models.Model):
    """
    HIPAA Consent record for accessing clinical data by external doctors.
    """
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='doctor_consents_given')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='patient_consents_received')
    has_consent = models.BooleanField(default=True)
    granted_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('patient', 'doctor')
        indexes = [
            models.Index(fields=['patient', 'doctor'], name='idx_patient_doctor_consent'),
        ]
