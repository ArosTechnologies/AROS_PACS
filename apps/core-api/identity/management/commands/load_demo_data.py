import uuid
import os
import glob
import json
import base64
import random
import io
import requests
from django.core.management.base import BaseCommand
from identity.models import User, StaffProfile, PatientProfile, ClinicRegistry, Roles, FederationIDMap

class Command(BaseCommand):
    help = 'Carga datos de demostración masivos y genera estudios DICOM simulados'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Iniciando carga masiva de datos de demostración...'))

        # 1. Crear Roles
        roles_data = ['Radiólogo', 'Asistente Médico', 'Administrador', 'Superadministrador', 'Médico Asociado', 'Paciente']
        for role_name in roles_data:
            Roles.objects.get_or_create(name=role_name)
            
        self.stdout.write('Roles creados.')

        # 2. Crear Clínicas en CDMX
        clinics_info = [
            {'slug': 'cdmx-norte', 'name': 'Clínica Norte CDMX', 'color': '#0ea5e9', 'address': 'Av. Insurgentes Nte. 123, CDMX', 'lat': 19.48, 'lon': -99.13},
            {'slug': 'cdmx-sur', 'name': 'Clínica Sur CDMX', 'color': '#22c55e', 'address': 'Periférico Sur 456, CDMX', 'lat': 19.30, 'lon': -99.18},
            {'slug': 'cdmx-centro', 'name': 'Clínica Centro CDMX', 'color': '#f59e0b', 'address': 'Paseo de la Reforma 789, CDMX', 'lat': 19.43, 'lon': -99.16},
            {'slug': 'cdmx-oriente', 'name': 'Clínica Oriente CDMX', 'color': '#ef4444', 'address': 'Zaragoza 101, CDMX', 'lat': 19.40, 'lon': -99.07},
            {'slug': 'cdmx-poniente', 'name': 'Clínica Poniente CDMX', 'color': '#8b5cf6', 'address': 'Av. Santa Fe 202, CDMX', 'lat': 19.36, 'lon': -99.26},
        ]

        created_clinics = []
        for c in clinics_info:
            clinic, _ = ClinicRegistry.objects.get_or_create(
                slug=c['slug'],
                defaults={
                    'name': c['name'],
                    'primary_color': c['color'],
                    'address': c['address'],
                    'phone': '+52 55 1234 5678',
                    'email': f"contacto@{c['slug']}.com",
                    'latitude': c['lat'],
                    'longitude': c['lon'],
                    'specialties': ['Radiología Digital', 'Tomografía', 'Resonancia Magnética']
                }
            )
            created_clinics.append(clinic)
        
        self.stdout.write('5 Clínicas creadas.')

        # 3. Helper para crear usuarios
        def create_user(email, role_name, first, last, cedula='', specialty='', clinic_obj=None):
            role = Roles.objects.get(name=role_name)
            user, u_created = User.objects.get_or_create(
                email_hash=email,
                defaults={'email_encrypted': email, 'role': role}
            )
            if u_created:
                user.set_password('password123')
                user.save()
                
            if role_name == 'Paciente':
                profile, _ = PatientProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'first_name': first,
                        'last_name': last,
                        'curp_or_mrn': f"{first[:2].upper()}{last[:2].upper()}{uuid.uuid4().hex[:6].upper()}"
                    }
                )
            else:
                profile, _ = StaffProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'first_name': first,
                        'last_name': last,
                        'cedula_profesional': cedula,
                        'specialty': specialty,
                        'clinic': clinic_obj
                    }
                )
            return user, profile

        # 4. Crear Staff por clínica
        credentials = []
        for clinic in created_clinics:
            
            # Superadmin
            em = f"superadmin@{clinic.slug}.com"
            create_user(em, 'Superadministrador', 'Super', f"Admin {clinic.name}", clinic_obj=clinic)
            credentials.append(f"- **Superadmin {clinic.name}**: `{em}` / `password123`")
            
            # Admin
            em = f"admin@{clinic.slug}.com"
            create_user(em, 'Administrador', 'Admin', f"{clinic.name}", clinic_obj=clinic)
            credentials.append(f"- **Admin {clinic.name}**: `{em}` / `password123`")
            
            # Radiologist
            em = f"radiologo@{clinic.slug}.com"
            create_user(em, 'Radiólogo', 'Dr.', f"Rad {clinic.name}", cedula="1234567", specialty="Radiología", clinic_obj=clinic)
            credentials.append(f"- **Radiólogo {clinic.name}**: `{em}` / `password123`")
            
            # Assistant
            em = f"asistente@{clinic.slug}.com"
            create_user(em, 'Asistente Médico', 'Asis', f"{clinic.name}", clinic_obj=clinic)
            credentials.append(f"- **Asistente Clínica {clinic.name}**: `{em}` / `password123`")

        # 5. Crear Médicos Asociados (sin pacientes)
        credentials.append("\n### Médicos Asociados")
        for i in range(1, 6):
            em = f"doctor{i}@demo.com"
            create_user(em, 'Médico Asociado', f"Dr. {i}", "Demo", cedula=f"99900{i}", specialty="Traumatología")
            credentials.append(f"- **Doctor {i}**: `{em}` / `password123`")

        # 6. Crear Pacientes
        credentials.append("\n### Pacientes")
        patients = []
        for i in range(1, 11):
            em = f"paciente{i}@demo.com"
            u, p = create_user(em, 'Paciente', f"Paciente {i}", "Demo")
            patients.append((u, p))
            credentials.append(f"- **Paciente {i}**: `{em}` / `password123`")

        # Asignar federación para los pacientes en las clínicas al azar
        for u, p in patients:
            clinic = random.choice(created_clinics)
            FederationIDMap.objects.get_or_create(
                user=u,
                clinic=clinic,
                defaults={'local_patient_id': p.curp_or_mrn}
            )

        # 7. DICOM Generation
        try:
            import pydicom
            from pydicom.uid import generate_uid
        except ImportError:
            self.stdout.write(self.style.ERROR('pydicom no está instalado. Instalalo para generar los estudios.'))
            return

        orthanc_url = "http://localhost:8042"
        auth = ("orthanc", "orthanc")
        dicom_dir = "/Users/ivanvivas/Repositories/AROS/AROS_PACS/manifest-1789535211368/cmb_brca"
        dicom_files = glob.glob(f"{dicom_dir}/**/*.dcm", recursive=True)

        if not dicom_files:
            self.stdout.write(self.style.ERROR(f'No se encontraron archivos DICOM en {dicom_dir}'))
            return

        self.stdout.write(f'Generando 75 estudios a partir de {len(dicom_files)} imágenes base...')

        study_configs = []
        norte_clinic = next(c for c in created_clinics if c.slug == 'cdmx-norte')

        # 10 pacientes * 5 estudios = 50 estudios
        for _, patient in patients:
            # 1 pendiente (Worklist) en Clínica Norte
            study_configs.append({
                'clinic': norte_clinic,
                'patient': patient,
                'modality': 'US',
                'desc': f'Ultrasonido Pendiente - {norte_clinic.name}'
            })
            # 4 completados (Reporte) en Clínica Norte
            for _ in range(4):
                study_configs.append({
                    'clinic': norte_clinic,
                    'patient': patient,
                    'modality': 'MR',
                    'desc': f'Resonancia Magnética - {norte_clinic.name}'
                })

        total_uploaded = 0
        for i, conf in enumerate(study_configs):
            patient_profile = conf['patient']
            new_study_uid = generate_uid()
            acc_num = f"ACC-{uuid.uuid4().hex[:6].upper()}"

            for dcm_path in dicom_files:
                try:
                    ds = pydicom.dcmread(dcm_path)
                    
                    # Update metadata
                    ds.PatientID = patient_profile.curp_or_mrn
                    ds.PatientName = f"{patient_profile.last_name}^{patient_profile.first_name}"
                    ds.StudyInstanceUID = new_study_uid
                    ds.SeriesInstanceUID = generate_uid()
                    ds.SOPInstanceUID = generate_uid()
                    ds.AccessionNumber = acc_num
                    ds.Modality = conf['modality']
                    ds.StudyDescription = conf['desc']
                    ds.InstitutionName = conf['clinic'].name

                    from datetime import datetime
                    now = datetime.now()
                    ds.StudyDate = now.strftime("%Y%m%d")
                    ds.StudyTime = now.strftime("%H%M%S")

                    # Ensure we save explicitly to a buffer with the correct transfer syntax
                    if not getattr(ds.file_meta, 'TransferSyntaxUID', None):
                        ds.file_meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian
                    
                    buf = io.BytesIO()
                    pydicom.dcmwrite(buf, ds, write_like_original=False)
                    buf.seek(0)

                    res = requests.post(
                        f"{orthanc_url}/instances",
                        auth=auth,
                        data=buf,
                        headers={"Content-Type": "application/dicom"}
                    )
                    res.raise_for_status()
                    total_uploaded += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error subiendo DICOM modificado: {str(e)}'))

            if (i+1) % 15 == 0:
                self.stdout.write(f'  ... {i+1}/75 estudios completados.')

        self.stdout.write(self.style.SUCCESS(f'¡Carga completa! Se subieron {total_uploaded} archivos DICOM simulados a Orthanc.'))

        # 8. Escribir credentials.md
        creds_path = "/Users/ivanvivas/Repositories/AROS/AROS_PACS/credentials.md"
        with open(creds_path, "w") as f:
            f.write("# Credenciales de Demostración AROS PACS\n\n")
            f.write("A continuación se listan las credenciales autogeneradas para los distintos roles.\n\n")
            f.write("### Clínicas (Staff)\n")
            for c in credentials:
                f.write(f"{c}\n")
        
        self.stdout.write(self.style.SUCCESS(f'Credenciales documentadas en: {creds_path}'))

        import subprocess
        self.stdout.write(self.style.WARNING('Ejecutando sync_demo_studies en Clinic API para sincronizar reportes...'))
        try:
            env = os.environ.copy()
            env.pop('DJANGO_SETTINGS_MODULE', None)
            subprocess.run(["apps/clinic-api/.venv/bin/python", "apps/clinic-api/manage.py", "sync_demo_studies"], env=env, check=True)
            self.stdout.write(self.style.SUCCESS('sync_demo_studies completado correctamente.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error al ejecutar sync_demo_studies: {str(e)}'))

