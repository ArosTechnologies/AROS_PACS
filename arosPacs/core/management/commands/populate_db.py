import random
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
from django.db import transaction
from patientsDashboard.models import Patient
from doctorsDashboard.models import ReportingDoctor
from associateDoctorDashboard.models import AssociateDoctor
from assistantDashboard.models import Assistant, StudyRequest
from core.models import Study, Report

# Constants
PACS_URL = "https://images.grupoptm.com/?sp=dcb37163-de37-4856-83f0-7abb4db2a229&org=GPTM&wf=68e558107712dd7d0a0fbbb6&suid=1.2.840.113619.2.227.207924731240.21703251007104128.20000&aet=GPTMRADIOG&et=20&ep=eb4b0906-034b-4ddd-b5bb-4a51fbeaf810"

NAMES = ["Juan", "Maria", "Carlos", "Ana", "Luis", "Elena", "Pedro", "Sofia", "Miguel", "Lucia"]
LAST_NAMES = ["Garcia", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Perez", "Sanchez", "Ramirez", "Torres"]
SPECIALTIES = ["Radiology", "Cardiology", "Neurology", "Orthopedics"]
GENDERS = ["M", "F", "O"]

class Command(BaseCommand):
    help = 'Populates the database with sample data'

    def handle(self, *args, **kwargs):
        self.stdout.write('Starting data population...')
        
        with transaction.atomic():
            self.create_groups()
            self.create_superuser()
            reporting_doctors = self.create_reporting_doctors()
            associate_doctors = self.create_associate_doctors()
            assistants = self.create_assistant()
            patients = self.create_patients(associate_doctors)
            self.create_studies(patients, associate_doctors, reporting_doctors)
            
        self.stdout.write(self.style.SUCCESS('Data population completed successfully!'))

    def create_groups(self):
        Group.objects.get_or_create(name='Doctors') # Reporting Doctors
        Group.objects.get_or_create(name='Patients')
        Group.objects.get_or_create(name='Assistants')
        Group.objects.get_or_create(name='AssociatedDoctors')

    def create_superuser(self):
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@example.com', 'admin')
            self.stdout.write('Created superuser: admin/admin')

    def create_user(self, username, email, first_name, last_name, group_name):
        user, created = User.objects.get_or_create(username=username, defaults={
            'email': email,
            'first_name': first_name,
            'last_name': last_name
        })
        if created:
            user.set_password('pass1234')
            user.save()
            group = Group.objects.get(name=group_name)
            user.groups.add(group)
        return user

    def create_reporting_doctors(self):
        doctors = []
        for i in range(2):
            user = self.create_user(
                f'report_doc_{i}',
                f'report_doc_{i}@example.com',
                random.choice(NAMES),
                random.choice(LAST_NAMES),
                'Doctors'
            )
            doctor, _ = ReportingDoctor.objects.get_or_create(
                user=user,
                defaults={
                    'address': f'Hospital St {i}',
                    'phone': f'555-000{i}',
                    'university': 'UNAM',
                    'professional_id': f'PROF{i}999',
                    'specialty': 'Radiology'
                }
            )
            doctors.append(doctor)
        return doctors

    def create_associate_doctors(self):
        doctors = []
        for i in range(3):
            user = self.create_user(
                f'assoc_doc_{i}',
                f'assoc_doc_{i}@example.com',
                random.choice(NAMES),
                random.choice(LAST_NAMES),
                'AssociatedDoctors'
            )
            # Check if using AuthField or CharField for PK based on recent changes
            # Since we migrated to AutoField, we don't set id_associate_doctor manually
            doctor, _ = AssociateDoctor.objects.get_or_create(
                user=user,
                defaults={
                    'address': f'Clinic St {i}',
                    'phone': f'555-100{i}',
                    'university': 'La Salle',
                    'professional_id': f'ASC{i}888'
                }
            )
            doctors.append(doctor)
        return doctors
    
    def create_assistant(self):
        user = self.create_user(
            'assistant_1',
            'assist_1@example.com',
            'Assist',
            'Ant',
            'Assistants'
        )
        assistant, _ = Assistant.objects.get_or_create(
            user=user,
            defaults={
                'address': 'Lab Front Desk',
                'phone': '555-9999'
            }
        )
        return [assistant]

    def create_patients(self, associate_doctors):
        patients = []
        for i in range(10):
            user = self.create_user(
                f'patient_{i}',
                f'patient_{i}@example.com',
                random.choice(NAMES),
                random.choice(LAST_NAMES),
                'Patients'
            )
            patient, created = Patient.objects.get_or_create(
                user=user,
                defaults={
                    'address': f'Home St {i}',
                    'phone': f'555-200{i}',
                    'gender': random.choice(GENDERS)
                }
            )
            
            # Associate with some doctors
            if created:
                docs = random.sample(associate_doctors, k=random.randint(1, 2))
                patient.associated_doctors.set(docs)
                
            patients.append(patient)
        return patients

    def create_studies(self, patients, associate_doctors, reporting_doctors):
        study_types = ["Torax PA", "Mamografía", "Marcaje de Mama", "Abdomen Superior", "AngioTac"]
        
        for patient in patients:
            num_studies = random.randint(1, 3)
            for j in range(num_studies):
                # 1. Create Study Request
                assoc_doc = patient.associated_doctors.first()
                if not assoc_doc:
                    assoc_doc = associate_doctors[0]
                
                # We need a unique ID for request
                req_id = int(f"{patient.id_patient}{j}{random.randint(100,999)}")
                
                request, _ = StudyRequest.objects.get_or_create(
                    id_solicitud_estudio=req_id,
                    defaults={
                        'diagnosis': "Pain and discomfort",
                        'requested_study': random.choice(study_types),
                        'id_patient': patient,
                        'id_associate_doctor': assoc_doc
                    }
                )

                # 2. Decide if report is completed (70% chance)
                report = None
                is_completed = random.random() < 0.7
                
                if is_completed:
                    report = Report.objects.create(
                        status=Report.COMPLETED,
                        about=request.requested_study,
                        patients_description="Patient complains of functionality issues",
                        findings="Normal study results found in general inspection.",
                        conclusions="No significant pathologies detected.",
                        recommendations="Follow up in 6 months.",
                        date=datetime.now().date() - timedelta(days=random.randint(1, 30)),
                        doctor_in_charge=random.choice(reporting_doctors)
                    )
                
                # 3. Create Study
                study_date = datetime.now().date() - timedelta(days=random.randint(1, 60))
                if report:
                    study_date = report.date # Study matches report date roughly
                
                Study.objects.create(
                    pacs_url=PACS_URL,
                    email_sent=True,
                    date=study_date,
                    id_study_request=request,
                    id_report=report,
                    id_patient=patient
                )
