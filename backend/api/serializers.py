from django.contrib.auth.models import User
from .models import Document, File, Agent, Workflow, Memory, NodeConnection
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'password')
        extra_kwargs = {'password': {'write_only': True, 'min_length': 4}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class FileSerializer(serializers.ModelSerializer):
    class Meta:
        model = File
        fields = ('id', 'file', 'date', 'agent')
        extra_kwargs = {'date': {'read_only': True}}

    def create(self, validated_data):
        agent = self.context['agent']
        file = validated_data.pop('file', None)
        file = File.objects.create(file=file, agent=agent)
        return file

class WorkflowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workflow
        fields = ('id', 'name', 'date', 'owner')
        extra_kwargs = {'date': {'read_only': True}, 'owner': {'read_only': True}}

    def create(self, validated_data):
        user = self.context['request'].user
        workflow = Workflow.objects.create(**validated_data, owner=user)
        return workflow

class NodeConnectionSerializer(serializers.ModelSerializer):
    source = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Agent.objects.all(),
        required=True,
        allow_null=False
    )
    target = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Agent.objects.all(),
        required=True,
        allow_null=False
    )
    # We keep all fields here for standalone use.
    class Meta:
        model = NodeConnection
        fields = ['id', 'source', 'target', 'connection_type']

    def create(self, validated_data):
        source = validated_data.get('source')
        connection_type = validated_data.get('connection_type')
        
        # For one-to-one connection types, check if one already exists for this source.
        if connection_type in ['retriever', 'chat_model', 'memory']:
            if NodeConnection.objects.filter(source=source, connection_type=connection_type).exists():
                raise serializers.ValidationError(
                    f"A '{connection_type}' connection for this source already exists."
                )
        
        # Create and return the new NodeConnection
        return NodeConnection.objects.create(**validated_data)


class NodeConnectionNestedSerializer(serializers.ModelSerializer):
    target = serializers.SlugRelatedField(
        slug_field='slug',
        read_only=True
    )

    class Meta:
        model = NodeConnection
        fields = ['target', 'connection_type']


class AgentSerializer(serializers.ModelSerializer):
    # Use the nested serializer to return only target and connection_type.
    connections_out = NodeConnectionNestedSerializer(many=True, read_only=True)

    class Meta:
        model = Agent
        fields = ('id', 'slug', 'type', 'properties', 'workflow', 'connections_out')

    def create(self, validated_data):
        slug = validated_data.get('slug')
        validated_data.pop('id', None)
        agent, created = Agent.objects.update_or_create(
            slug=slug,
            defaults=validated_data
        )
        return agent



class DocumentSerializer(serializers.ModelSerializer):
    agent = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Agent.objects.all(),
        required=True,
    )
    class Meta:
        model = Document
        fields = ('id', 'uid', 'text', 'name', 'date', 'agent', 'embedding')

    def create(self, validated_data):
        document, created = Document.objects.get_or_create(
            uid=validated_data.get("uid"),
            name=validated_data.get("name"),
            defaults=validated_data
        )
        return document

class MemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Memory
        fields = ('id', 'input', 'output', 'workflow')

    def create(self, validated_data):
        memory = Memory.objects.create(**validated_data)
        return memory