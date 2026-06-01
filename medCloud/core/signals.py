from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import Group
from doctorsDashboard.models import ReportingDoctor
from patientsDashboard.models import Patient
from associateDoctorDashboard.models import AssociateDoctor
from assistantDashboard.models import Assistant

def assign_user_to_group(user, group_name):
    try:
        group = Group.objects.get(name=group_name)
        user.groups.add(group)
    except Group.DoesNotExist:
        pass # Group should exist from migration, but fail gracefully

@receiver(post_save, sender=ReportingDoctor)
def assign_doctor_group(sender, instance, created, **kwargs):
    if created and instance.user:
        assign_user_to_group(instance.user, 'Doctors')

@receiver(post_save, sender=Patient)
def assign_patient_group(sender, instance, created, **kwargs):
    if created and instance.user:
        assign_user_to_group(instance.user, 'Patients')

@receiver(post_save, sender=AssociateDoctor)
def assign_associate_doctor_group(sender, instance, created, **kwargs):
    if created and instance.user:
        assign_user_to_group(instance.user, 'AssociatedDoctors')

@receiver(post_save, sender=Assistant)
def assign_assistant_group(sender, instance, created, **kwargs):
    if created and instance.user:
        assign_user_to_group(instance.user, 'Assistants')
