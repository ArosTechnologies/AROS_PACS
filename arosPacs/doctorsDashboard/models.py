"""
Data Models for the Doctors Dashboard.
Defines the `ReportingDoctor` profile. 
"""
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import FileExtensionValidator
    
class ReportingDoctor(models.Model):
    """
    Profile model representing a specialized Reporting Radiologist in the lab.
    Extends the underlying Django User via a OneToOne relationship.
    
    Contains their medical credentials, contact info, and their cryptographic signature 
    image which is stamped onto generated PDF reports.
    """
    MALE = 'M'
    FEMALE = 'F'
    OTHER = 'O'
    GENDER_CHOICES = [
        (MALE, 'Male'),
        (FEMALE, 'Female'),
        (OTHER, 'Other'),
    ]
    
    # Core User identity
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, related_name='reporting_doctor_profile')
    id_doctor = models.AutoField(primary_key=True)
    
    # Profile & Report Assets
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)
    # The signature must be a pure PNG to preserve transparency over the PDF background.
    signature = models.ImageField(upload_to='signatures/', validators=[FileExtensionValidator(allowed_extensions=['png'])], null=True, blank=True)
    
    # Demographics & Contact
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default=OTHER)
    address = models.CharField(max_length=100)
    phone = models.CharField(max_length=100)
    
    # Medical Credentials
    university = models.CharField(max_length=100)
    professional_id = models.CharField(max_length=100)
    specialty = models.CharField(max_length=100)

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