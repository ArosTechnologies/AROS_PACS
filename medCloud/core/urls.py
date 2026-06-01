"""
URL Routing for the Core engine.
Maps fundamental routes, such as PDF generation endpoints and email verification callbacks.
"""
from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    # Endpoint for downloading the generated encrypted PDF report
    path('report/<int:report_id>/pdf/', views.generate_report_pdf, name='report_pdf'),
    
    # Callback endpoint for email address verification
    path('verify-email/<str:token>/', views.verify_email, name='verify_email'),
]
