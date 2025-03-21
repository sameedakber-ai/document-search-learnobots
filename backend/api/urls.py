from django.urls import path
from .views import FileUploadView, WorkflowListView, WorkflowCreateView, WorkflowAgentsListView, \
    AgentCreateView, WorkflowStartView, AgentDeleteView, AgentConnectionCreateView, WorkflowResetView

urlpatterns = [
    path('<slug:slug>/files/upload/', FileUploadView.as_view(), name='upload_files'),
    path('workflow/create/', WorkflowCreateView.as_view(), name='workflow_create'),
    path('workflows/', WorkflowListView.as_view(), name='workflows'),
    path('workflow/<str:id>/agents/', WorkflowAgentsListView.as_view(), name='workflow_agents'),
    path('agent/create/', AgentCreateView.as_view(), name='agent_create'),
    path('connection/create/', AgentConnectionCreateView.as_view(), name='create_connection'),
    path('agent/<slug:slug>/delete/', AgentDeleteView.as_view(), name='agent_delete'),
    path('start-workflow/<str:id>/', WorkflowStartView.as_view(), name='start_workflow'),
    path('reset-workflow/<str:id>/', WorkflowResetView.as_view(), name='reset-workflow'),
]