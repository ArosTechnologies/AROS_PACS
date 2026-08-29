from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from clinical_data.models import Report

class ReportView(APIView):
    """
    Create a Report with findings and conclusions.
    """
    def post(self, request):
        data = request.data
        study_uid = data.get("study_uid")
        try:
            report = Report.objects.create(
                status=data.get("status", "PEN"),
                findings=data.get("findings", ""),
                conclusions=data.get("conclusions", ""),
            )
            
            if study_uid:
                from clinical_data.models import Study
                study = Study.objects.get(study_uid=study_uid)
                study.report = report
                study.save()
                
            return Response({"status": "created", "id": report.id_report}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
