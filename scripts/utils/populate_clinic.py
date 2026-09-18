import os
import sys
import django
import urllib.request
import urllib.parse
import json
from datetime import datetime

# setup django
sys.path.append("/Users/ivanvivas/Repositories/AROS/AROS_PACS/apps/clinic-api")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "clinic_api.settings")
django.setup()

from clinical_data.models import Study, StudyRequest, Report

# Read IDs from tmp
with open('/tmp/aros_ids.txt', 'r') as f:
    lines = f.read().splitlines()
    patient_id = lines[0]
    doctor_id = lines[1]

# Upload DICOMs and populate Study
ORTHANC_URL = "http://localhost:8042/instances"
MANIFEST_DIR = "/Users/ivanvivas/Repositories/AROS/AROS_PACS/manifest-1789535211368/cmb_brca"

uploaded_instances = []
for root, dirs, files in os.walk(MANIFEST_DIR):
    for file in files:
        if file.endswith(".dcm"):
            filepath = os.path.join(root, file)
            print(f"Uploading {filepath}...")
            with open(filepath, 'rb') as f:
                data = f.read()
                req = urllib.request.Request(ORTHANC_URL, data=data, method='POST')
                # Add basic auth
                import base64
                auth = base64.b64encode(b'orthanc:orthanc').decode('utf-8')
                req.add_header('Authorization', f'Basic {auth}')
                try:
                    with urllib.request.urlopen(req) as response:
                        if response.status == 200:
                            res_data = json.loads(response.read().decode('utf-8'))
                            parent_study = res_data.get("ParentStudy")
                            if parent_study:
                                study_req = urllib.request.Request(f"http://localhost:8042/studies/{parent_study}")
                                study_req.add_header('Authorization', f'Basic {auth}')
                                with urllib.request.urlopen(study_req) as study_res:
                                    study_info = json.loads(study_res.read().decode('utf-8'))
                                    tags = study_info.get("MainDicomTags", {})
                                    
                                    study_uid = tags.get("StudyInstanceUID")
                                    study_date = tags.get("StudyDate", "20240101")
                                    study_desc = tags.get("StudyDescription", "Mamografía de Control")
                                    accession = tags.get("AccessionNumber", f"ACC-{study_uid[:6]}")
                                    
                                    if len(study_date) == 8:
                                        study_date = f"{study_date[:4]}-{study_date[4:6]}-{study_date[6:8]}"
                                        
                                    uploaded_instances.append({
                                        "study_uid": study_uid,
                                        "date": study_date,
                                        "desc": study_desc,
                                        "accession": accession,
                                        "modality": "MG"
                                    })
                except Exception as e:
                    print(f"Failed to upload: {e}")

# Deduplicate
unique_studies = {s["study_uid"]: s for s in uploaded_instances}

# Create records
for uid, s in unique_studies.items():
    # Create study request
    req, _ = StudyRequest.objects.get_or_create(
        accession_number=s["accession"],
        defaults={
            "aros_patient_id": patient_id,
            "study_type": s["desc"]
        }
    )
    
    # Create report
    report, _ = Report.objects.get_or_create(
        id_report=req.id_request,
        defaults={
            "status": "COM",
            "findings": "Tejido fibroglandular disperso. No se observan nódulos dominantes ni microcalcificaciones sospechosas de malignidad.",
            "conclusions": "BI-RADS 2: Hallazgos benignos. Se sugiere control anual.",
            "date": s["date"] if len(s["date"]) == 10 else datetime.now().date()
        }
    )
    
    # Create study
    Study.objects.get_or_create(
        study_uid=uid,
        defaults={
            "study_date": s["date"] if len(s["date"]) == 10 else None,
            "accession_number": s["accession"],
            "study_description": s["desc"],
            "modality": s["modality"],
            "study_request": req,
            "report": report,
            "aros_patient_id": patient_id
        }
    )

# Add extra mock studies to make it look populated
mock_studies = [
    {"desc": "RM Rodilla Derecha", "modality": "MR", "date": "2024-08-15", "status": "COM"},
    {"desc": "TAC de Cráneo", "modality": "CT", "date": "2024-09-02", "status": "COM"},
    {"desc": "USG Abdomen Superior", "modality": "US", "date": "2024-09-10", "status": "PEN"},
    {"desc": "Radiografía de Tórax", "modality": "CR", "date": "2024-09-14", "status": "PEN"}
]

import uuid
for idx, ms in enumerate(mock_studies):
    req, _ = StudyRequest.objects.get_or_create(
        accession_number=f"MOCK-ACC-{idx}",
        defaults={"aros_patient_id": patient_id, "study_type": ms["desc"]}
    )
    report, _ = Report.objects.get_or_create(
        id_report=req.id_request,
        defaults={"status": ms["status"], "findings": "Resultados de ejemplo...", "conclusions": "Conclusión de ejemplo...", "date": ms["date"]}
    )
    Study.objects.get_or_create(
        study_uid=str(uuid.uuid4()),
        defaults={
            "study_date": ms["date"],
            "accession_number": f"MOCK-ACC-{idx}",
            "study_description": ms["desc"],
            "modality": ms["modality"],
            "study_request": req,
            "report": report,
            "aros_patient_id": patient_id
        }
    )

print(f"Populated {len(unique_studies)} unique studies from DICOM and {len(mock_studies)} mock studies.")
