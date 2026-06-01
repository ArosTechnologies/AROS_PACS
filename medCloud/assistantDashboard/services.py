"""
Domain Services for the Assistant Dashboard.
Extracts business logic from HTTP views to ensure Single Responsibility Principle (SRP)
and facilitate decoupled operations.
"""
import secrets
import string
from django.contrib.auth.models import User, Group
from patientsDashboard.models import Patient
from associateDoctorDashboard.models import AssociateDoctor
from core.notifications import notify_study_request_created, notify_doctor_approved, notify_doctor_denied
from core.email_service import send_verification_email, send_doctor_approved_email, send_doctor_denied_email

class AssistantService:
    @staticmethod
    def create_study_request_service(study_request, patient):
        """
        Saves a local study request and dispatches internal notifications.
        Does NOT integrate with external PACS/RIS.
        """
        study_request.id_patient = patient
        study_request.save()
        
        # Notify connected clients (Assistants, Doctors) via WebSocket
        try:
            notify_study_request_created(study_request)
        except Exception:
            pass  # Fail gracefully to not halt creation flow

    @staticmethod
    def create_patient_service(first_name, last_name, email, phone, gender, address, request=None):
        """
        Creates a new Patient record and underlying auth User.
        """
        if User.objects.filter(email=email).exists():
            return False, ['Ya existe un usuario con este correo electrónico.']

        # Generate an unguessable placeholder password
        random_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))

        # Provision base user identity
        user = User.objects.create_user(
            username=email,
            email=email,
            password=random_password,
            first_name=first_name,
            last_name=last_name,
        )
        user.is_active = False # Account locked until email verification
        user.save()

        # Assign Django security role
        group, _ = Group.objects.get_or_create(name='Patients')
        user.groups.add(group)

        # Provision Patient profile data
        patient = Patient.objects.create(
            user=user,
            address=address,
            phone=phone,
            gender=gender,
        )

        # Dispatch welcome & verification email
        try:
            send_verification_email(user, request)
        except Exception:
            pass  # Catch email failures silently

        return True, patient

    @staticmethod
    def verify_doctor_service(doctor_id, action):
        """
        Approves or denies an Associate Doctor.
        """
        try:
            doctor = AssociateDoctor.objects.get(pk=doctor_id)
            user = doctor.user
        except (AssociateDoctor.DoesNotExist, ValueError, TypeError):
            return False, 'Doctor no encontrado.'

        if action == 'approve':
            doctor.is_verified = True
            doctor.save()

            user.is_active = True
            user.save()

            # Alert the ecosystem asynchronously
            notify_doctor_approved(doctor)
            try:
                send_doctor_approved_email(user)
            except Exception:
                pass # Fail gracefully 

            return True, 'Doctor aprobado exitosamente.'

        elif action == 'deny':
            # Store necessary data in memory before deletion
            doctor_pk = doctor.pk
            doctor_email = user.email
            doctor_name = f"{user.first_name} {user.last_name}"

            # Hard destruction of credentials
            doctor.delete()
            user.delete()

            # Alert the ecosystem asynchronously
            notify_doctor_denied(doctor_pk)
            try:
                send_doctor_denied_email(doctor_email, doctor_name)
            except Exception:
                pass

            return True, 'Doctor rechazado y eliminado exitosamente.'
        
        return False, 'Acción inválida.'
