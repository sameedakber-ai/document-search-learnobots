from django.db import models
from .helpers import get_upload_path
from .validators import validate_is_type, validate_is_readable
from django.contrib.auth.models import User

class Document(models.Model):
    file = models.FileField(upload_to=get_upload_path, validators=(validate_is_type, validate_is_readable))
    name = models.CharField(max_length=256, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, blank=True, null=True)
