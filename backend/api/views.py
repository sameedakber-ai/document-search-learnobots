import json

from django.shortcuts import render
from django.contrib.auth.models import User

from .helpers import Neo4jNodes
from .models import Document

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .serializers import UserSerializer, DocumentSerializer, ChatSerializer
from .services import DocumentProcessService, ChatService


class UserCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = UserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        serializer = UserSerializer(user)

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DocumentUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = DocumentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        document = serializer.save()
        # loaded_document = DocumentProcessService.process_document(document=document)

        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ChatSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        chat = serializer.save()
        chat = ChatService.generate_response(chat=chat)

        serializer = ChatSerializer(chat)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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

        node_id = neo4j.update_node(slug=slug, data=data)
        return Response({"message": "Node updated successfully"}, status=status.HTTP_200_OK)




class EdgeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        neo4j = Neo4jNodes()
        data = request.data

        print(data.get("source_id"))

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

        print(nodes)

        return Response(nodes, status=status.HTTP_200_OK)


class EdgeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        neo4j = Neo4jNodes()
        edges = neo4j.get_all_edges(request.user.id)
        neo4j.close()

        print("edges: ", edges)

        return Response(edges, status=status.HTTP_200_OK)


class DocumentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        documents = Document.objects.all()

        serializer = DocumentSerializer(documents, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)

