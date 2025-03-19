import json

from django.shortcuts import render
from django.contrib.auth.models import User

from .helpers import Neo4jNodes
from .models import Document, Workflow, Agent, Memory

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .serializers import UserSerializer, DocumentSerializer, FileSerializer, WorkflowSerializer, \
    AgentSerializer, MemorySerializer
from .services import DocumentProcessService, ChatService
from .tasks import process_workflow


class UserCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = UserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        serializer = UserSerializer(user)

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FileUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug, *args, **kwargs):
        agent = Agent.objects.get(slug=slug)
        serializer = FileSerializer(data=request.data, context={'request': request, 'agent': agent})
        serializer.is_valid(raise_exception=True)

        file = serializer.save()

        serializer = FileSerializer(file)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class FileListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug, *args, **kwargs):
        agent = Agent.objects.get(slug=slug)
        files = agent.files.all()

        serializer = FileSerializer(files, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class WorkflowCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = WorkflowSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        workflow = serializer.save()

        serializer = WorkflowSerializer(workflow)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class WorkflowListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        workflows = Workflow.objects.all()

        serializer = WorkflowSerializer(workflows, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class AgentCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = AgentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        agent = serializer.save()

        serializer = AgentSerializer(agent)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class AgentDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, slug, *args, **kwargs):
        agent = Agent.objects.get(slug=slug)
        agent.delete()

        return Response({'message': 'node deleted'}, status=status.HTTP_200_OK)

class WorkflowAgentsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id, *args, **kwargs):
        workflow = Workflow.objects.get(pk=id)
        agents = Agent.objects.filter(workflow=workflow)

        serializer = AgentSerializer(agents, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class WorkflowChatMemoriesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id, *args, **kwargs):
        workflow = Workflow.objects.get(pk=id)
        memories = Memory.objects.filter(workflow=workflow)
        print(memories)

        serializer = MemorySerializer(memories, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class MemoryCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        print(request.data)
        serializer = MemorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        memory = serializer.save()
        memory.output = ChatService.execute_workflow(memory)
        memory.save()

        serializer = MemorySerializer(memory)
        print(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WorkflowStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        node_id = request.data.get('node_id')
        trigger_id = request.data.get('trigger_id')
        chat_input = request.data.get('input')

        outputs = process_workflow(node_id, trigger_id, chat_input)

        return Response({"status": "Workflow started", "outputs": outputs})


class NodeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        neo4j = Neo4jNodes()
        data = request.data

        node_id = neo4j.create_node(
            slug=data.get('slug'),
            label=data.get("label", ""),
            node_type=data.get("type", "documentLoader"),
            canvas_id=data.get("canvas_id"),
            user_id=request.user.id,
            position_x=data.get("position_x"),
            position_y=data.get("position_y"),
        )

        neo4j.close()
        return Response({"node_id": node_id}, status=status.HTTP_201_CREATED)

class NodeDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, slug, *args, **kwargs):
        neo4j = Neo4jNodes()
        data = request.data

        neo4j.delete_node(slug=slug)
        return Response({"message": "Node deleted successfully"}, status=status.HTTP_200_OK)


class NodeUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug, *args, **kwargs):
        neo4j = Neo4jNodes()
        data = request.data

        node_id = neo4j.upsert_node(slug=slug, data=data, user_id=request.user.id)
        return Response({"message": "Node updated successfully"}, status=status.HTTP_200_OK)


class EdgeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        neo4j = Neo4jNodes()
        data = request.data

        edge_id = neo4j.create_edge(
            user_id=request.user.id,
            slug=data.get("slug"),
            source_id=data.get("source_id"),
            target_id=data.get("target_id"),
        )

        neo4j.close()
        return Response({"edge_id": edge_id}, status=status.HTTP_201_CREATED)


class NodeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        neo4j = Neo4jNodes()
        nodes = neo4j.get_nodes_by_user(request.user.id)
        neo4j.close()

        return Response(nodes, status=status.HTTP_200_OK)


class EdgeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        neo4j = Neo4jNodes()
        edges = neo4j.get_all_edges(request.user.id)
        neo4j.close()

        return Response(edges, status=status.HTTP_200_OK)


class DocumentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        documents = Document.objects.all()

        serializer = DocumentSerializer(documents, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)


class CanvasRunView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        neo4j = Neo4jNodes()
        neo4j.process_pipeline(canvas_id=1)

        return Response({"message": "processing complete"}, status=status.HTTP_200_OK)

