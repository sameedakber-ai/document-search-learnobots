from django.contrib.auth.models import User
from .models import Document, Chat
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
        fields = ('id', 'file', 'name', 'date', 'owner', 'loaded')
        extra_kwargs = {'owner': {'read_only': True}, 'name': {'read_only': True}, 'date': {'read_only': True}}

    def create(self, validated_data):
        user = self.context['request'].user
        file = validated_data.pop('file', None)
        document = Document.objects.create(file=file, name=file.name, owner=user)
        return document

class ChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chat
        fields = ('id', 'input', 'output', 'owner')
        extra_kwargs = {'owner': {'read_only': True}}

    def create(self, validated_data):
        user = self.context['request'].user
        return Chat.objects.create(**validated_data, owner=user)

# class NodeSerializer(serializers.ModelSerializer):
#     user = UserSerializer(read_only=True)
#
#     class Meta:
#         model = Node
#         fields = ['slug', 'label', 'description', 'position_x', 'position_y', 'user', 'type']
#
#     def save(self, validated_data, user):
#         slug = validated_data.pop('slug')
#         node, created = Node.objects.update_or_create(slug=slug, user=user, defaults=validated_data)
#         return node
#
#
# class EdgeSerializer(serializers.ModelSerializer):
#     source_slug = serializers.CharField(write_only=True)
#     target_slug = serializers.CharField(write_only=True)
#     source = serializers.SlugRelatedField(read_only=True, slug_field='slug')
#     target = serializers.SlugRelatedField(read_only=True, slug_field='slug')
#
#     class Meta:
#         model = Edge
#         fields = ['slug', 'source', 'target', 'label', 'source_slug', 'target_slug']
#
#     def create(self, validated_data):
#         print(validated_data)
#         source = Node.objects.get(slug=validated_data.pop('source_slug'))
#         target = Node.objects.get(slug=validated_data.pop('target_slug'))
#         label = validated_data.get('label')
#
#         edge, created = Edge.objects.update_or_create(source=source, target=target, defaults=validated_data)
#         return edge