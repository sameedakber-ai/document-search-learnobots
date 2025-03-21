from .models import Agent, Workflow, NodeConnection
from django.db import transaction


class WorkflowService:

    @staticmethod
    def reset_workflow(workflow: Workflow) -> Workflow:
        """
        Reset the given workflow by deleting its agents (and cascading node connections)
        and then recreating the default set of agents and connections.
        """
        with transaction.atomic():
            # Delete all agents linked to the workflow; cascading deletes will remove
            # related NodeConnections automatically.
            Agent.objects.filter(workflow=workflow).delete()

            # Create the six agents for the workflow.
            agent_types = ['documentLoader', 'chat', 'chatTrigger', 'memory', 'chatModel', 'vectorStore']
            agents = {}
            for agent_type in agent_types:
                agent = Agent.objects.create(workflow=workflow, type=agent_type)
                agents[agent_type] = agent

            # Create the node connections between agents:
            # a. chatTrigger to chat (next connection)
            NodeConnection.objects.create(
                source=agents['chatTrigger'],
                target=agents['chat'],
                connection_type='next'
            )
            # b. chat to memory (memory connection)
            NodeConnection.objects.create(
                source=agents['chat'],
                target=agents['memory'],
                connection_type='memory'
            )
            # c. chat to chatModel (chat_model connection)
            NodeConnection.objects.create(
                source=agents['chat'],
                target=agents['chatModel'],
                connection_type='chat_model'
            )
            # d. chat to vectorStore (retriever connection)
            NodeConnection.objects.create(
                source=agents['chat'],
                target=agents['vectorStore'],
                connection_type='retriever'
            )
            # e. documentLoader to vectorStore (next connection)
            NodeConnection.objects.create(
                source=agents['documentLoader'],
                target=agents['vectorStore'],
                connection_type='next'
            )

        return workflow
