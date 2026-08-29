from django.urls import path
from .views.studies import ClinicalStudiesView
from .views.wado import OrthancWadoProxyView
from .views.study_requests import StudyRequestView
from .views.reports import ReportView
from .views.orthanc_webhook import OrthancWebhookView
urlpatterns = [
    path('studies/', ClinicalStudiesView.as_view(), name='clinic_studies'),
    path('study-requests/', StudyRequestView.as_view(), name='clinic_study_requests'),
    path('reports/', ReportView.as_view(), name='clinic_reports'),
    path('orthanc-webhook/', OrthancWebhookView.as_view(), name='orthanc_webhook'),
    path('wado/studies/<str:study_uid>/', OrthancWadoProxyView.as_view(), name='clinic_wado_study'),
    path('wado/studies/<str:study_uid>/series/<str:series_uid>/', OrthancWadoProxyView.as_view(), name='clinic_wado_series'),
    path('wado/studies/<str:study_uid>/series/<str:series_uid>/instances/<str:instance_uid>/', OrthancWadoProxyView.as_view(), name='clinic_wado_instance'),
]
