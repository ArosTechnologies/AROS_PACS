"""
Models for the Assistant Dashboard.
Defines the Assistant user profile and the StudyRequest entity which represents
a patient's request for a radiological study before the actual DICOM images arrive.
"""
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import secrets
import string

class Assistant(models.Model):
    """
    Profile model for front-desk and administrative staff.
    Extends the standard Django User model with a OneToOne relationship.
    Provides additional fields applicable to hospital staff.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, related_name='assistant_profile')
    id_assistant = models.AutoField(primary_key=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)
    # name and last name are in the base auth User model
    address = models.CharField(max_length=100)
    phone = models.CharField(max_length=100)

    def __str__(self):
        return f"Assistant Profile {self.id_assistant}"

class StudyRequest(models.Model):
    """
    Represents an initial request or ticket for a radiological study.
    Created by an Assistant at the front desk when a Patient arrives.
    This record is later synchronized by a background worker with the Raditech PACS API
    to create a concrete 'core.Study' instance once the DICOM images are available.
    """
    REQUESTED_STUDY_CHOICES = [
        ("Rayos X", (
            ("Torax PA", "Torax PA"),
            ("Torax PA y lat", "Torax PA y lat"),
            ("Abdomen de cúbito", "Abdomen de cúbito"),
            ("Abdomen de pie", "Abdomen de pie"),
            ("Cráneo Ap y lat", "Cráneo Ap y lat"),
            ("Senos Paranasales 3", "Senos Paranasales 3"),
            ("Columna Ap y lat", "Columna Ap y lat"),
            ("Huesos", "Huesos"),
            ("Otros", "Otros"),
            ("Uretrografía Retrógrada", "Uretrografía Retrógrada"),
            ("Fistulografía", "Fistulografía"),
            ("Tránsito Intestinal", "Tránsito Intestinal"),
            ("Urografía Excretora", "Urografía Excretora"),
            ("Cistograma (Simple / Transmiccional)", "Cistograma (Simple / Transmiccional)"),
            ("Cistouretrografía", "Cistouretrografía"),
            ("Colangiografía", "Colangiografía"),
            ("Colangiografía en T", "Colangiografía en T"),
            ("Histerosalpingografía", "Histerosalpingografía"),
        )),
        ("Mastografía", (
            ("Mamografía", "Mamografía"),
            ("Mamografía y US Mamas", "Mamografía y US Mamas"),
        )),
        ("Procedimientos", (
            ("Marcaje de Mama", "Marcaje de Mama"),
            ("Biopsia de Mama", "Biopsia de Mama"),
            ("Biopsia de Próstata", "Biopsia de Próstata"),
            ("Baaf de tiroides", "Baaf de tiroides"),
        )),
        ("Ultrasonido", (
            ("Hígado y Vías Biliares (Boyden)", "Hígado y Vías Biliares (Boyden)"),
            ("Abdomen Superior", "Abdomen Superior"),
            ("Renal", "Renal"),
            ("Pelvis", "Pelvis"),
            ("Vesical y próstata", "Vesical y próstata"),
            ("Abdomen Completo", "Abdomen Completo"),
            ("Mama Doppler", "Mama Doppler"),
            ("Obstétrico Doppler", "Obstétrico Doppler"),
            ("Obstétrico 4D", "Obstétrico 4D"),
            ("Obstétrico Morfológico", "Obstétrico Morfológico"),
            ("Endovaginal", "Endovaginal"),
            ("Transrectal de Próstata", "Transrectal de Próstata"),
            ("Doppler vascular Periférico", "Doppler vascular Periférico"),
        )),
        ("Doppler", (
            ("Tiroides", "Tiroides"),
            ("Cuello", "Cuello"),
            ("Carótidas", "Carótidas"),
            ("Transfontanelar", "Transfontanelar"),
            ("Mamas", "Mamas"),
            ("Testicular", "Testicular"),
            ("Musculoesquelético", "Musculoesquelético"),
            ("Otros", "Otros"),
        )),
        ("Tomografía Computada", (
            ("Cráneo (Simple / Contraste IV)", "Cráneo (Simple / Contraste IV)"),
            ("Cuello (Simple / Contraste IV)", "Cuello (Simple / Contraste IV)"),
            ("Torax (Simple / Contraste IV)", "Torax (Simple / Contraste IV)"),
            ("Abdomen y Pelvis (Simple / Contraste IV / Contraste Oral / Trifásica (hígado))", "Abdomen y Pelvis (Simple / Contraste IV / Contraste Oral / Trifásica (hígado))"),
            ("Urotomografía (fase eliminación)", "Urotomografía (fase eliminación)"),
            ("Senos Paranasales", "Senos Paranasales"),
            ("Hueso Reconstrucción 3D", "Hueso Reconstrucción 3D"),
            ("AngioTac", "AngioTac"),
            ("Columna", "Columna"),
            ("Otro", "Otro"),
        )),
        ("Densitometría Ósea", (
            ("Densitometría Ósea", "Densitometría Ósea"),
        )),
        ("Estudios Especiales", (
            ("Estudios Especiales", "Estudios Especiales"),
        )),
    ]

    id_solicitud_estudio = models.AutoField(primary_key=True)
    diagnosis = models.CharField(max_length=100, null=True, blank=True)
    requested_study = models.CharField(max_length=100, choices=REQUESTED_STUDY_CHOICES)
    pdf_password = models.CharField(max_length=18, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    first_printed_at = models.DateTimeField(null=True, blank=True)
    
    # Relationships
    id_patient = models.ForeignKey('patientsDashboard.Patient', on_delete=models.CASCADE)
    id_associate_doctor = models.ForeignKey(
        'associateDoctorDashboard.AssociateDoctor', 
        on_delete=models.CASCADE, 
        blank=True, 
        null=True
    )

    def save(self, *args, **kwargs):
        """
        Overrides the default save method to automatically generate a secure 
        random 18-character alphanumeric password for the patient's PDF results
        if one has not been set yet.
        """
        if not self.pdf_password:
            alphabet = string.ascii_letters + string.digits
            self.pdf_password = ''.join(secrets.choice(alphabet) for _ in range(18))
        super().save(*args, **kwargs)

    @property
    def is_ticket_printable(self):
        """
        Determines if the physical access ticket is still within its printable window.
        - The ticket is always available until the first physical print event.
        - Once printed, it stays active in the system for exactly 12 hours from the first print time.
        
        Returns:
            bool: True if the ticket can be printed, False otherwise.
        """
        if not self.first_printed_at:
            return True
        return timezone.now() - self.first_printed_at < timezone.timedelta(hours=12)