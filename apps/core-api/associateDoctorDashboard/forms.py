"""
Form definitions for the Associate Doctor Dashboard.
Handles the secure signup process and validation for new referring physicians.
"""
from django import forms
from .models import AssociateDoctor
from django.contrib.auth.models import User

class AssociateDoctorSignupForm(forms.ModelForm):
    """
    Custom registration form for Associate Doctors.
    Collects both base User data (email, name, password) and specific 
    AssociateDoctor profile data (professional ID, university) in a single step.
    """
    first_name = forms.CharField(max_length=30, label='Nombre', widget=forms.TextInput(attrs={'placeholder': 'Ej. Juan'}))
    last_name = forms.CharField(max_length=30, label='Apellidos', widget=forms.TextInput(attrs={'placeholder': 'Ej. Pérez García'}))
    email = forms.EmailField(label='Correo Electrónico', widget=forms.EmailInput(attrs={'placeholder': 'medico@hospital.com'}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={'placeholder': '••••••••'}), label='Contraseña')
    password_confirm = forms.CharField(widget=forms.PasswordInput(attrs={'placeholder': '••••••••'}), label='Confirmar Contraseña')
    
    # Associate Doctor specific fields
    professional_id = forms.CharField(label='Cédula Profesional', max_length=100, widget=forms.TextInput(attrs={'placeholder': 'Ej. 12345678'}))
    university = forms.CharField(label='Universidad', max_length=100, widget=forms.TextInput(attrs={'placeholder': 'Ej. UNAM'}))
    specialty = forms.CharField(label='Especialidad', max_length=100, widget=forms.TextInput(attrs={'placeholder': 'Ej. Cardiología'}))

    class Meta:
        model = AssociateDoctor
        fields = ['address', 'phone', 'university', 'professional_id', 'specialty']
        labels = {
            'address': 'Dirección',
            'phone': 'Teléfono',
        }
        widgets = {
            'address': forms.TextInput(attrs={'placeholder': 'Ej. Av. Siempre Viva 123'}),
            'phone': forms.TextInput(attrs={'placeholder': 'Ej. 555 123 4567'}),
        }

    def clean_email(self):
        """
        Validates that the provided email address is unique across the entire 
        system (checked against the base Django User model).
        """
        email = self.cleaned_data.get('email')
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("Este correo electrónico ya está registrado.")
        return email

    def clean(self):
        """
        Cross-field validation.
        Ensures that the password and password_confirm fields match exactly.
        """
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        password_confirm = cleaned_data.get("password_confirm")

        if password and password_confirm and password != password_confirm:
            self.add_error('password_confirm', "Las contraseñas no coinciden")
        return cleaned_data


