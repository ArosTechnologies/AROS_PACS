from django import forms
from assistantDashboard.models import StudyRequest

class StudyRequestForm(forms.ModelForm):
    class Meta:
        model = StudyRequest
        fields = ['email_doctor', 'requested_study']
