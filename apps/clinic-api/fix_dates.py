import os
import django
import random
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'clinic_api.settings')
django.setup()

from clinical_data.models import Study

studies = Study.objects.all()
for s in studies:
    days = random.randint(0, 30)
    s.study_date = date.today() - timedelta(days=days)
    s.save()

print(f"Updated {studies.count()} studies with random dates.")
