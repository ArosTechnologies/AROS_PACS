"""
Core Custom Authentication Mixins.
Leveraged by Django Class-Based Views to strictly enforce Role-Based Access Control (RBAC) 
and securely inject authenticated user profiles directly into the rendering template context.
"""
from django.contrib.auth.mixins import UserPassesTestMixin

class DoctorRequiredMixin(UserPassesTestMixin):
    """
    Enforces authorization allowing ONLY internal Reporting Radiologists
    who belong to the 'Doctors' Django auth group to utilize the View.
    Injects the `reporting_doctor` profile into the HTML context.
    """
    def test_func(self):
        return self.request.user.groups.filter(name='Doctors').exists()

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if hasattr(self.request.user, 'reporting_doctor_profile'):
            context['reporting_doctor'] = self.request.user.reporting_doctor_profile
        return context

class PatientRequiredMixin(UserPassesTestMixin):
    """
    Enforces authorization allowing ONLY registered Patients
    who belong to the 'Patients' Django auth group to utilize the View.
    Injects the `patient` profile into the HTML context.
    """
    def test_func(self):
        return self.request.user.groups.filter(name='Patients').exists()
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if hasattr(self.request.user, 'patient_profile'):
            context['patient'] = self.request.user.patient_profile
        return context

class AssociatedDoctorRequiredMixin(UserPassesTestMixin):
    """
    Enforces authorization allowing ONLY referring Associate Doctors
    who belong to the 'AssociatedDoctors' Django auth group to utilize the View.
    Injects the `associated_doctor` profile into the HTML context.
    """
    def test_func(self):
        return self.request.user.groups.filter(name='AssociatedDoctors').exists()
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if hasattr(self.request.user, 'associated_doctor_profile'):
            context['associated_doctor'] = self.request.user.associated_doctor_profile
        return context

class AssistantRequiredMixin(UserPassesTestMixin):
    """
    Enforces authorization allowing ONLY administrative front-desk staff
    who belong to the 'Assistants' Django auth group to utilize the View.
    Injects the `assistant` profile into the HTML context.
    """
    def test_func(self):
        return self.request.user.groups.filter(name='Assistants').exists()
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if hasattr(self.request.user, 'assistant_profile'):
            context['assistant'] = self.request.user.assistant_profile
        return context
