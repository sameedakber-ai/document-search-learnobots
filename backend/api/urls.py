from django.urls import path
from .views import DocumentUploadView, ChatView, NodeCreateView, EdgeCreateView, NodeListView, EdgeListView, \
    DocumentListView, NodeDeleteView, NodeUpdateView

urlpatterns = [
    path('upload/', DocumentUploadView.as_view(), name='upload'),
    path('chat/', ChatView.as_view(), name='chat'),
    path('node/create/', NodeCreateView.as_view(), name='create_node'),
    path('node/<slug:slug>/delete/', NodeDeleteView.as_view(), name='delete_node'),
    path('node/<slug:slug>/update/', NodeUpdateView.as_view(), name='update_node'),
    path('edge/create/', EdgeCreateView.as_view(), name='create_edge'),
    path('nodes/', NodeListView.as_view(), name='list_nodes'),
    path('edges/', EdgeListView.as_view(), name='list_edges'),
    path('documents/', DocumentListView.as_view(), name='list_documents'),
]