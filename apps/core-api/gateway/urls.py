from django.urls import path
from .views.federated import FederatedStudiesView
from .views.proxy import WadoRsProxyView
from .views.webhooks import ClinicWebhookReceiver
from .views.reports import StudyReportPDFView, StudyReportPreviewPDFView

urlpatterns = [
    path('studies/', FederatedStudiesView.as_view(), name='federated_studies'),
    path('webhooks/', ClinicWebhookReceiver.as_view(), name='webhook_receiver'),
    # WADO-RS Proxy Route for OHIF Viewer (Catch-all for DICOMweb paths)
    path('wado/<str:clinic_slug>/<path:dicom_path>', WadoRsProxyView.as_view(), name='wado_proxy'),
    
    # Reports
    path('studies/<str:study_id>/report/pdf/', StudyReportPDFView.as_view(), name='study_report_pdf'),
    path('clinic-config/report-preview/', StudyReportPreviewPDFView.as_view(), name='report_preview'),
]
