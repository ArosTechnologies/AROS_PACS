from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from clinical_data.models import Study
from clinical_data.authentication import S2SAuthentication

class ClinicalStudiesView(APIView):
    """
    Returns a JSON list of studies for a specific patient.
    Protected by S2S JWT Authentication.
    """
    authentication_classes = [S2SAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient_id = request.query_params.get("patient_id")
        
        if not patient_id:
            return JsonResponse({"error": "patient_id is required"}, status=400)
            
        studies = Study.objects.filter(aros_patient_id=patient_id).select_related('report', 'study_request')
        
        data = []
        for s in studies:
            report_data = None
            if s.report:
                report_data = {
                    "id_report": s.report.id_report,
                    "status": s.report.status,
                    "findings": s.report.findings,
                    "conclusions": s.report.conclusions,
                    "date": str(s.report.date) if s.report.date else None,
                    "radiologist": "Dr. Roberto Mendoza Garza (Neurorradiología y Tórax)",
                    "cedula": "CED-RAD-5521903"
                }
            data.append({
                "id_study": s.id_study,
                "study_uid": s.study_uid,
                "accession_number": s.accession_number,
                "study_date": str(s.study_date) if s.study_date else None,
                "study_description": s.study_description,
                "modality": s.modality,
                "pacs_url": s.pacs_url,
                "report": report_data
            })
        
        return JsonResponse(data, safe=False)
