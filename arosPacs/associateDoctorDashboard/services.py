"""
Domain Services for the Associate Doctor Dashboard.
Extracts business logic (dual-model creation, email dispatch) from HTTP views 
to ensure Single Responsibility Principle (SRP) and High Cohesion.
"""
from django.contrib.auth.models import User
from .models import AssociateDoctor
from core.email_service import send_verification_email

class AssociateDoctorService:
    @staticmethod
    def register_doctor(cleaned_data, request=None):
        """
        Handles the transaction of creating the User, locking the account, 
        creating the AssociateDoctor profile, and firing the verification email.
        """
        # 1. Create base user instance
        user = User.objects.create_user(
            username=cleaned_data['email'], 
            email=cleaned_data['email'],
            password=cleaned_data['password'],
            first_name=cleaned_data['first_name'],
            last_name=cleaned_data['last_name']
        )
        # Deactivate user until email is verified
        user.is_active = False
        user.save()
        
        # 2. Instantiate profile
        doctor = AssociateDoctor.objects.create(
            user=user,
            address=cleaned_data.get('address', ''),
            phone=cleaned_data.get('phone', ''),
            university=cleaned_data.get('university', ''),
            professional_id=cleaned_data.get('professional_id', ''),
            specialty=cleaned_data.get('specialty', '')
        )
        
        # 3. Dispatch verification email to confirm address ownership
        try:
            send_verification_email(user, request)
        except Exception:
            pass  # Catch email failures silently
            
        return doctor
