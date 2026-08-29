from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "ok", "service": "clinic-api"})

def ready_check(request):
    return JsonResponse({"status": "ready"})
