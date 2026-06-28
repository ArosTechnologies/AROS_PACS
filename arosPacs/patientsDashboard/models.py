"""
Models for the Patients Dashboard.
Defines the `Patient` profile, representing the end-users receiving radiological services.
"""
from django.db import models
from django.contrib.auth.models import User

class Patient(models.Model):
    """
    Profile model for registered Patients.
    Extends the standard Django User model via a OneToOne relationship.
    
    Acts as the central entity linking to multiple `Study` records and defining
    which external `AssociateDoctor`s have permission to view their results through
    the ManyToMany `associated_doctors` field.
    """
    MALE = 'M'
    FEMALE = 'F'
    OTHER = 'O'
    GENDER_CHOICES = [
        (MALE, 'Male'),
        (FEMALE, 'Female'),
        (OTHER, 'Other'),
    ]
    
    # Internal identity linking
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, related_name='patient_profile')
    id_patient = models.AutoField(primary_key=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)
    
    # Contact information
    address = models.CharField(max_length=100)
    phone = models.CharField(max_length=100)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default=OTHER)
    is_email_verified = models.BooleanField(default=False)
    
    # External PACS/RIS Integration identifiers
    raditech_patient_id = models.CharField(max_length=100, null=True, blank=True)
    mrn = models.CharField(max_length=50, null=True, blank=True, unique=True)
    
    # Privacy & Sharing settings: Defines which doctors can access this patient's records
    associated_doctors = models.ManyToManyField('associateDoctorDashboard.AssociateDoctor', related_name='patients')

    @property
    def first_name(self):
        """Helper property to access the underlying user's first name."""
        if self.user:
            return self.user.first_name
        return ""

    @property
    def last_name(self):
        """Helper property to access the underlying user's last name."""
        if self.user:
            return self.user.last_name
        return ""
    
    @property
    def email(self):
        """Helper property to access the underlying user's email."""
        if self.user:
            return self.user.email
        return ""