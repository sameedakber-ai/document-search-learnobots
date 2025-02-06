import os

from django.conf.global_settings import MEDIA_ROOT
from django.db import models
from django.utils.timezone import now
from dotenv import load_dotenv

from .helpers import get_upload_path, Element
from .validators import validate_is_type, validate_is_readable
from django.contrib.auth.models import User

load_dotenv()

class Document(models.Model):
    file = models.FileField(upload_to=get_upload_path, validators=(validate_is_type, validate_is_readable))
    name = models.CharField(max_length=256, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    loaded = models.BooleanField(default=False)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, blank=True, null=True)

    def __str__(self):
        return self.name

    @property
    def get_path(self):
        return f'{MEDIA_ROOT}/{self.file}'

    @property
    def get_ext(self):
        return os.path.splitext(self.get_path)[1].lstrip('.').lower()



class Chat(models.Model):
    input = models.TextField(default='')
    output = models.TextField(default='')
    date = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, blank=True, null=True)


# class ProcessingJob(models.Model):
#     TASK_CHOICES = [
#         ('load_elements', 'Load Elements'),
#         ('entity_extraction', 'Entity Extraction'),
#         ('embedding_generation', 'Embedding Generation'),
#         ('relationship_mapping', 'Relationship Mapping'),
#     ]
#
#     STATUS_CHOICES = [
#         ('queued', 'Queued'),
#         ('in_progress', 'In Progress'),
#         ('completed', 'Completed'),
#         ('failed', 'Failed'),
#     ]
#
#     document = models.ForeignKey('Document', on_delete=models.CASCADE, related_name='processing_jobs')
#     task_type = models.CharField(max_length=50, choices=TASK_CHOICES)
#     status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
#     progress = models.FloatField(default=0.0, help_text="Percentage of task completion (0 to 100)")
#     started_at = models.DateTimeField(null=True, blank=True)
#     completed_at = models.DateTimeField(null=True, blank=True)
#     error_message = models.TextField(null=True, blank=True, help_text="Stores error details if the job fails")
#     metadata = models.JSONField(null=True, blank=True, help_text="Additional data related to the task")
#
#     def start(self):
#         self.status = 'in_progress'
#         self.started_at = now()
#         self.save()
#
#     def complete(self):
#         self.status = 'completed'
#         self.progress = 100.0
#         self.completed_at = now()
#         self.save()
#
#     def fail(self, error_message):
#         self.status = 'failed'
#         self.error_message = error_message
#         self.completed_at = now()
#         self.save()
#
#     def __str__(self):
#         return f"{self.get_task_type_display()} for Document {self.document.id} ({self.status})"
#
#
# class ElementResult(models.Model):
#     document = models.ForeignKey('Document', on_delete=models.CASCADE, related_name='element_results')
#     processing_job = models.ForeignKey('ProcessingJob', on_delete=models.CASCADE, related_name='element_results')
#     elements = models.JSONField()
#     created_at = models.DateTimeField(auto_now_add=True)
#
#     def set_elements(self, entities: list[Element]):
#         """
#         Accepts a list of Pydantic Entity objects and stores it as JSON.
#         """
#         self.elements = [entity.dict() for entity in entities]
#
#     def get_elements(self) -> list[Element]:
#         """
#         Returns the stored JSON data as a list of Pydantic Entity objects.
#         """
#         return [Element(**data) for data in self.elements]


# class Node(models.Model):
#     """
#     Represents a single node in the graph.
#     """
#     TYPE_CHOICES = [
#         ('documentLoader', 'Document Loader'),
#         ('textUpdater', 'Text Updater'),
#         ('askAI', 'Ask AI'),
#     ]
#     slug = models.UUIDField()
#     label = models.CharField(max_length=255, blank=True, default='')
#     description = models.TextField(blank=True, default='')
#     position_x = models.FloatField(default=0)
#     position_y = models.FloatField(default=0)
#     created_at = models.DateTimeField(auto_now_add=True)
#     type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='documentLoader')
#     user = models.ForeignKey(User, related_name='nodes', on_delete=models.CASCADE)
#     data = models.JSONField(default=dict, blank=True)
#
#     def __str__(self):
#         return self.label
#
#     @staticmethod
#     def get_all_descendants(node):
#         """
#         Recursively fetches all descendants of a node (i.e., all children and their children).
#         """
#         descendants = set()
#
#         # Get direct children (outgoing edges)
#         direct_children = Node.objects.filter(incoming_edges__source=node)
#
#         for child in direct_children:
#             # Add child to descendants set
#             descendants.add(child)
#
#             # Recursively get the descendants of each child
#             child_descendants = Node.get_all_descendants(child)
#             descendants.update(child_descendants)
#
#         return descendants
#
#
# class Edge(models.Model):
#     """
#     Represents an edge between two nodes.
#     """
#     slug = models.UUIDField()
#     source = models.ForeignKey(Node, related_name="outgoing_edges", on_delete=models.CASCADE)
#     target = models.ForeignKey(Node, related_name="incoming_edges", on_delete=models.CASCADE)
#     label = models.CharField(max_length=255, blank=True, null=True)
#     created_at = models.DateTimeField(auto_now_add=True)
#
#     def __str__(self):
#         return f"{self.source.label} -> {self.target.label}"
