# consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class WorkflowConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Extract the node_id from the URL route kwargs
        self.node_id = self.scope['url_route']['kwargs']['node_id']
        self.group_name = f'workflow_{self.node_id}'

        # Join group for this workflow node
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()  # Accept the connection

    async def disconnect(self, close_code):
        # Leave the workflow group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Receive messages from the group
    async def workflow_update(self, event):
        message = event['message']
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message
        }))
