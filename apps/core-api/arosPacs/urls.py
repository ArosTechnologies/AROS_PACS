from django.contrib import admin
from django.urls import path
from core.views import health_check, ready_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health_check'),
    path('ready/', ready_check, name='ready_check'),
]
