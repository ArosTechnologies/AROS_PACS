"""
Form definitions for the Patients Dashboard.
Contains logic for patient self-registration and profile profile updates.
Overrides underlying Django Auth User fields implicitly for a unified UI.
"""
from django import forms
from .models import Patient

class PatientForm(forms.ModelForm):
    """
    Update form for an existing Patient's profile settings.
    Integrates base `User` fields (First Name, Last Name, Email) with 
    the customized `Patient` model fields (Address, Phone, Gender).
    """
    first_name = forms.CharField(max_length=30, label='Nombre')
    last_name = forms.CharField(max_length=30, label='Apellido')
    email = forms.EmailField(label='Email')

    class Meta:
        model = Patient
        fields = ['address', 'phone', 'gender']

    def __init__(self, *args, **kwargs):
        """
        Populate the disconnected User fields into the visual form 
        when the model instance is first loaded for editing.
        """
        super(PatientForm, self).__init__(*args, **kwargs)
        if self.instance and self.instance.user:
            self.fields['first_name'].initial = self.instance.user.first_name
            self.fields['last_name'].initial = self.instance.user.last_name
            self.fields['email'].initial = self.instance.user.email

    def save(self, commit=True):
        """
        Coordinates the dual-save sequence: applies properties back 
        to both the underlying `User` object and the `Patient` profile object.
        """
        patient = super(PatientForm, self).save(commit=False)
        if self.cleaned_data.get('first_name'):
            patient.user.first_name = self.cleaned_data['first_name']
        if self.cleaned_data.get('last_name'):
            patient.user.last_name = self.cleaned_data['last_name']
        if self.cleaned_data.get('email'):
            patient.user.email = self.cleaned_data['email']
        
        if commit:
            patient.user.save()
            patient.save()
        return patient

class PatientSignupForm(forms.ModelForm):
    """
    Custom registration form allowing new Patients to sign up from the public site.
    Handles cryptographic password validation and creates the proxy user entities.
    """
    first_name = forms.CharField(max_length=30, label='Nombre', widget=forms.TextInput(attrs={'placeholder': 'Ej. Ana'}))
    last_name = forms.CharField(max_length=30, label='Apellidos', widget=forms.TextInput(attrs={'placeholder': 'Ej. López'}))
    email = forms.EmailField(label='Correo Electrónico', widget=forms.EmailInput(attrs={'placeholder': 'paciente@ejemplo.com'}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={'placeholder': '••••••••'}), label='Contraseña')
    password_confirm = forms.CharField(widget=forms.PasswordInput(attrs={'placeholder': '••••••••'}), label='Confirmar Contraseña')

    class Meta:
        model = Patient
        fields = ['address', 'phone', 'gender']
        labels = {
            'address': 'Dirección',
            'phone': 'Teléfono',
            'gender': 'Género'
        }
        widgets = {
            'address': forms.TextInput(attrs={'placeholder': 'Ej. Calle Principal 456'}),
            'phone': forms.TextInput(attrs={'placeholder': 'Ej. 555 987 6543'}),
        }

    def clean_email(self):
        """Validate email system uniqueness strictly for Patient signups."""
        email = self.cleaned_data.get('email')
        if Patient.objects.filter(user__email=email).exists():
            raise forms.ValidationError("Este correo electrónico ya está registrado.")
        return email

    def clean(self):
        """Cross-validate password fields."""
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        password_confirm = cleaned_data.get("password_confirm")

        if password and password_confirm and password != password_confirm:
            self.add_error('password_confirm', "Las contraseñas no coinciden")
        return cleaned_data

    def save(self, commit=True):
        """
        Handles combined profile and user creation leveraging Django's 
        internal `create_user` implementation.
        """
        from django.contrib.auth.models import User
        
        # Create user
        # We use email as username since login expects email
        user = User.objects.create_user(
            username=self.cleaned_data['email'], 
            email=self.cleaned_data['email'],
            password=self.cleaned_data['password'],
            first_name=self.cleaned_data['first_name'],
            last_name=self.cleaned_data['last_name']
        )
        
        patient = super(PatientSignupForm, self).save(commit=False)
        patient.user = user
        
        if commit:
            patient.save()
        return patient
