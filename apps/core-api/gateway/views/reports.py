import io
from django.http import HttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from asgiref.sync import async_to_sync
from django.template.loader import render_to_string
try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError):
    WEASYPRINT_AVAILABLE = False

from identity.models import ClinicRegistry
from gateway.services.clinic_integration import ClinicService

class StudyReportPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, study_id):
        clinic = ClinicRegistry.objects.first()
        if not clinic:
            return JsonResponse({"error": "No clinic configured"}, status=500)

        # Get study data via clinic service
        result = async_to_sync(ClinicService.get_study)(clinic, study_id)
        if result.get("status") != "ok":
            return JsonResponse({"error": "Study not found or unavailable"}, status=404)

        study = result.get("data", {})

        # Render HTML template
        context = {
            "study": study,
            "clinic": clinic,
            "layout": clinic.report_layout,
            "is_preview": False
        }
        
        html_string = render_to_string('gateway/report.html', context)
        
        if not WEASYPRINT_AVAILABLE:
            return JsonResponse({
                "error": "WeasyPrint is not installed correctly on this server. Missing system libraries (e.g. pango, gobject)."
            }, status=501)
            
        # Convert to PDF using WeasyPrint
        font_config = FontConfiguration()
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        pdf_file = html.write_pdf(font_config=font_config)
        
        # Return as PDF response
        response = HttpResponse(pdf_file, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="reporte_estudio_{study_id}.pdf"'
        return response

class StudyReportPreviewPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Allow passing custom layout to preview changes before saving
        clinic = ClinicRegistry.objects.first()
        if not clinic:
            return JsonResponse({"error": "No clinic configured"}, status=500)
            
        custom_layout = request.data.get('report_layout', clinic.report_layout)
        
        # Dummy study data
        dummy_study = {
            "id": "1234567890",
            "patient_name": "Juan Pérez (Previsualización)",
            "patient_id": "PT-0001",
            "study_date": "2026-08-26",
            "modality": "RM",
            "referring_physician": "Dra. Ana López",
            "study_instance_uid": "1.2.840.113619.2.123...",
            "study_description": "RM DE CEREBRO SIMPLE Y CONTRASTADA",
            "report_text": "Técnica: Se obtuvieron secuencias T1, T2, FLAIR, Difusión y T1 con contraste endovenoso.\n\nHallazgos:\nEl parénquima cerebral muestra morfología e intensidad de señal habituales. No se identifican lesiones ocupantes de espacio, ni colecciones intra o extra-axiales.\nEl sistema ventricular supra e infratentorial tiene tamaño y morfología conservados, sin evidencia de hidrocefalia.\nLínea media centrada.\nTras la administración de medio de contraste paramagnético (Gadolinio) no se aprecian realces anormales o patológicos.\nLas estructuras vasculares mayores de la base del cráneo presentan vacíos de flujo normales.\n\nConclusión:\nEstudio de Resonancia Magnética de Cerebro dentro de los límites normales, sin evidencia de patología intracraneal aguda ni lesiones focales expansivas."
        }

        context = {
            "study": dummy_study,
            "clinic": clinic,
            "layout": custom_layout,
            "is_preview": True
        }
        
        html_string = render_to_string('gateway/report.html', context)
        
        if not WEASYPRINT_AVAILABLE:
            return JsonResponse({
                "error": "WeasyPrint is not installed correctly on this server. Missing system libraries (e.g. pango, gobject)."
            }, status=501)
            
        font_config = FontConfiguration()
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        pdf_file = html.write_pdf(font_config=font_config)
        
        response = HttpResponse(pdf_file, content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="preview_reporte.pdf"'
        return response
