"""
Broadcast helpers for real-time WebSocket notifications.
Call these from views/signals when key events happen.
"""
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def _send_to_group(group_name, notification_type, message, data=None):
    """Send a notification to a channel group."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'send_notification',
            'notification_type': notification_type,
            'message': message,
            'data': data or {},
        }
    )


def notify_new_study(study):
    """
    A new Study was created (e.g. from PACS polling or manual creation).
    Notify: all doctors, the assistant, the patient, and associated doctors.
    """
    data = {
        'study_id': study.id_study,
        'patient_name': f'{study.id_patient.user.first_name} {study.id_patient.user.last_name}',
    }

    # All doctors — new study to report
    _send_to_group('doctors_all', 'new_study', 'Nuevo estudio pendiente por reportar', data)

    # Assistants — study arrived
    _send_to_group('assistant_all', 'new_study', 'Nuevo estudio registrado', data)

    # Patient — your study is ready
    patient_user_id = study.id_patient.user.id
    _send_to_group(f'patient_{patient_user_id}', 'new_study', 'Tu estudio está disponible', data)

    # Associated doctors for this patient
    for doctor in study.id_patient.associated_doctors.all():
        _send_to_group(f'associate_{doctor.user.id}', 'new_study', 'Nuevo estudio de paciente disponible', data)


def notify_report_completed(report, study):
    """
    A report was completed by a doctor.
    Notify: the patient, assistants, and associated doctors.
    """
    data = {
        'study_id': study.id_study,
        'report_id': report.id_report,
        'patient_name': f'{study.id_patient.user.first_name} {study.id_patient.user.last_name}',
    }

    # Patient — your report is ready
    patient_user_id = study.id_patient.user.id
    _send_to_group(f'patient_{patient_user_id}', 'report_completed', 'Tu reporte está listo', data)

    # Assistants — report finished
    _send_to_group('assistant_all', 'report_completed', 'Reporte completado', data)

    # Associated doctors
    for doctor in study.id_patient.associated_doctors.all():
        _send_to_group(f'associate_{doctor.user.id}', 'report_completed', 'Reporte de paciente disponible', data)

    # All doctors — update their lists
    _send_to_group('doctors_all', 'report_completed', 'Reporte completado', data)


def notify_study_request_created(study_request):
    """
    A new StudyRequest was created by the assistant.
    Notify: assistants (refresh their list).
    """
    data = {
        'study_request_id': study_request.id_solicitud_estudio,
        'patient_name': f'{study_request.id_patient.user.first_name} {study_request.id_patient.user.last_name}',
        'requested_study': study_request.requested_study,
    }

    _send_to_group('assistant_all', 'study_request_created', 'Nueva solicitud de estudio creada', data)


def notify_report_locked(study, doctor):
    """
    A doctor locked a study (started working on it).
    Notify: all doctors, the patient, and associate doctors.
    """
    data = {
        'study_id': study.id_study,
        'doctor_name': f'{doctor.user.first_name} {doctor.user.last_name}',
    }

    _send_to_group('doctors_all', 'report_locked', 'Un estudio ha sido tomado por un doctor', data)

    # Notify patient — their study is now being worked on
    patient_user_id = study.id_patient.user.id
    _send_to_group(f'patient_{patient_user_id}', 'report_locked', 'Tu estudio está siendo revisado', data)

    # Notify associate doctors
    for assoc in study.id_patient.associated_doctors.all():
        _send_to_group(f'associate_{assoc.user.id}', 'report_locked', 'Un estudio está siendo revisado', data)


def notify_studies_unlocked(study_ids, doctor, patient_user_ids=None):
    """
    A doctor logged out and their in-progress studies were released back to pending.
    Notify: all doctors, affected patients, and their associate doctors.
    """
    data = {
        'study_ids': study_ids,
        'doctor_name': f'{doctor.user.first_name} {doctor.user.last_name}',
        'count': len(study_ids),
    }

    _send_to_group('doctors_all', 'studies_unlocked', f'{len(study_ids)} estudio(s) disponible(s) nuevamente', data)

    # Notify affected patients and their associate doctors
    if patient_user_ids:
        for pid in patient_user_ids:
            _send_to_group(f'patient_{pid}', 'studies_unlocked', 'Tu estudio ha vuelto a estado pendiente', data)


def notify_doctor_pending_approval(doctor):
    """
    An associate doctor verified their email and is pending assistant approval.
    Notify: all assistants.
    """
    data = {
        'doctor_id': doctor.pk,
        'doctor_name': f'{doctor.user.first_name} {doctor.user.last_name}',
        'professional_id': doctor.professional_id or '',
        'university': doctor.university or '',
        'phone': doctor.phone or '',
        'email': doctor.user.email or '',
    }
    _send_to_group('assistant_all', 'doctor_pending_approval', 'Nuevo doctor pendiente de aprobación', data)


def notify_doctor_approved(doctor):
    """
    An assistant approved an associate doctor.
    Notify: all assistants (to live-remove the pending card).
    """
    data = {
        'doctor_id': doctor.pk,
    }
    _send_to_group('assistant_all', 'doctor_approved', 'Doctor aprobado', data)


def notify_doctor_denied(doctor_pk):
    """
    An assistant denied an associate doctor.
    Notify: all assistants (to live-remove the pending card).
    """
    data = {
        'doctor_id': doctor_pk,
    }
    _send_to_group('assistant_all', 'doctor_denied', 'Doctor rechazado', data)


def notify_images_available(study):
    """
    PACS images have arrived for a study that was previously pending.
    Notify: all doctors (new study to report), the patient, and their associate doctors.
    """
    data = {
        'study_id': study.id_study,
        'patient_name': f'{study.id_patient.user.first_name} {study.id_patient.user.last_name}',
    }

    # All doctors — new study with images available
    _send_to_group('doctors_all', 'images_available', 'Imágenes de estudio disponibles', data)

    # Patient — images for your study arrived
    patient_user_id = study.id_patient.user.id
    _send_to_group(f'patient_{patient_user_id}', 'images_available', 'Las imágenes de tu estudio están disponibles', data)

    # Associated doctors for this patient
    for doctor in study.id_patient.associated_doctors.all():
        _send_to_group(f'associate_{doctor.user.id}', 'images_available', 'Imágenes de estudio de paciente disponibles', data)

