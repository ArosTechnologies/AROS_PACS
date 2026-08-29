from django.apps import AppConfig


class ClinicalDataConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'clinical_data'

    def ready(self):
        import clinical_data.signals
