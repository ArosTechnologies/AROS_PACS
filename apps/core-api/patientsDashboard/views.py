"""
Views for the Patient Dashboard.
Handles the main landing page for patients, displaying all their historical
radiological studies, managing their profile metadata, and granting access
permissions to external Associate Doctors.
"""
from django.shortcuts import render, redirect
from core.models import Study, Report
from patientsDashboard.models import Patient
from associateDoctorDashboard.models import AssociateDoctor
from assistantDashboard.models import StudyRequest
from doctorsDashboard.models import ReportingDoctor
from django.views.generic.list import ListView
from django.views.generic.detail import DetailView
from core.mixins import PatientRequiredMixin
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.views.generic.detail import DetailView
from django.views.generic.edit import UpdateView
from django.urls import reverse_lazy
from .forms import PatientForm

# PATIENT VIEWS
class PatientDashboardView(PatientRequiredMixin, ListView):
    """
    Main landing dashboard for an authenticated Patient.
    Shows a chronologically ordered list of all their radiological studies 
    (both Pending and Completed).
    """
    model = Study
    template_name = 'patientsDashboard/patientsDashboard.html'
    context_object_name = 'studies'

    def get_queryset(self):
        """
        Secures the query by explicitly filtering studies that belong 
        to the currently authenticated patient profile.
        """
        # We need the patient profile to filter studies
        if hasattr(self.request.user, 'patient_profile'):
            patient = self.request.user.patient_profile
            # Show all studies for this patient
            return Study.objects.filter(
                id_patient=patient,
            ).select_related('id_report').order_by('-date')
        return Study.objects.none()

class PatientProfileView(PatientRequiredMixin, DetailView):
    """
    Displays the patient's current profile settings and demographic information.
    """
    model = Patient
    template_name = 'patientsDashboard/profile.html'
    context_object_name = 'patient'

    def get_object(self):
        return self.request.user.patient_profile

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # UI str preserved in Spanish
        context['page_title'] = 'Mi Perfil'
        return context

class PatientProfileUpdateView(PatientRequiredMixin, UpdateView):
    """
    Form view allowing a Patient to edit their name, email, phone, and address.
    """
    model = Patient
    form_class = PatientForm
    template_name = 'patientsDashboard/profile_edit.html'
    success_url = reverse_lazy('patientsDashboard:profile')

    def get_object(self):
        return self.request.user.patient_profile

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # UI str preserved in Spanish
        context['page_title'] = 'Editar Perfil'
        return context

class ManageDoctorsView(PatientRequiredMixin, DetailView):
    """
    Page for patients to manage privacy and sharing settings.
    Lists which associate doctors currently have access to their radiological studies,
    and allows searching/adding new doctors via AJAX/API endpoints.
    """
    model = Patient
    template_name = 'patientsDashboard/manage_doctors.html'
    context_object_name = 'patient'

    def get_object(self):
        return self.request.user.patient_profile

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['granted_doctors'] = self.request.user.patient_profile.associated_doctors.select_related('user').all()
        return context

@login_required
def patient_logout(request):
    """
    Handles the Patient logout process and clears the local session.
    """
    logout(request)
    return redirect('login')

from django.contrib.auth import login
from .forms import PatientSignupForm
from core.email_service import send_verification_email

def signup(request):
    """
    Handles the public self-registration flow for new Patients.
    
    Upon successful form submission, the requested User is securely provisioned 
    in an inactive state (`is_active=False`) and an email verification token is dispatched 
    to their supplied address.
    """
    if request.method == 'POST':
        form = PatientSignupForm(request.POST)
        if form.is_valid():
            patient = form.save()
            # Deactivate user until email is verified
            patient.user.is_active = False
            patient.user.save()
            # Send verification email
            send_verification_email(patient.user, request)
            return render(request, 'core/emails/verification_pending.html')
    else:
        form = PatientSignupForm()
    
    return render(request, 'patientsDashboard/registration/signup.html', {'form': form})
