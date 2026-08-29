from django.db import models
from datetime import datetime

class StudyRequest(models.Model):
    """
    Study request local to the clinic.
    """
    id_request = models.AutoField(primary_key=True)
    aros_patient_id = models.CharField(max_length=255, default="", help_text="UUID of the AROS User/Patient")
    study_type = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    accession_number = models.CharField(max_length=100, unique=True, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['accession_number'], name='idx_studyreq_accession'),
        ]

class Report(models.Model):
    id_report = models.AutoField(primary_key=True)
    status = models.CharField(max_length=3, default='PEN')
    findings = models.TextField()
    conclusions = models.TextField()
    date = models.DateField(default=datetime.now)

class Study(models.Model):
    """
    Concrete DICOM study received from Orthanc.
    """
    id_study = models.AutoField(primary_key=True)
    study_uid = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        help_text="DICOM StudyInstanceUID"
    )
    pacs_url = models.CharField(max_length=500, blank=True, default='')
    study_date = models.DateField(null=True, blank=True)
    accession_number = models.CharField(max_length=100, null=True, blank=True)
    study_description = models.CharField(max_length=500, blank=True, default='')
    modality = models.CharField(max_length=20, blank=True, default='')
    
    study_request = models.ForeignKey(StudyRequest, on_delete=models.CASCADE, null=True, blank=True)
    report = models.ForeignKey(Report, on_delete=models.CASCADE, null=True, blank=True)
    aros_patient_id = models.CharField(max_length=255, default="", help_text="UUID of the AROS User/Patient")

    class Meta:
        indexes = [
            models.Index(fields=['aros_patient_id', 'study_date'], name='idx_study_patient_date'),
        ]
