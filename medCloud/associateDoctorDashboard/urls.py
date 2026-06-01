"""
URL Routing for the Associate Doctor Dashboard.
Maps incoming HTTP paths to views for the referring physician portal,
including registration, dashboard access, and study visualization.
"""
from django.urls import path
from . import views
from core import views as core_views

urlpatterns = [
    # Dashboard and Profile
    path('', views.DashboardView.as_view(), name='associate_dashboard'),
    path('profile/', views.ProfileView.as_view(), name='associate_profile'),
    
    # Registration and Authentication
    path('signup/', views.signup, name='associate_signup'),
    path('logout/', views.associate_logout, name='associate_logout'),
    
    # Study Visualization
    # Maps directly to the core app's centralized study detail view
    path('studyDetail/<int:id_study>/', core_views.study_detail, name='studyDetail'),
]
