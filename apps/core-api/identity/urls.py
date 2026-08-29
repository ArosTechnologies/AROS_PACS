from django.urls import path
from .views import (
    JWKSView, LogoutView, CookieTokenObtainPairView, CookieTokenRefreshView, 
    UserProfileView, ClinicUsersView, ClinicUserDetailView, PatientListView, ClinicConfigView, UserAvatarUploadView
)
from .auth_views import PatientRegistrationView, PhysicianRegistrationView, VerifyEmailView
from .patient_views import PatientMeView, PatientDoctorsView, ClinicsView, ClinicRateView
from .physician_views import PhysicianPatientsView, PhysicianStudiesView, PhysicianStudyDetailView

urlpatterns = [
    path('login/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('register/patient/', PatientRegistrationView.as_view(), name='register_patient'),
    path('register/physician/', PhysicianRegistrationView.as_view(), name='register_physician'),
    path('verify-email/<str:token>/', VerifyEmailView.as_view(), name='verify_email'),
    path('refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='auth_logout'),
    path('me/', UserProfileView.as_view(), name='auth_me'),
    path('me/avatar/', UserAvatarUploadView.as_view(), name='auth_me_avatar'),
    path('users/', ClinicUsersView.as_view(), name='clinic_users'),
    path('users/<uuid:pk>/', ClinicUserDetailView.as_view(), name='clinic_user_detail'),
    path('patients/', PatientListView.as_view(), name='patients_list'),
    path('clinic-config/', ClinicConfigView.as_view(), name='clinic_config'),
    
    # Patient Portal Specific Endpoints
    path('patient/me/', PatientMeView.as_view(), name='patient_me'),
    path('patient/doctors/', PatientDoctorsView.as_view(), name='patient_doctors'),
    path('clinics/', ClinicsView.as_view(), name='patient_clinics'),
    path('patient/clinics/rate/', ClinicRateView.as_view(), name='patient_clinic_rate'),

    # Physician Portal Specific Endpoints
    path('physician/patients/', PhysicianPatientsView.as_view(), name='physician_patients'),
    path('physician/studies/', PhysicianStudiesView.as_view(), name='physician_studies'),
    path('physician/studies/<str:study_uid>/', PhysicianStudyDetailView.as_view(), name='physician_study_detail'),
]

