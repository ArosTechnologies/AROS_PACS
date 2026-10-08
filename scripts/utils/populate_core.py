import os
import sys
import django

# setup django
sys.path.append("/Users/ivanvivas/Repositories/AROS/AROS_PACS/apps/core-api")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "arosPacs.settings")
django.setup()

from identity.models import ClinicRegistry, User, PatientProfile, StaffProfile, Roles

# Create Clinics
clinics_data = [
    {
        "slug": "aros-polanco",
        "name": "AROS Polanco",
        "address": "Av. Presidente Masaryk 123, Polanco, CDMX",
        "latitude": 19.4319,
        "longitude": -99.1963,
        "specialties": ["Radiología Digital", "Resonancia Magnética", "Mastografía"]
    },
    {
        "slug": "aros-roma",
        "name": "Centro de Diagnóstico Roma",
        "address": "Alvaro Obregón 250, Roma Norte, CDMX",
        "latitude": 19.4184,
        "longitude": -99.1643,
        "specialties": ["Tomografía TAC", "Ultrasonido", "Rayos X"]
    },
    {
        "slug": "aros-coyoacan",
        "name": "AROS Coyoacán",
        "address": "Av. Miguel Ángel de Quevedo 456, Coyoacán, CDMX",
        "latitude": 19.3468,
        "longitude": -99.1627,
        "specialties": ["Medicina Nuclear", "PET-CT", "Radiología Digital"]
    },
    {
        "slug": "aros-santafe",
        "name": "AROS Santa Fe",
        "address": "Vasco de Quiroga 3800, Santa Fe, CDMX",
        "latitude": 19.3621,
        "longitude": -99.2612,
        "specialties": ["Resonancia Magnética 3T", "Mastografía 3D"]
    },
    {
        "slug": "aros-pedregal",
        "name": "Clínica de Especialidades Pedregal",
        "address": "Periférico Sur 4121, Jardines del Pedregal, CDMX",
        "latitude": 19.3087,
        "longitude": -99.2066,
        "specialties": ["Tomografía Espectral", "Ultrasonido 4D"]
    }
]

for c in clinics_data:
    clinic, created = ClinicRegistry.objects.get_or_create(
        slug=c["slug"],
        defaults={
            "name": c["name"],
            "address": c["address"],
            "latitude": c["latitude"],
            "longitude": c["longitude"],
            "specialties": c["specialties"]
        }
    )
    if not created:
        clinic.name = c["name"]
        clinic.address = c["address"]
        clinic.latitude = c["latitude"]
        clinic.longitude = c["longitude"]
        clinic.specialties = c["specialties"]
        clinic.save()

print("Created clinics.")

# Ensure Patient and Doctor exist
demo_patients = [
    {"email": f"paciente{i}@demo.com", "password": "password123", "first": f"Paciente{i}", "last": "Demo"} for i in range(1, 11)
] + [{"email": "test@example.com", "password": "password", "first": "Test", "last": "Patient"}]

patient_ids = []
for p in demo_patients:
    try:
        user = User.objects.get(email_hash=p["email"])
    except User.DoesNotExist:
        user = User.objects.create_user(email_hash=p["email"], password=p["password"])
        PatientProfile.objects.create(
            user=user, 
            first_name=p["first"], 
            last_name=p["last"], 
            curp_or_mrn=f"{p['first'].upper()}12345"
        )
    patient_ids.append(user.id)

patient_user = User.objects.get(email_hash="test@example.com") # For the ID at the end
print(f"Created/Verified demo patients.")

demo_doctors = [{"email": f"doctor{i}@demo.com", "password": "password123", "first": f"Doctor{i}", "last": "Demo"} for i in range(1, 6)]
doctor_ids = []
for d in demo_doctors:
    try:
        doc_user = User.objects.get(email_hash=d["email"])
    except User.DoesNotExist:
        doc_user = User.objects.create_user(email_hash=d["email"], password=d["password"])
        StaffProfile.objects.create(
            user=doc_user, 
            first_name=d["first"], 
            last_name=d["last"], 
            specialty="Radiología"
        )
    doctor_ids.append(doc_user.id)

doctor_user = User.objects.get(email_hash="doctor1@demo.com")
print(f"Created/Verified demo doctors. First Doctor ID: {doctor_user.id}")

with open('/tmp/aros_ids.txt', 'w') as f:
    f.write(f"{patient_user.id}\n{doctor_user.id}")
