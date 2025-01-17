from django.contrib.auth.models import User
from .models import Document
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'password')
        extra_kwargs = {'password': {'write_only': True, 'min_length': 4}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ('id', 'file', 'name', 'date', 'owner')

    def create(self, validated_data):
        user = self.context['request'].user
        file = validated_data.pop('file', None)
        document = Document.objects.create(file=file, name=file.name, owner=user)
        return document
