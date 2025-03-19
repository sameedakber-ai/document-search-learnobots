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
        ('vectorStore', 'Vector Store')
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.UUIDField()
    type = models.CharField(max_length=256, blank=True, choices=TYPE_CHOICES)
    properties = models.JSONField(default=dict)
    workflow = models.ForeignKey('Workflow', on_delete=models.CASCADE, blank=True, null=True)
    next_agents = models.ManyToManyField(
        "self",
        blank=True,
        related_name='prev_agents',
        symmetrical=False
    )
    memory_node = models.OneToOneField(
        "self",
        blank=True,
        null=True,
        related_name='head_memory_agent',
        on_delete=models.SET_NULL
    )
    chat_model_node = models.OneToOneField(
        "self",
        blank=True,
        null=True,
        related_name='head_chat_model_node',
        on_delete=models.SET_NULL
    )
    tool_nodes = models.ManyToManyField(
        "self",
        blank=True,
        related_name='head_tool_agents',
        symmetrical=False
    )


class File(models.Model):
    file = models.FileField(upload_to=get_upload_path, validators=(validate_is_type, validate_is_readable))
    date = models.DateTimeField(auto_now_add=True)
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, blank=True, null=True, related_name='files')

    def __str__(self):
        return self.file

    @property
    def get_path(self):
        return f'{MEDIA_ROOT}/{self.file}'

    @property
    def get_ext(self):
        return os.path.splitext(self.get_path)[1].lstrip('.').lower()


class Document(models.Model):
    text = models.TextField(blank=True, null=True)
    name = models.CharField(max_length=256, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    embedding = VectorField(dimensions=1536)
    file = models.ForeignKey(File, on_delete=models.CASCADE, blank=True, null=True, related_name='documents')


class Entity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=256, blank=True)
    value = models.CharField(max_length=256, blank=True)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, blank=True, null=True, related_name='entities')
    properties = models.JSONField(default=dict)


class Relationship(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=256, blank=True)
    source = models.ForeignKey(Entity, on_delete=models.CASCADE, blank=True, null=True, related_name='outgoing_relationships')
    target = models.ForeignKey(Entity, on_delete=models.CASCADE, blank=True, null=True, related_name='incoming_relationships')
    properties = models.JSONField(default=dict)


class Workflow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=256, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, blank=True, null=True, related_name='workflows')


class Memory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    input = models.TextField(blank=True, null=True)
    output = models.TextField(blank=True, null=True)
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, blank=True, null=True, related_name='memories')