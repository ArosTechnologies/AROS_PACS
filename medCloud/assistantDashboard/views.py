"""
Views for the Assistant Dashboard.
Handles UI rendering for hospital front-desk staff, including listing active study requests,
creating new requests, printing patient tickets, and managing assistant profiles.
"""
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.views.generic import ListView, DetailView, CreateView, TemplateView
from django.urls import reverse_lazy
from core.mixins import AssistantRequiredMixin
from .models import Assistant, StudyRequest
from .forms import StudyRequestForm
from patientsDashboard.models import Patient
from django.utils import timezone
from datetime import timedelta


class AssistantDashboardView(AssistantRequiredMixin, TemplateView):
    """
    Main dashboard view for Assistants.
    Displays:
    1. Active tickets (study requests that have not expired).
    2. Pending associate doctors who need account verification.
    Requires the user to belong to the 'Assistants' group.
    """
    template_name = 'assistantDashboard/assistant_dashboard.html'
    
    def get_context_data(self, **kwargs):
        """
        Adds active study requests and unverified associate doctors to the template context.
        Active tickets are either never printed or printed within the last 12 hours.
        """
        context = super().get_context_data(**kwargs)
        cutoff = timezone.now() - timedelta(hours=12)
        
        from django.db.models import Q
        context['active_tickets'] = StudyRequest.objects.filter(
            Q(first_printed_at__isnull=True) | Q(first_printed_at__gte=cutoff)
        ).select_related('id_patient__user').order_by('-created_at')

        from associateDoctorDashboard.models import AssociateDoctor
        context['pending_doctors'] = AssociateDoctor.objects.filter(
            is_email_verified=True, is_verified=False
        ).select_related('user').order_by('-user__date_joined')

        return context


class AllStudyRequestsView(AssistantRequiredMixin, ListView):
    """
    Paginated list view displaying all historical study requests in the system.
    Used for auditing and past reference.
    """
    model = StudyRequest
    template_name = 'assistantDashboard/all_requests.html'
    context_object_name = 'study_requests'
    paginate_by = 20

    def get_queryset(self):
        """
        Optimize database queries by selecting related user objects.
        Orders requests from newest to oldest.
        """
        return StudyRequest.objects.all().select_related(
            'id_patient__user', 'id_associate_doctor__user'
        ).order_by('-created_at')

    def get_context_data(self, **kwargs):
        """
        Injects the same active tickets and pending doctors summary as the main dashboard
        to maintain a consistent sidebar/header experience.
        """
        context = super().get_context_data(**kwargs)
        cutoff = timezone.now() - timedelta(hours=12)
        
        from django.db.models import Q
        context['active_tickets'] = StudyRequest.objects.filter(
            Q(first_printed_at__isnull=True) | Q(first_printed_at__gte=cutoff)
        ).select_related('id_patient__user').order_by('-created_at')

        from associateDoctorDashboard.models import AssociateDoctor
        context['pending_doctors'] = AssociateDoctor.objects.filter(
            is_email_verified=True, is_verified=False
        ).select_related('user').order_by('-user__date_joined')

        return context


class StudyRequestCreateView(AssistantRequiredMixin, CreateView):
    """
    Class-based view handling the creation of a new radiological StudyRequest.
    Includes logic to securely integrate with the Raditech PACS/RIS API synchronously
    before saving the local record.
    """
    model = StudyRequest
    form_class = StudyRequestForm
    template_name = 'assistantDashboard/new_study_request.html'
    success_url = reverse_lazy('assistant_dashboard')

    def form_valid(self, form):
        """
        Called when valid form data has been POSTed.
        1. Validates the selected patient ID from the hidden UI field.
        2. Delegates the StudyRequest creation to the Domain Service.
        """
        # Get patient from the hidden field populated by the JavaScript search
        patient_id = self.request.POST.get('id_patient')
        if not patient_id:
            form.add_error(None, 'Debe seleccionar un paciente.')
            return self.form_invalid(form)
        
        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            form.add_error(None, 'El paciente seleccionado no existe.')
            return self.form_invalid(form)
        
        study_request = form.save(commit=False)
        from .services import AssistantService
        AssistantService.create_study_request_service(study_request, patient)
        
        messages.success(self.request, 'Solicitud de estudio creada exitosamente.')
        return redirect(self.success_url)


class AssistantProfileView(AssistantRequiredMixin, DetailView):
    """
    Displays the profile settings page for the currently logged-in Assistant.
    """
    model = Assistant
    template_name = 'assistantDashboard/assistant_profile.html'
    context_object_name = 'assistant'

    def get_object(self):
        """Returns the assistant profile associated with the active user."""
        return self.request.user.assistant_profile


@login_required
def print_ticket(request, study_request_id):
    """
    Renders a simple printable HTML ticket containing the patient's generated
    PDF password and study barcodes.
    
    The first time this view is accessed for a ticket, it sets the `first_printed_at`
    timestamp on the StudyRequest, which starts a 12-hour expiration countdown.
    
    Args:
        request: The HTTP request object.
        study_request_id: Primary key of the StudyRequest to print.
    """
    study_request = get_object_or_404(StudyRequest, pk=study_request_id)
    if not study_request.first_printed_at:
        study_request.first_printed_at = timezone.now()
        study_request.save(update_fields=['first_printed_at'])
        
    return render(request, 'assistantDashboard/ticket.html', {
        'study_request': study_request,
    })


@login_required
def assistant_logout(request):
    """
    Handles the Assistant logout process and redirects to the public login page.
    """
    logout(request)
    return redirect('login')
