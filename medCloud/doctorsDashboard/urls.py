"""
URL Routing for the Doctors Dashboard.
Registers path endpoints for the core radiological workflows.
"""
from django.urls import path
from django.contrib.auth import views as auth_views
from . import views
from core import views as core_views

urlpatterns = [
    # Main workflow Grids
    path('', views.PendingStudiesView.as_view(), name='pendingStudies'),
    path('studiesInProgress/', views.StudiesInProgressView.as_view(), name='studiesInProgress'),
    
    # Study Report Creation & Control API
    path('studyReportCreate/<int:pk>/', views.StudyReportCreateView.as_view(), name='studyReportCreate'),
    path('lockStudy/<int:study_id>/', views.lock_study, name='lockStudy'),
    path('studyDetail/<int:id_study>/', core_views.study_detail, name='studyDetail'),
    
    # Profile & Auth operations
    path('doctorProfile/<int:pk>/', views.DoctorProfileView.as_view(), name='doctorProfile'),
    path('myProfile/', views.my_profile, name='myProfile'),
    path('logout/', views.doctor_logout, name='doctor_logout'),
]