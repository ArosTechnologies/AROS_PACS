"""
Models for the Associate Doctor Dashboard.
Defines the `AssociateDoctor` profile, representing referring physicians
who need secure access to view the radiological studies of their linked patients.
"""
from django.db import models
from django.contrib.auth.models import User

class AssociateDoctor(models.Model):
    """
    Profile model for referring external physicians (Associate Doctors).
    Extends the standard Django User model via a OneToOne relationship.
    
    This profile requires administrative verification (`is_verified`) before 
    the doctor can successfully login and access any patient data.
    """
    MALE = 'M'
    FEMALE = 'F'
    OTHER = 'O'
    GENDER_CHOICES = [
        (MALE, 'Male'),
        (FEMALE, 'Female'),
        (OTHER, 'Other'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, related_name='associate_doctor_profile')
    id_associate_doctor = models.AutoField(primary_key=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)
    # name, last_name, and email are inherited from the base User model
    address = models.CharField(max_length=100)
    phone = models.CharField(max_length=100)
    
    # Critical security field: enforced unique across the database
    professional_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    university = models.CharField(max_length=100, null=True, blank=True)
    specialty = models.CharField(max_length=100, null=True, blank=True)
    
    # State tracking flags
    is_email_verified = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default=OTHER)
    
    def first_name(self):
        """Helper property to access the underlying user's first name."""
        return self.user.first_name
    
    def last_name(self):
        """Helper property to access the underlying user's last name."""
        return self.user.last_name

    def __str__(self):
        """
        String representation used in the Django Admin and UI dropdowns.
        Automatically prefixes gender-appropriate titles in Spanish.
        """
        if self.user:
            prefix = 'Dra.' if self.gender == self.FEMALE else 'Dr.'
            return f"{prefix} {self.user.first_name} {self.user.last_name}"
        return f"Doctor Asociado #{self.pk}"