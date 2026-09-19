from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from clinical_data.models import Report

from django.core.cache import cache

class ReportView(APIView):
    """
    Create a Report with findings and conclusions.
    """
    def post(self, request):
        data = request.data
        study_uid = data.get("study_uid")
        try:
            report = None
            study = None
            
            if study_uid:
                from clinical_data.models import Study
                study = Study.objects.filter(study_uid=study_uid).first()
                if study and study.report:
                    report = study.report
                    report.status = data.get("status", "PEN")
                    report.findings = data.get("findings", "")
                    report.conclusions = data.get("conclusions", "")
                    report.save()
            
            if not report:
                report = Report.objects.create(
                    status=data.get("status", "PEN"),
                    findings=data.get("findings", ""),
                    conclusions=data.get("conclusions", ""),
                )
                if study:
                    study.report = report
                    study.save()
                
            response_data = {"status": "created", "id": report.id_report}
            if study and study.aros_patient_id:
                response_data["local_patient_id"] = study.aros_patient_id
                response_data["patient_name"] = "Paciente"
                cache.delete(f"clinic_studies_{study.aros_patient_id}")
                cache.delete("clinic_studies_all")

            return Response(response_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
