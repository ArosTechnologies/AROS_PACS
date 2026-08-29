from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from clinical_data.models import StudyRequest

class StudyRequestView(APIView):
    """
    Create a StudyRequest linked to an AROS patient_id.
    """
    def post(self, request):
        data = request.data
        patient_id = data.get("patient_id")
        if not patient_id:
            return Response({"error": "patient_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            study_req = StudyRequest.objects.create(
                aros_patient_id=patient_id,
                study_type=data.get("study_type", ""),
                accession_number=data.get("accession_number"),
            )
            return Response({"status": "created", "id": study_req.id_request}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
