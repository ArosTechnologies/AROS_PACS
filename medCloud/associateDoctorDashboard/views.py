"""
Views for the Associate Doctor Dashboard.
Handles the UI for external referring physicians to check their linked patients,
view study results, and manage their registration/profile.
"""
from django.shortcuts import render, redirect
from django.views.generic import ListView, DetailView
from core.mixins import AssociatedDoctorRequiredMixin
from patientsDashboard.models import Patient
from associateDoctorDashboard.models import AssociateDoctor
from .forms import AssociateDoctorSignupForm
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.decorators import login_required

class DashboardView(AssociatedDoctorRequiredMixin, ListView):
    """
    Main dashboard view for Associate Doctors.
    Displays a list of all patients that have explicitly granted access
    to this specific referring physician, along with their related studies.
    """
    template_name = 'associateDoctorDashboard/associateDashboard.html'
    context_object_name = 'patients'

    def get_queryset(self):
        """
        Retrieves the filtered list of patients securely limited to the 
        currently authenticated Associate Doctor via the Many-to-Many relationship.
        Optimized with `prefetch_related` to eager load the studies and prevent N+1 queries.
        """
        if hasattr(self.request.user, 'associate_doctor_profile'):
            doctor = self.request.user.associate_doctor_profile
            # doctor.patients is the reverse relation from Patient.associated_doctors
            return doctor.patients.all().prefetch_related('study_set')
        return Patient.objects.none()

class ProfileView(AssociatedDoctorRequiredMixin, DetailView):
    """
    Displays the profile settings page for the currently logged-in Associate Doctor.
    Allows them to view their professional credentials and update information.
    """
    model = AssociateDoctor
    template_name = 'associateDoctorDashboard/profile.html'
    context_object_name = 'doctor'

    def get_object(self):
        """Returns the profile strictly associated with the active user."""
        return self.request.user.associate_doctor_profile

def signup(request):
    """
    Handles the public registration flow for new referring physicians.
    
    On POST:
      - Validates the signup form (AssociateDoctorSignupForm).
      - Delegates to AssociateDoctorService to provision accounts and send emails.
      
    On GET:
      - Renders the empty signup form.
    """
    from .services import AssociateDoctorService

    if request.method == 'POST':
        form = AssociateDoctorSignupForm(request.POST)
        if form.is_valid():
            AssociateDoctorService.register_doctor(form.cleaned_data, request)
            return render(request, 'core/emails/verification_pending.html')
    else:
        form = AssociateDoctorSignupForm()
    
    return render(request, 'associateDoctorDashboard/registration/signup.html', {'form': form})

@login_required
def associate_logout(request):
    """
    Handles the Associate Doctor logout process and redirects to the public login page.
    """
    auth_logout(request)
    return redirect('login')
