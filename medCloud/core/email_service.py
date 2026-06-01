"""
Platform-wide Email Dispatch Service.
Handles compiling HTML templates into emails, generating verification tokens,
and attaching heavily encrypted diagnostic PDF reports.
"""
from django.core.mail import send_mail
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings

# Global cryptographic signer for short-lived URL tokens
signer = TimestampSigner()

def _make_verification_token(user):
    """
    Creates a cryptographically signed, timestamped token containing the user's primary key.
    Cannot be forged without the server's SECRET_KEY.
    """
    return signer.sign(str(user.pk))

def _verify_token(token, max_age=86400):
    """
    Validates a signed token to ensure it hasn't expired and hasn't been tampered with.
    
    Args:
        token (str): The raw signed string passed from the URL.
        max_age (int, optional): Expiration window in seconds. Default is 24 hours.
        
    Returns:
        int or None: The successfully decoded user PK, or None if invalid/expired.
    """
    try:
        value = signer.unsign(token, max_age=max_age)
        return int(value)
    except (BadSignature, SignatureExpired):
        return None

def send_verification_email(user, request):
    """
    Compiles and dispatches an Account Verification email containing 
    the secure activation URL token.
    """
    token = _make_verification_token(user)
    
    # Build absolute verification URL
    verify_url = request.build_absolute_uri(f'/core/verify-email/{token}/')
    
    # DO NOT TRANSLATE UI/EMAIL STRINGS
    subject = 'Verifica tu correo — MedCloud'
    html_message = render_to_string('core/emails/verification_email.html', {
        'user': user,
        'verify_url': verify_url,
    })
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )

def send_welcome_email(user):
    """
    Compiles and dispatches a branded Welcome email to the user 
    triggering immediately after successful email verification.
    """
    # DO NOT TRANSLATE UI/EMAIL STRINGS
    subject = '¡Bienvenido a MedCloud!'
    html_message = render_to_string('core/emails/welcome_email.html', {
        'user': user,
    })
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )

def send_study_completed_email(study):
    """
    Notifies a Patient that their final medical report has been released.
    
    Crucially, it generates the PDF byte-stream behind the scenes, heavily 
    encrypts the PDF using AES-256 with the patient's unique 18-character 
    digital password (found on their physical ticket), and attaches 
    it to the email. This ensures strict HIPAA/GDPR data security.
    """
    from django.core.mail import EmailMessage
    import pikepdf
    import io
    from .views import generate_pdf_bytes
    
    patient = study.id_patient
    if not patient.user or not patient.user.email:
        return
    
    report = study.id_report
    if not report:
        return
    
    # DO NOT TRANSLATE UI/EMAIL STRINGS
    subject = 'Tu estudio está listo — MedCloud'
    html_message = render_to_string('core/emails/study_completed_email.html', {
        'patient': patient,
        'study': study,
        'report': report,
    })
    plain_message = strip_tags(html_message)
    
    # Build the email
    email = EmailMessage(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [patient.user.email],
    )
    email.content_subtype = 'html'
    email.body = html_message
    
    # Generate and encrypt the PDF
    try:
        pdf_bytes = generate_pdf_bytes(report, study)
        
        # Encrypt PDF with pikepdf using the StudyRequest password
        password = study.id_study_request.pdf_password
        input_pdf = io.BytesIO(pdf_bytes)
        output_pdf = io.BytesIO()
        
        with pikepdf.open(input_pdf) as pdf:
            pdf.save(
                output_pdf,
                encryption=pikepdf.Encryption(
                    owner=password,
                    user=password,
                    aes=True,
                    R=6,  # AES-256 Strong Cryptography
                )
            )
        
        output_pdf.seek(0)
        email.attach(
            f'reporte_{report.id_report}.pdf',
            output_pdf.read(),
            'application/pdf'
        )
    except Exception as e:
        print(f"Error generating/encrypting PDF for email: {e}")
        # Still send the email without attachment as a fallback
    
    email.send(fail_silently=False)

def send_doctor_approved_email(user):
    """
    Notifies an Associate Doctor that their registration was manually 
    approved by a staff Assistant and their account is now active.
    """
    # DO NOT TRANSLATE UI/EMAIL STRINGS
    subject = '¡Tu cuenta ha sido aprobada! — MedCloud'
    html_message = render_to_string('core/emails/doctor_approved_email.html', {
        'user': user,
    })
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )

def send_doctor_denied_email(email, name):
    """
    Notifies a rejected Associate Doctor applicant that their medical 
    credentials could not be verified and their account has been removed.
    """
    # DO NOT TRANSLATE UI/EMAIL STRINGS
    subject = 'Solicitud de cuenta — MedCloud'
    html_message = render_to_string('core/emails/doctor_denied_email.html', {
        'name': name,
    })
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [email],
        html_message=html_message,
        fail_silently=False,
    )
