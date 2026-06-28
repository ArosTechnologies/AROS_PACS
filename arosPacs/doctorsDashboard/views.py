"""
Views for the Doctors Dashboard.
Handles the diagnostic workflow for Reporting Radiologists, including viewing 
pending studies, locking studies for analysis, and submitting finalized medical reports.
"""
from django.shortcuts import render, redirect, get_object_or_404
from core.models import Study, Report
from .models import ReportingDoctor
from django.views.generic.edit import CreateView
from django.views.generic.list import ListView
from django.views.generic.detail import DetailView
from django.urls import reverse_lazy
from core.mixins import DoctorRequiredMixin
from django.contrib.auth import logout
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required


class PendingStudiesView(DoctorRequiredMixin, ListView):
    """
    Displays the grid of studies waiting for radiological analysis.
    Corresponds to the 'Estudios Pendientes' page.
    """
    model = Study
    template_name = 'doctorsDashboard/pending_studies.html'
    context_object_name = 'studies'

    def get_queryset(self):
        """
        Filter for studies that are pending.
        A study is defined as "Pending" if it has NO medical report associated with it yet.
        Locked (In Progress) and Completed studies are filtered out here.
        """
        return Study.objects.filter(id_report__isnull=True).order_by('date')

class StudiesInProgressView(DoctorRequiredMixin, ListView):
    """
    Displays studies that are currently 'locked' by the authenticated doctor.
    A study is locked to prevent concurrent, overlapping reporting by multiple radiologists.
    """
    model = Study
    template_name = 'doctorsDashboard/studies_in_progress.html'
    context_object_name = 'studies'
    
    def get_queryset(self):
        """
        Filter to show ONLY studies where the report is marked IN_PROGRESS 
        and is explicitly assigned to *THIS* specific logged-in doctor.
        """
        try:
            if hasattr(self.request.user, 'reporting_doctor_profile'):
                doctor = self.request.user.reporting_doctor_profile
                return Study.objects.filter(
                    id_report__status=Report.IN_PROGRESS,
                    id_report__doctor_in_charge=doctor
                ).order_by('date')
            else:
                return Study.objects.none()
        except ReportingDoctor.DoesNotExist:
            return Study.objects.none()

class DoctorProfileView(DoctorRequiredMixin, DetailView):
    """
    Shows a read-only view of the radiologist's profile, credentials, 
    and a historical log of their completed reports.
    """
    model = ReportingDoctor
    template_name = 'doctorsDashboard/doctor_profile.html'
    context_object_name = 'doctor'

    def get_context_data(self, **kwargs):
        """
        Injects purely historical, completed studies authored 
        by this specific doctor into the template context.
        """
        context = super().get_context_data(**kwargs)
        context['history_studies'] = Study.objects.filter(
            id_report__doctor_in_charge=self.object
        ).order_by('-date')
        return context

class StudyReportCreateView(DoctorRequiredMixin, CreateView):
    """
    The main diagnostic workspace where a doctor interprets DICOM images 
    and writes the final text Report. Features a split-screen UI.
    """
    model = Report
    template_name = 'doctorsDashboard/study_report.html'
    fields = ['about', 'findings', 'conclusions', 'recommendations', 'patients_description']
    
    def dispatch(self, request, *args, **kwargs):
        """
        Pre-fetch the target Study based on the URL parameter before form initialization.
        """
        self.study = get_object_or_404(Study, pk=self.kwargs['pk'])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        """
        Provides the study object (which contains the `pacs_url` link) to the UI.
        """
        context = super().get_context_data(**kwargs)
        context['study'] = self.study
        return context

    def form_valid(self, form):
        """
        Executes the business logic for finalizing a study report.
        Sequence:
          1. Link the authoring doctor.
          2. Mark the report status as COMPLETED.
          3. Save the report to DB.
          4. Link the new report back to the parent Study.
          5. Dispatch Email alerts to the Patient.
          6. Broadcast WebSocket notifications across dashboards.
        """
        # 1. Assign the logged-in doctor
        try:
            if hasattr(self.request.user, 'reporting_doctor_profile'):
                reporting_doctor = self.request.user.reporting_doctor_profile
                form.instance.doctor_in_charge = reporting_doctor
            else:
                 raise ValueError(f"No ReportingDoctor profile linked to user {self.request.user.username}")
        except Exception: 
            raise ValueError(f"Error accessing profile for user {self.request.user.username}")
        
        # 2. Update status to COMPLETED
        form.instance.status = Report.COMPLETED
        
        # 3. Save the report
        self.object = form.save()

        # 4. Link the new report to the Study
        self.study.id_report = self.object
        self.study.save()

        # 5. Notify the patient via email
        if not self.study.email_sent:
            try:
                from core.email_service import send_study_completed_email
                send_study_completed_email(self.study)
                self.study.email_sent = True
                self.study.save()
            except Exception as e:
                print(f"Error sending study completion email: {e}")

        # 6. Notify via WebSocket
        from core.notifications import notify_report_completed
        notify_report_completed(self.object, self.study)

        return super().form_valid(form)

    def get_success_url(self):
        """Return the user back to the pending studies grid after submission."""
        return reverse_lazy('pendingStudies')

