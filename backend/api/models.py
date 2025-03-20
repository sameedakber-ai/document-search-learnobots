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
    slug = models.UUIDField()
    type = models.CharField(max_length=256, blank=True, choices=TYPE_CHOICES)
    properties = models.JSONField(default=dict)
    workflow = models.ForeignKey('Workflow', on_delete=models.CASCADE, blank=True, null=True)

class NodeConnection(models.Model):
    CONNECTION_CHOICES = [
        ('next', 'Next Agents'),
        ('memory', 'Memory Node'),
        ('chat_model', 'Chat Model Node'),
        ('retriever', 'Retriever Node'),
    ]
    id = models.AutoField(primary_key=True)
    source = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="connections_out")
    target = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="connections_in")
    connection_type = models.CharField(max_length=50, choices=CONNECTION_CHOICES)

    class Meta:
        # Example: enforce that for connection types that should be one-to-one (like retriever)
        # only one connection of that type exists per source node.
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
            # Add similar constraints for other one-to-one relationships if needed.
        ]



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
    id = models.AutoField(primary_key=True)
    uid = models.CharField(max_length=256, null=True)
    text = models.TextField(blank=True, null=True)
    name = models.CharField(max_length=256, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    embedding = VectorField(dimensions=1536)
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['uid', 'name'], name='unique_uid_name')
        ]


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