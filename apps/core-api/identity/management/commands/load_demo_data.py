import uuid
from django.core.management.base import BaseCommand
from identity.models import User, StaffProfile, PatientProfile, ClinicRegistry, Roles, FederationIDMap
from django.utils import timezone

class Command(BaseCommand):
    help = 'Carga datos de demostración para prospectos de clientes (Clínica, Usuarios, Pacientes y Médicos)'

    def handle(self, *args, **kwargs):
        self.stdout.write('Iniciando carga de datos de demostración...')

        # 1. Crear Roles
        roles_data = ['Radiólogo', 'Asistente', 'Administrador', 'Médico Asociado', 'Paciente']
        for role_name in roles_data:
            Roles.objects.get_or_create(name=role_name)

        # 2. Crear Clínica Demo
        clinic, created = ClinicRegistry.objects.get_or_create(
            slug='demo',
            defaults={
                'name': 'AROS Demo Clinic',
                'primary_color': '#0284c7',
                'address': 'Av. Demostración 123, Tech, CDMX',
                'phone': '+52 55 0000 0000',
                'email': 'demo@aros.com'
            }
        )
        if created:
            self.stdout.write(f'Clínica creada: {clinic.name}')

        # Helpers
        def create_staff(email, role_name, first, last, password='password123'):
            role = Roles.objects.get(name=role_name)
            user, u_created = User.objects.get_or_create(
                email_hash=email,
                defaults={'email_encrypted': email, 'role': role}
            )
            if u_created:
                user.set_password(password)
                user.save()
                StaffProfile.objects.create(
                    user=user,
                    first_name=first,
                    last_name=last
                )
                self.stdout.write(f'Staff creado: {email} ({role_name})')
            return user

        def create_patient(email, first, last, password='password123'):
            role = Roles.objects.get(name='Paciente')
            user, u_created = User.objects.get_or_create(
                email_hash=email,
                defaults={'email_encrypted': email, 'role': role}
            )
            if u_created:
                user.set_password(password)
                user.save()
                PatientProfile.objects.create(
                    user=user,
                    first_name=first,
                    last_name=last,
                    curp_or_mrn=f'MRN-{uuid.uuid4().hex[:6]}'
                )
                FederationIDMap.objects.create(
                    user=user,
                    clinic=clinic,
                    local_patient_id=f'LOC-{uuid.uuid4().hex[:6]}'
                )
                self.stdout.write(f'Paciente creado: {email}')
            return user

        # 3. Crear Staff (Clinic Portal)
        create_staff('superadmin@clinica.com', 'Administrador', 'Super', 'Admin')
        create_staff('admin@clinica.com', 'Administrador', 'Jefe', 'Clínica')
        create_staff('radiologo@clinica.com', 'Radiólogo', 'Dr.', 'Pérez')
        create_staff('asistente@clinica.com', 'Asistente', 'María', 'López')

        # 4. Crear Médicos (Physician Portal)
        create_staff('doctor1@demo.com', 'Médico Asociado', 'Dr. Roberto', 'Gómez')
        create_staff('doctor2@demo.com', 'Médico Asociado', 'Dra. Ana', 'Martínez')

        # 5. Crear Pacientes (Patient Portal)
        create_patient('paciente1@demo.com', 'Juan', 'Pérez')
        create_patient('paciente2@demo.com', 'Laura', 'García')
        create_patient('paciente3@demo.com', 'Carlos', 'Ruiz')

        self.stdout.write(self.style.SUCCESS('¡Datos de demostración cargados exitosamente!'))
