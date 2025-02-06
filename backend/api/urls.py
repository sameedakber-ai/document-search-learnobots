from django.urls import path
from .views import DocumentUploadView, ChatView, NodeCreateView, EdgeCreateView, NodeListView, EdgeListView, \
    DocumentListView

urlpatterns = [
    path('upload/', DocumentUploadView.as_view(), name='upload'),
    path('chat/', ChatView.as_view(), name='chat'),
    path('node/create/', NodeCreateView.as_view(), name='create_node'),
    path('edge/create/', EdgeCreateView.as_view(), name='create_edge'),
    path('nodes/', NodeListView.as_view(), name='list_nodes'),
    path('edges/', EdgeListView.as_view(), name='list_edges'),
    path('documents/', DocumentListView.as_view(), name='list_documents'),
]