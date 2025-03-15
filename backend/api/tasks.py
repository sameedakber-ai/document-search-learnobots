import json
import os
from collections import deque

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
import time

from openai import OpenAI
from pydantic import BaseModel

from .models import Agent, Workflow
from .helpers import DocumentLoader, KnowledgeGenerator


class ChatTriggerEvent(BaseModel):
    output: str


class ChatEvent(BaseModel):
    output: str


client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))


def load_elements(processing_job_id):
    processing_job = ProcessingJob.objects.get(pk=processing_job_id)
    processing_job.start()

    try:
        loaded_documents = DocumentLoader.load(processing_job.document)
        element_result = ElementResult.objects.create(
            document=processing_job.document,
            processing_job=processing_job,
        )
        element_result.set_elements(loaded_documents)
        element_result.save()
        processing_job.complete()

    except Exception as e:
        print(e)
        processing_job.fail()

    return processing_job


def generate_knowledge(processing_job_id):
    processing_job = ProcessingJob.objects.get(pk=processing_job_id)
    processing_job.start()

    documents = KnowledgeGenerator.generate_knowledge(processing_job.document.element_results.elements)

    if documents:
        processing_job.complete()
    else:
        processing_job.fail()

    return documents


@shared_task(bind=True)
def process_workflow(self, node_id, trigger_id, input):
    channel_layer = get_channel_layer()
    group_name = f'workflow_{node_id}'

    workflow = Workflow.objects.get(pk=node_id)
    chat_trigger_node = Agent.objects.get(slug=trigger_id)
    initial_input = ChatTriggerEvent(output=input)

    def process_node(current_agent, agent_input, visited):
        """
        Process the current agent and recursively traverse its next_agents.
        Avoid cycles using the visited set. Returns a list of final outputs.
        """
        # Process the current agent if needed

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'workflow.update',
                'message': f"{current_agent.type} in progress..."
            }
        )

        if current_agent.type == 'chatTrigger':
            agent_input = ChatTriggerEvent(output=agent_input.output)
            memories = current_agent.properties.get('memories', '[]')
            new_message = {
                "role": "user",
                "content": [{
                    "type": "text",
                    "text": agent_input.output
                }]
            }
            memories.extend(new_message)
            current_agent.properties['memories'] = json.dumps(memories)

        if current_agent.type == 'chat':
            if not current_agent.chat_model_node:
                return []
            chat_model = current_agent.chat_model_node.properties.get('model', '[]')
            if not chat_model:
                return []
            chat_memory = []
            if current_agent.memory_node:
                chat_memory = current_agent.memory_node.properties.get('memories', '[]')

            messages = [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "text",
                            "text": """
                                Give a user query, answer it the best you can as a helpful assistant. Use emojis to appear more personable. Return a structured JSON in the following format:

                                ### Instructions:

                                1. **output**:
                                   - The response to the user query

                                ### Example:

                                For the input text:
                                "What is the capital of france?"

                                The response should look like this:

                                ```json
                                {
                                  "output": "The capital of france is Paris."
                                }
                                ```
                            """
                        }
                    ],
                }
            ]

            messages.extend(chat_memory)

            messages.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f'{agent_input.output}'
                        }
                    ]
                }
            )

            original_user_message = agent_input.output

            # Call the API
            response = client.chat.completions.create(
                model=chat_model,
                messages=messages,
            )

            raw_content = response.choices[0].message.content.strip()

            # Remove markdown formatting if present
            if raw_content.startswith("```json") and raw_content.endswith("```"):
                raw_content = raw_content[7:-3].strip()

            data = json.loads(raw_content)
            chat_data = ChatEvent(**data)
            # Update the agent input with the output of the current node
            agent_input = chat_data

            if current_agent.memory_node:
                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        'type': 'workflow.update',
                        'message': f"{current_agent.memory_node.type} in progress..."
                    }
                )
                # Safely load the memory; default to an empty list if not present.
                memories_str = current_agent.memory_node.properties.get('memories', '[]')
                chat_memory = json.loads(memories_str)

                new_messages = [
                    {
                        "role": "user",
                        "content": [{
                            "type": "text",
                            "text": original_user_message
                        }]
                    },
                    {
                        "role": "assistant",
                        "content": [{
                            "type": "text",
                            "text": chat_data.output
                        }]
                    }
                ]
                chat_memory.extend(new_messages)
                # Update the memory field. Make sure to update the dict key.
                current_agent.memory_node.properties['memories'] = json.dumps(chat_memory)
                current_agent.memory_node.save()

        # Retrieve next agents
        next_agents = list(current_agent.next_agents.all())
        # If there are no more agents, this branch is finished—return the output.
        if not next_agents:
            return [agent_input.output]

        # Otherwise, process each next agent recursively.
        outputs = []
        for next_agent in next_agents:
            if next_agent.id in visited:
                continue  # Skip already visited nodes to avoid cycles.
            # Use a new visited set for each branch (or update the same if you want to prevent revisiting common nodes)
            new_visited = visited.copy()
            new_visited.add(next_agent.id)
            branch_outputs = process_node(next_agent, agent_input, new_visited)
            outputs.extend(branch_outputs)
        return outputs

    # Initialize the visited set with the starting node
    outputs = process_node(chat_trigger_node, initial_input, visited={chat_trigger_node.id})
    # Depending on your needs, you could choose to return all outputs or combine them.
    # For example, here we return the list of outputs.

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'workflow.update',
            'message': "Workflow completed."
        }
    )

    return outputs

    # # Simulate processing steps
    # steps = ["Initializing", "Running Agent A", "Running Agent B", "Finalizing"]
    # for step in steps:
    #     # Send progress update
    #     async_to_sync(channel_layer.group_send)(
    #         group_name,
    #         {
    #             'type': 'workflow.update',
    #             'message': f"{step} in progress..."
    #         }
    #     )
    #     time.sleep(2)  # simulate time taken for each step
    #
    # # Send completion update
    # async_to_sync(channel_layer.group_send)(
    #     group_name,
    #     {
    #         'type': 'workflow.update',
    #         'message': "Workflow completed."
    #     }
    # )
    # return "done"
