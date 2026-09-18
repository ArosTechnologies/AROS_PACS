import requests
import json
from django.core.management.base import BaseCommand
from django.conf import settings
from clinical_data.models import Study, Report
import random

class Command(BaseCommand):
    help = 'Syncs studies from Orthanc and creates fake reports for some.'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Syncing studies from Orthanc...'))
        
        orthanc_url = "http://localhost:8042"
        auth = ("orthanc", "orthanc")
        
        try:
            # Get all studies from Orthanc
            res = requests.get(f"{orthanc_url}/studies", auth=auth)
            res.raise_for_status()
            study_ids = res.json()
            
            created_count = 0
            reports_count = 0
            patient_counts = {}
            for resource_id in study_ids:
                study_data = requests.get(f"{orthanc_url}/studies/{resource_id}", auth=auth).json()
                
                patient_tags = study_data.get('PatientMainDicomTags', {})
                study_main_tags = study_data.get('MainDicomTags', {})
                
                series_list = study_data.get('Series', [])
                modality = ""
                if series_list:
                    series_tags = requests.get(f"{orthanc_url}/series/{series_list[0]}", auth=auth).json()
                    modality = series_tags.get('MainDicomTags', {}).get('Modality', '')
                
                patient_id_str = patient_tags.get('PatientID', '')
                study_uid = study_main_tags.get('StudyInstanceUID', '')
                
                if not patient_id_str or not study_uid:
                    continue
                    
                if patient_counts.get(patient_id_str, 0) >= 5:
                    continue
                
                study_desc = study_main_tags.get('StudyDescription', '')
                
                # Parse study date from DICOM (YYYYMMDD)
                study_date_str = study_main_tags.get("StudyDate", "")
                parsed_date = None
                if study_date_str and len(study_date_str) == 8:
                    from datetime import datetime
                    try:
                        parsed_date = datetime.strptime(study_date_str, "%Y%m%d").date()
                    except ValueError:
                        pass
                
                # Create study record
                study, created = Study.objects.get_or_create(
                    study_uid=study_uid,
                    defaults={
                        "aros_patient_id": patient_id_str,
                        "accession_number": study_main_tags.get("AccessionNumber", ""),
                        "study_description": study_desc,
                        "study_date": parsed_date,
                        "modality": modality,
                        "pacs_url": f"{settings.ORTHANC_WADO_URL}/studies/{study_uid}"
                    }
                )
                
                if created:
                    created_count += 1
                
                # Keep track of counts per patient
                patient_counts[patient_id_str] = patient_counts.get(patient_id_str, 0) + 1
                
                # Check if it should have a report (from demo data desc)
                if "Pendiente" not in study_desc and patient_counts[patient_id_str] % 3 != 0:
                    if not study.report:
                        rep = Report.objects.create(
                            status='COM',
                            findings='<p>Se observan estructuras anatómicas dentro de los límites normales. No hay evidencia de lesiones focales o difusas agudas en el estudio actual.</p>',
                            conclusions='<p>Estudio sin alteraciones patológicas significativas.</p>'
                        )
                        study.report = rep
                        study.save()
                        reports_count += 1
                else:
                    if not study.report:
                        rep = Report.objects.create(
                            status='PEN',
                            findings='',
                            conclusions=''
                        )
                        study.report = rep
                        study.save()
                        reports_count += 1
                        
            self.stdout.write(self.style.SUCCESS(f'Successfully created {created_count} studies and {reports_count} reports.'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error syncing from Orthanc: {str(e)}'))
