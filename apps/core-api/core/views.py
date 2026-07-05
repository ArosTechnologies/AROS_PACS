from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "ok", "service": "aros-core-api"})

def ready_check(request):
    # En el futuro, verificar conexión a BD/Redis aquí
    return JsonResponse({"status": "ready"})