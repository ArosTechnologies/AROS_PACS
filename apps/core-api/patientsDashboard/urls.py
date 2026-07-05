"""
URL Routing for the Patients Dashboard.
Maps incoming HTTP request paths to their corresponding Django Views and API endpoints.
Provides routes for dashboard viewing, explicit doctor privacy management, and profiling.
"""
from django.urls import path
from django.contrib.auth import views as auth_views
from . import views
from . import api
from core import views as core_views

app_name = 'patientsDashboard'

urlpatterns = [
    # Registration & Auth
    path('signup/', views.signup, name='signup'),
    path('logout/', views.patient_logout, name='logout'),
    
    # Dashboard & Profile Settings
    path('', views.PatientDashboardView.as_view(), name='patientsDashboard'),
    path('profile/', views.PatientProfileView.as_view(), name='profile'),
    path('profile/edit/', views.PatientProfileUpdateView.as_view(), name='profile_edit'),
    
    # Study Result Views
    path('studyDetail/<int:id_study>/', core_views.study_detail, name='studyDetail'),
    
    # Security/Privacy settings: Managing Associate Doctor access
    path('manage-doctors/', views.ManageDoctorsView.as_view(), name='manage_doctors'),
    path('api/doctor-search/', api.doctor_search, name='doctor_search_api'),
    path('api/toggle-doctor/', api.toggle_doctor, name='toggle_doctor_api'),
]