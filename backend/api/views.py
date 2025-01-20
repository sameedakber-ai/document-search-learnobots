from django.shortcuts import render
from django.contrib.auth.models import User
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
        loaded_document = DocumentProcessService.process_document(document=document)

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

