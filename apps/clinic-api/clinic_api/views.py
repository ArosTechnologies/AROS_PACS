from django.http import JsonResponse
from django.db import connection

def health_check(request):
    """Liveness probe — returns 200 if the process is running."""
    return JsonResponse({"status": "ok"}, status=200)

def ready_check(request):
    """Readiness probe — validates DB connection before accepting traffic."""
    try:
        connection.ensure_connection()
        return JsonResponse({"status": "ready", "db": "ok"}, status=200)
    except Exception as e:
        return JsonResponse({"status": "not_ready", "error": str(e)}, status=503)
