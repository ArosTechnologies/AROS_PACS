"""
URL configuration for clinic_api project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from clinic_api.views import health_check, ready_check
from clinical_data.views.orthanc_webhook import OrthancWebhookView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/clinical/', include('clinical_data.urls')),
    path('api/v1/clinic/webhooks/orthanc/', OrthancWebhookView.as_view(), name='orthanc_webhook_alias'),
    path('health/', health_check, name='health_check'),
    path('ready/', ready_check, name='ready_check'),
]


