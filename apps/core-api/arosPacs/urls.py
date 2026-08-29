from django.contrib import admin
from django.urls import path, include
from core.views import health_check, ready_check
from identity.views import JWKSView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('identity.urls')),
    path('api/v1/.well-known/jwks.json', JWKSView.as_view(), name='jwks'),
    path('api/v1/gateway/', include('gateway.urls')),
    path('health/', health_check, name='health_check'),
    path('ready/', ready_check, name='ready_check'),
]

from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG or not getattr(settings, 'USE_S3', True):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
