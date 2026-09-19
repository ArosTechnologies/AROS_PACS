from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from clinical_data.models import Study
from clinical_data.authentication import S2SAuthentication

from django.core.cache import cache

class ClinicalStudiesView(APIView):
    """
    Returns a JSON list of studies for a specific patient.
    Protected by S2S JWT Authentication.
    """
    authentication_classes = [S2SAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient_id = request.query_params.get("patient_id")
        
        cache_key = f"clinic_studies_{patient_id}" if patient_id else "clinic_studies_all"
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return JsonResponse(cached_data, safe=False)
            
        if patient_id:
            studies = Study.objects.filter(aros_patient_id=patient_id).select_related('report', 'study_request')
        else:
            # If no patient_id is provided, return all studies (used by the Clinic worklist)
            studies = Study.objects.all().select_related('report', 'study_request')
        
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
                "report": report_data,
                "aros_patient_id": s.aros_patient_id
            })
            
        cache.set(cache_key, data, timeout=300)
        
        return JsonResponse(data, safe=False)

class ClinicalStudyDetailView(APIView):
    """
    Returns a single study by its study_uid.
    Used by the AROS Core Gateway for generating PDFs.
    """
    authentication_classes = [S2SAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, study_uid):
        try:
            s = Study.objects.select_related('report', 'study_request').get(study_uid=study_uid)
        except Study.DoesNotExist:
            return JsonResponse({"error": "Study not found"}, status=404)
            
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
        data = {
            "id_study": s.id_study,
            "study_uid": s.study_uid,
            "accession_number": s.accession_number,
            "study_date": str(s.study_date) if s.study_date else None,
            "study_description": s.study_description,
            "modality": s.modality,
            "pacs_url": s.pacs_url,
            "report": report_data,
            "aros_patient_id": s.aros_patient_id
        }
        return JsonResponse(data)
