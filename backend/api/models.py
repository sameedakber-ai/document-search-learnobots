import os
import uuid

from django.conf.global_settings import MEDIA_ROOT
from django.db import models
from django.utils.timezone import now
from dotenv import load_dotenv
from .validators import validate_is_type, validate_is_readable
from django.contrib.auth.models import User
from pgvector.django import VectorField

load_dotenv()


def get_upload_path(instance, filename):
    name, extension = os.path.splitext(filename)
    file_path = f'documents/{name}{extension}'
    return file_path

class Agent(models.Model):
    TYPE_CHOICES = [
        ('documentLoader', 'Document Loader'),
        ('chat', 'Chat'),
        ('chatTrigger', 'Chat Trigger'),
        ('memory', 'Memory'),
        ('chatModel', 'Chat Model'),
        ('vectorStore', 'Vector Store'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=256, blank=True, choices=TYPE_CHOICES)
    properties = models.JSONField(default=dict)
    workflow = models.ForeignKey('Workflow', on_delete=models.CASCADE)

class NodeConnection(models.Model):
    CONNECTION_CHOICES = [
        ('next', 'Next Agents'),
        ('memory', 'Memory Node'),
        ('chat_model', 'Chat Model Node'),
        ('retriever', 'Retriever Node'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="connections_out")
    target = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="connections_in")
    connection_type = models.CharField(max_length=50, choices=CONNECTION_CHOICES)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['source', 'connection_type'],
                condition=models.Q(connection_type='retriever'),
                name='unique_retriever_per_source'
            ),
            models.UniqueConstraint(
                fields=['source', 'connection_type'],
                condition=models.Q(connection_type='chat_model'),
                name='unique_chat_model_per_source'
            ),
            models.UniqueConstraint(
                fields=['source', 'connection_type'],
                condition=models.Q(connection_type='memory'),
                name='unique_memory_per_source'
            )
        ]

class File(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to=get_upload_path, validators=(validate_is_type, validate_is_readable))
    date = models.DateTimeField(auto_now_add=True)
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='files')

    def __str__(self):
        return self.file

    @property
    def get_path(self):
        return f'{MEDIA_ROOT}/{str(self.file)}'

    @property
    def get_ext(self):
        return os.path.splitext(self.get_path)[1].lstrip('.').lower()

class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    uid = models.CharField(max_length=256, editable=False)
    text = models.TextField()
    name = models.CharField(max_length=256)
    date = models.DateTimeField(auto_now_add=True)
    embedding = VectorField(dimensions=1536)
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='documents')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['uid', 'name'], name='unique_uid_name')
        ]

class Workflow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=256)
    date = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workflows')

class Memory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.UUIDField(unique=True)
    input = models.TextField()
    output = models.TextField(blank=True, null=True)
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='memories')