import json

from django.shortcuts import render
from django.contrib.auth.models import User

from .models import Workflow, Agent

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .serializers import UserSerializer, DocumentSerializer, FileSerializer, WorkflowSerializer, \
    AgentSerializer, MemorySerializer, NodeConnectionSerializer
from .services import WorkflowService
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
        workflows = Workflow.objects.filter(owner = request.user).all()

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

class AgentConnectionCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = NodeConnectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        connection = serializer.save()

        serializer = NodeConnectionSerializer(connection)
        print(serializer.data)
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

class WorkflowStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id, *args, **kwargs):
        try:
            workflow = Workflow.objects.get(pk=id)
        except Workflow.DoesNotExist:
            return Response({"message": "Workflow does not exist"})

        node_id = request.data.get('node_id')
        trigger_id = request.data.get('trigger_id')
        chat_input = request.data.get('input')
        files = request.FILES.getlist('files')

        new_memory = process_workflow(node_id, trigger_id, chat_input, files)
        return Response({"status": "Workflow started", "new_memory": new_memory})

class WorkflowResetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id, *args, **kwargs):
        try:
            workflow = Workflow.objects.get(pk=id)
        except Workflow.DoesNotExist:
            return Response({"message": "Workflow does not exist"})

        workflow = WorkflowService.reset_workflow(workflow)

        agents = Agent.objects.filter(workflow=workflow)
        serializer = AgentSerializer(agents, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)








