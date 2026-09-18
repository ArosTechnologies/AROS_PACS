"""
ASGI config for arosPacs project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'arosPacs.settings')
django_asgi_app = get_asgi_application()

from gateway.middleware import JWTAuthMiddlewareStack
import gateway.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddlewareStack(
        URLRouter(
            gateway.routing.websocket_urlpatterns
        )
    ),
})
