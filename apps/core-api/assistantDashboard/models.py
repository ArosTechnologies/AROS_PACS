from django.db import models
from django.contrib.auth.models import User

class Assistant(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, related_name='assistant_profile')
    id_assistant = models.AutoField(primary_key=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)
    address = models.CharField(max_length=100)
    phone = models.CharField(max_length=100)

    def __str__(self):
        return f"Assistant Profile {self.id_assistant}"