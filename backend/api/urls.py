from django.urls import path
from .views import FileUploadView, WorkflowListView, WorkflowCreateView, WorkflowAgentsListView, FileListView, \
    AgentCreateView, MemoryCreateView, WorkflowChatMemoriesListView, WorkflowStartView, AgentDeleteView

urlpatterns = [
    path('upload/<slug:slug>/', FileUploadView.as_view(), name='upload_files'),
    path('<slug:slug>/files/', FileListView.as_view(), name='agent_files'),
    path('workflow/create/', WorkflowCreateView.as_view(), name='workflow_create'),
    path('workflows/', WorkflowListView.as_view(), name='workflows'),
    path('workflow/<str:id>/agents/', WorkflowAgentsListView.as_view(), name='workflow_agents'),
    path('agent/create/', AgentCreateView.as_view(), name='agent_create'),
    path('agent/<slug:slug>/delete/', AgentDeleteView.as_view(), name='agent_delete'),
    path('memory/create/', MemoryCreateView.as_view(), name='create_memory'),
    path('start-workflow/', WorkflowStartView.as_view(), name='start_workflow'),
    path('workflow/<str:id>/memories/', WorkflowChatMemoriesListView.as_view(), name='workflow_chat_memories')
]