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
        
    # Serialize appointment data
    appointment_data = {
        "id": str(instance.id),
        "status": instance.status,
        "patient": str(instance.patient.id) if instance.patient else None,
        "physician": str(instance.physician.id) if getattr(instance, 'physician', None) else None,
        "clinic_slug": instance.clinic.slug if getattr(instance, 'clinic', None) else None,
        "requested_date": instance.requested_date.isoformat() if getattr(instance, 'requested_date', None) else None,
        "proposed_date": instance.proposed_date.isoformat() if getattr(instance, 'proposed_date', None) else None,
        "modality": instance.modality,
        # Fields expected by the frontend table:
        "patient_name": f"{getattr(instance.patient, 'patient_profile', None).first_name if getattr(instance.patient, 'patient_profile', None) else ''} {getattr(instance.patient, 'patient_profile', None).last_name if getattr(instance.patient, 'patient_profile', None) else ''}".strip() or instance.patient.email_hash,
        "patient_email": instance.patient.email_hash,
        "patient_phone": getattr(instance.patient, 'patient_profile', None).phone if getattr(instance.patient, 'patient_profile', None) else "",
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
