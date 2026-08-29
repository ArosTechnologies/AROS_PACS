from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.shortcuts import redirect
from .models import User, PatientProfile, StaffProfile, Roles
from core.email_service import send_verification_email, _verify_token, send_welcome_email
from .aws_utils import kms_encrypt

class PatientRegistrationView(APIView):
    permission_classes = [] # Public endpoint

    @transaction.atomic
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')

        if not email or not password or not first_name:
            return Response({"error": "Email, password, and first_name are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        if User.objects.filter(email_hash=email).exists():
            return Response({"error": "Email already in use"}, status=status.HTTP_400_BAD_REQUEST)

        # Create user as inactive pending email verification
        user = User.objects.create_user(
            email_hash=email, 
            password=password, 
            email_encrypted=kms_encrypt(email)
        )
        user.is_active = False
        user.save()

        # Create patient profile
        PatientProfile.objects.create(
            user=user,
            first_name=first_name,
            last_name=last_name
        )

        # Send verification email
        try:
            send_verification_email(user, request)
        except Exception as e:
            # If email fails, we shouldn't necessarily rollback in a real system, but for now it's okay
            print(f"Error sending verification email: {e}")
            
        return Response({"message": "Registration successful. Please check your email to verify your account."}, status=status.HTTP_201_CREATED)


class PhysicianRegistrationView(APIView):
    permission_classes = [] # Public endpoint

    @transaction.atomic
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        cedula = request.data.get('cedula_profesional', '')
        specialty = request.data.get('specialty', 'Médico General')

        if not email or not password or not first_name or not cedula:
            return Response({"error": "Email, password, first_name, and cedula_profesional are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        if User.objects.filter(email_hash=email).exists():
            return Response({"error": "Email already in use"}, status=status.HTTP_400_BAD_REQUEST)

        # Role assignment (ensure the role exists or create it)
        role, _ = Roles.objects.get_or_create(name='Associate Doctor', defaults={'description': 'Médico Externo Asociado'})

        # Create user as inactive pending email verification and manual approval
        user = User.objects.create_user(
            email_hash=email, 
            password=password, 
            email_encrypted=kms_encrypt(email)
        )
        user.is_active = False
        user.role = role
        user.save()

        # Create staff profile
        StaffProfile.objects.create(
            user=user,
            first_name=first_name,
            last_name=last_name,
            cedula_profesional=cedula,
            specialty=specialty
        )

        # Send verification email
        try:
            send_verification_email(user, request)
        except Exception as e:
            print(f"Error sending verification email: {e}")
            
        return Response({"message": "Registration successful. Please check your email to verify your account."}, status=status.HTTP_201_CREATED)


from django.http import JsonResponse

class VerifyEmailView(APIView):
    permission_classes = [] # Public endpoint

    def get(self, request, token):
        user_id = _verify_token(token)
        if not user_id:
            return JsonResponse({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if user.is_active:
            # We can still redirect them to login if they are already active
            if hasattr(user, 'patient_profile'):
                return redirect('http://localhost:5174/login?verified=true')
            elif hasattr(user, 'staff_profile'):
                return redirect('http://localhost:5175/login?verified=true')
            return JsonResponse({"message": "Account already verified."}, status=status.HTTP_200_OK)

        # Logic separation based on roles
        if hasattr(user, 'patient_profile'):
            user.is_active = True
            user.save()
            send_welcome_email(user)
            return redirect('http://localhost:5174/login?verified=true') # Patient portal
            
        elif hasattr(user, 'staff_profile'):
            # Doctors remain inactive until AROS staff manually verifies their cedula
            # Just send them a welcome/notice email that their account is pending manual review
            # We don't change is_active yet!
            send_welcome_email(user) # In the future, this could be a specific "pending review" email
            return redirect('http://localhost:5175/login?verified=true&pending_approval=true') # Physician portal
            
        return JsonResponse({"message": "Account verification failed due to missing profile."}, status=status.HTTP_400_BAD_REQUEST)