@require_POST
@login_required
def lock_study(request, study_id):
    """
    POST API to atomically lock a study for the requesting doctor.
    Creates an empty, placeholder Report with an IN_PROGRESS status to prevent
    other doctors from seeing it on the pending board.
    
    Broadcasts a WebSocket message telling all active clients to live-hide the study.
    """
    try:
        study = Study.objects.get(pk=study_id)
        
        if not hasattr(request.user, 'reporting_doctor_profile'):
             return JsonResponse({'status': 'error', 'message': 'Doctor profile not found'}, status=403)
             
        doctor = request.user.reporting_doctor_profile
        
        # Check if already locked globally
        if study.id_report and study.id_report.status == Report.IN_PROGRESS:
            if study.id_report.doctor_in_charge != doctor:
                 return JsonResponse({'status': 'error', 'message': 'Study already locked by another doctor'}, status=403)
            else:
                 return JsonResponse({'status': 'ok', 'message': 'Already locked by you'})
        
        # Create new In Progress Report
        report = Report.objects.create(
            status=Report.IN_PROGRESS,
            doctor_in_charge=doctor,
            about="", 
            patients_description="",
            findings="",
            conclusions="",
            recommendations=""
        )
        
        # Link to Study
        study.id_report = report
        study.save()

        # Notify all doctors via WebSocket to remove it from their grids
        from core.notifications import notify_report_locked
        notify_report_locked(study, doctor)
        
        return JsonResponse({'status': 'ok'})
        
    except (Study.DoesNotExist, ReportingDoctor.DoesNotExist, AttributeError):
        return JsonResponse({'status': 'error', 'message': 'Study or Doctor not found'}, status=404)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

def doctor_logout(request):
    """
    Custom logout handler tailored specifically for Reporting Radiologists.
    Crucially, it acts as a cleanup daemon, searching the DB for any "In Progress" reports 
    locked by this specific doctor and unconditionally aborts them, returning 
    the studies to the public pending pool. 
    
    This ensures uncompleted studies don't become permanently orphaned if a doctor drops offline.
    """
    if request.user.is_authenticated:
        try:
            if hasattr(request.user, 'reporting_doctor_profile'):
                doctor = request.user.reporting_doctor_profile
                
                # Find all reports in progress for this doctor
                reports_in_progress = Report.objects.filter(
                    status=Report.IN_PROGRESS,
                    doctor_in_charge=doctor
                )
                
                unlocked_study_ids = []
                patient_user_ids = set()

                for report in reports_in_progress:
                    # 1. Find associated studies
                    # Note: Study.id_report is a ForeignKey to Report.
                    studies = Study.objects.filter(id_report=report).select_related('id_patient__user')
                    for study in studies:
                        unlocked_study_ids.append(study.id_study)
                        patient_user_ids.add(study.id_patient.user.id)
                        # CRITICAL: Unlink the report from the study so deleting the report doesn't cascade delete the study
                        # Because on_delete=models.CASCADE is set on Study.id_report
                        study.id_report = None
                        study.save()
                    
                    # 2. Delete the report draft
                    report.delete()

                # 3. Notify other doctors and affected patients that studies are available again
                if unlocked_study_ids:
                    from core.notifications import notify_studies_unlocked
                    notify_studies_unlocked(unlocked_study_ids, doctor, list(patient_user_ids))
                    
        except Exception as e:
            # Log error but proceed with logout
            print(f"Error during logout cleanup: {e}")
            
    logout(request)
    return redirect("login")

@login_required
def my_profile(request):
    """
    Convenience view that safely routes the authenticated user directly to 
    their assigned DoctorProfileView, creating an empty stub profile 
    if one was mysteriously missing from an admin's incomplete creation process.
    """
    try:
        # Check if the user has a profile
        if hasattr(request.user, 'reporting_doctor_profile'):
            doctor = request.user.reporting_doctor_profile
            return redirect('doctorProfile', pk=doctor.pk)
        
        # If user is in Doctors group but has no profile, create one
        elif request.user.groups.filter(name='Doctors').exists():
            # DO NOT TRANSLATE UI STRINGS
            doctor = ReportingDoctor.objects.create(
                user=request.user,
                address="Actualizar Dirección",
                phone="Actualizar Teléfono",
                university="Actualizar Universidad",
                professional_id="Actualizar Cedula",
                specialty="Actualizar Especialidad"
            )
            return redirect('doctorProfile', pk=doctor.pk)

        else:
             # Fallback: Not a doctor, send to home
             return redirect('/')
    except Exception as e:
        print(f"Error accessing profile: {e}")        
        return redirect('/') # Or error page