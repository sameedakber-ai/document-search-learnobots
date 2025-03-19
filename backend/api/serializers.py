from django.contrib.auth.models import User
from .models import Document, File, Agent, Workflow, Memory
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

class AgentSerializer(serializers.ModelSerializer):
    next_agents = serializers.SlugRelatedField(
        slug_field='slug',
        queryset=Agent.objects.all(),
        many=True,
        required=False
    )

    retriever_node = serializers.SlugRelatedField(
        slug_field='slug',
        queryset=Agent.objects.all(),
        required=False,
        allow_null=True
    )

    memory_node = serializers.SlugRelatedField(
        slug_field='slug',
        queryset=Agent.objects.all(),
        required=False,
        allow_null=True
    )

    chat_model_node = serializers.SlugRelatedField(
        slug_field='slug',
        queryset=Agent.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = Agent
        fields = ('id', 'slug', 'type', 'properties', 'workflow', 'next_agents', 'retriever_node', 'memory_node', 'chat_model_node')

    def create(self, validated_data):
        print(validated_data)
        next_agents = validated_data.pop('next_agents', [])
        slug = validated_data.get('slug')
        validated_data.pop('id', None)
        agent, created = Agent.objects.update_or_create(
            slug=slug,
            defaults=validated_data
        )
        agent.next_agents.set(next_agents)
        return agent


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ('id', 'file', 'name', 'date', 'owner', 'loaded')
        extra_kwargs = {'owner': {'read_only': True}, 'name': {'read_only': True}, 'date': {'read_only': True}}

    def create(self, validated_data):
        user = self.context['request'].user
        file = validated_data.pop('file', None)
        document = Document.objects.create(file=file, name=file.name, owner=user)
        return document

class MemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Memory
        fields = ('id', 'input', 'output', 'workflow')

    def create(self, validated_data):
        memory = Memory.objects.create(**validated_data)
        return memory