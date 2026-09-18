import json
from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Appointment

@receiver(post_save, sender=Appointment)
def appointment_updated(sender, instance, created, **kwargs):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
        
    # Safely get patient profile
    patient_profile = None
    if instance.patient:
        try:
            patient_profile = instance.patient.patient_profile
        except Exception:
            pass

    patient_name = ""
    if patient_profile:
        patient_name = f"{patient_profile.first_name} {patient_profile.last_name}".strip()
    if not patient_name and instance.patient:
        patient_name = instance.patient.email_hash

    def format_date(d):
        if not d:
            return None
        if hasattr(d, 'isoformat'):
            return d.isoformat()
        return str(d)

    # Serialize appointment data
    appointment_data = {
        "id": str(instance.id),
        "status": instance.status,
        "patient": str(instance.patient.id) if instance.patient else None,
        "physician": str(instance.physician.id) if getattr(instance, 'physician', None) else None,
        "clinic_slug": instance.clinic.slug if getattr(instance, 'clinic', None) else None,
        "requested_date": format_date(getattr(instance, 'requested_date', None)),
        "proposed_date": format_date(getattr(instance, 'proposed_date', None)),
        "proposed_by": getattr(instance, 'proposed_by', None),
        "modality": instance.modality,
        # Fields expected by the frontend table:
        "patient_name": patient_name,
        "patient_email": instance.patient.email_hash if instance.patient else "",
        "patient_phone": patient_profile.phone if patient_profile else "",
        "created_by": instance.created_by.email_hash if getattr(instance, 'created_by', None) else "",
        "notes": instance.notes,
        "clinic_notes": instance.clinic_notes
    }

    groups_to_notify = []
    
    # Add clinic group
    if appointment_data["clinic_slug"]:
        groups_to_notify.append(f"clinic_{appointment_data['clinic_slug']}_agenda")
        
    # Add patient group
    if appointment_data["patient"]:
        groups_to_notify.append(f"patient_{appointment_data['patient']}_agenda")
        
    # Add physician group
    if appointment_data["physician"]:
        groups_to_notify.append(f"physician_{appointment_data['physician']}_agenda")

    # Send to all relevant groups
    for group in groups_to_notify:
        async_to_sync(channel_layer.group_send)(
            group,
            {
                "type": "appointment_update",
                "appointment": appointment_data
            }
        )
