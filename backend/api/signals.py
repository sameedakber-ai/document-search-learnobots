from django.db.models.signals import post_save, post_init, pre_save
from django.db import transaction
from django.dispatch import receiver
from django.contrib.auth.models import User
from api.models import Workflow, Agent, NodeConnection


@receiver(post_save, sender=User)
def create_default_workflow_and_agents(sender, instance, created, **kwargs):
    if not created:
        return

    with transaction.atomic():
        # 1. Create a default workflow for the new user.
        workflow = Workflow.objects.create(owner=instance, name='default')

        # 2. Create 6 agents, one for each type.
        agent_types = ['documentLoader', 'chat', 'chatTrigger', 'memory', 'chatModel', 'vectorStore']
        agents = {}
        for agent_type in agent_types:
            # Create each agent with the workflow reference.
            agent = Agent.objects.create(workflow=workflow, type=agent_type)
            agents[agent_type] = agent

        # 3. Create the node connections for the new agents:
        #    a. chatTrigger to chat (next connection)
        NodeConnection.objects.create(
            source=agents['chatTrigger'],
            target=agents['chat'],
            connection_type='next'
        )
        #    b. chat to memory (memory connection)
        NodeConnection.objects.create(
            source=agents['chat'],
            target=agents['memory'],
            connection_type='memory'
        )
        #    c. chat to chatModel (chat_model connection)
        NodeConnection.objects.create(
            source=agents['chat'],
            target=agents['chatModel'],
            connection_type='chat_model'
        )
        #    d. chat to vectorStore (retriever connection)
        NodeConnection.objects.create(
            source=agents['chat'],
            target=agents['vectorStore'],
            connection_type='retriever'
        )
        #    e. documentLoader to vectorStore (next connection)
        NodeConnection.objects.create(
            source=agents['documentLoader'],
            target=agents['vectorStore'],
            connection_type='next'
        )
