from django.db import models
from datetime import datetime

class PatientProfile(models.Model):
    """
    PHI Data resides here. This is the local patient in the clinic.
    """
    MALE = 'M'
    FEMALE = 'F'
    OTHER = 'O'
    GENDER_CHOICES = [
        (MALE, 'Male'),
        (FEMALE, 'Female'),
        (OTHER, 'Other'),
    ]
    
    id_patient = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    address = models.CharField(max_length=100)
    phone = models.CharField(max_length=100)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default=OTHER)
    mrn = models.CharField(max_length=50, null=True, blank=True, unique=True)
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class StudyRequest(models.Model):
    """
    Study request local to the clinic.
    """
    id_request = models.AutoField(primary_key=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE)
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
    pacs_url = models.CharField(max_length=500, blank=True, default='')
    date = models.DateField()
    accession_number = models.CharField(max_length=100, null=True, blank=True)
    
    study_request = models.ForeignKey(StudyRequest, on_delete=models.CASCADE)
    report = models.ForeignKey(Report, on_delete=models.CASCADE, null=True, blank=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE)

    class Meta:
        indexes = [
            models.Index(fields=['patient', 'date'], name='idx_study_patient_date'),
        ]
