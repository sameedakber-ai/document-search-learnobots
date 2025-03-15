import os
from channels.routing import ProtocolTypeRouter
from api.routing import application as channels_application

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": channels_application,
})
