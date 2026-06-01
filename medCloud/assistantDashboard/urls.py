"""
URL Routing for the Assistant Dashboard.
Maps incoming HTTP request paths to their corresponding Django Views and API endpoints.
All routes under this module inherently require the 'Assistants' group authorization.
"""
from django.urls import path
from . import views
from . import api

urlpatterns = [
    # Dashboard and UI Views
    path('', views.AssistantDashboardView.as_view(), name='assistant_dashboard'),
    path('all-requests/', views.AllStudyRequestsView.as_view(), name='all_study_requests'),
    path('new-request/', views.StudyRequestCreateView.as_view(), name='new_study_request'),
    path('profile/', views.AssistantProfileView.as_view(), name='assistant_profile'),
    
    # Utilities
    path('logout/', views.assistant_logout, name='assistant_logout'),
    path('ticket/<int:study_request_id>/', views.print_ticket, name='print_ticket'),
    
    # JSON API Endpoints (Used by AJAX/Fetch requests in the UI)
    path('api/patient-search/', api.patient_search, name='patient_search_api'),
    path('api/create-patient/', api.create_patient, name='create_patient_api'),
    path('api/verify-doctor/', api.verify_doctor, name='verify_doctor_api'),
]