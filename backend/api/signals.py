from django.db.models.signals import post_save, post_init, pre_save
from django.dispatch import receiver

from api.models import Agent


@receiver(pre_save, sender=Agent)
def check_memories_update(sender, instance, **kwargs):
    # Only process 'chatTrigger' agents
    if instance.type != 'chatTrigger':
        return

    try:
        # Retrieve previous state of the instance
        previous_instance = Agent.objects.get(pk=instance.pk)
        previous_memories = previous_instance.properties.get('memories', [])
    except Agent.DoesNotExist:
        # If instance doesn't exist, it's a new creation, so do nothing
        return

    # Get current memories field
    current_memories = instance.properties.get('memories', [])

    # Check if memories have been updated (appended to)
    if len(current_memories) > len(previous_memories):
        # Send signal
        print("Memories field has been updated.")  # Replace with actual signal action
