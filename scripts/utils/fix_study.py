import os
import sys
import django
import datetime

sys.path.append('/Users/ivanvivas/Repositories/AROS_PACS/apps/clinic-api')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'clinic_api.settings')
django.setup()

from clinical_data.models import Study, Report

# Delete existing studies for patient so we can start fresh
patient_id = sys.argv[1]
Study.objects.filter(aros_patient_id=patient_id).delete()

report = Report.objects.create(
    findings="Silueta cardiomediastínica de tamaño y morfología conservados.\nBotón aórtico normal.\nHilios pulmonares sin alteraciones.\nTrama vascular pulmonar de distribución normal.\nNo se observan opacidades parenquimatosas sugerentes de consolidación, nódulos ni masas.\nSenos costofrénicos y cardiofrénicos libres.\nEstructuras óseas sin lesiones líticas ni blásticas agudas visibles en el presente estudio.",
    conclusions="Estudio radiológico de tórax dentro de límites normales. No se evidencia patología cardiopulmonar aguda.",
    status='FIN'
)

study = Study.objects.create(
    aros_patient_id=patient_id,
    study_uid='1.2.826.0.1.3680043.8.1055.1.20111103112244831.40200514.30965937', 
    study_date=datetime.date.today(),
    modality='CR',
    study_description='RADIOGRAFIA DE TORAX PA',
    accession_number='ACC123456789',
    report=report
)
print("Study created successfully.")
