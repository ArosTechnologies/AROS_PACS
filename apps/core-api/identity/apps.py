from django.apps import AppConfig


class IdentityConfig(AppConfig):
    name = 'identity'

    def ready(self):
        import identity.signals
