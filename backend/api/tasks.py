import json
import os
from collections import deque

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
import time

from openai import OpenAI
from pydantic import BaseModel

from .models import Agent, Workflow, Document
from .helpers import DocumentLoader, KnowledgeGenerator, get_similar_documents

from django.db.models import F, Value, FloatField
from django.db.models import Func
from pgvector.django import CosineDistance


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


import json
import logging
from typing import Any, Dict, List, Set, Union, Optional, TypedDict

from asgiref.sync import async_to_sync
from celery import shared_task, Task
from channels.layers import get_channel_layer


class MemoryContent(TypedDict):
    type: str
    text: str


class MemoryItem(TypedDict):
    role: str
    content: List[MemoryContent]

class Element(BaseModel):
    type: str
    text: Any
    metadata: dict

class ElementList(BaseModel):
    output: List[Element]


logger = logging.getLogger(__name__)

def get_similar_documents(query_embedding, threshold=0.70):
    """
    Returns all Document objects whose cosine similarity with the given query_embedding
    is above the threshold.

    Cosine similarity is computed as:
         similarity = 1 - (embedding <#> query_embedding)
    Hence, we filter where:
         1 - (embedding <#> query_embedding) > threshold
         or equivalently,
         (embedding <#> query_embedding) < (1 - threshold)
    """
    qs = Document.objects.annotate(
        cosine_distance=CosineDistance('embedding', query_embedding)
        ).filter(
        cosine_distance__lt=(1-threshold)
        ).order_by('cosine_distance')
    return qs


def knowledge_base_search_tool(query: str) -> str:
    """
    Given a query string, this tool generates an embedding for the query,
    retrieves similar documents using your get_similar_documents function,
    and returns a concatenated string of the document texts.
    """
    embedding_response = client.embeddings.create(
        input=query,
        model="text-embedding-ada-002"
    )
    query_embedding = embedding_response.data[0].embedding

    # Retrieve documents similar to the query.
    similar_docs = get_similar_documents(query_embedding)

    print(f"\n\n\n{similar_docs}\n\n\n")

    # Combine the text content from the similar documents.
    context = "\n\n".join([doc.text for doc in similar_docs if doc.text])

    return context

# 2. Define the tool schema (without including the function object) following OpenAI's spec.
tools = [
    {
        "type": "function",
        "function": {
            "name": "knowledge_base_search",
            "description": "Searches the internal knowledge base for context based on a query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The query string to search for relevant context."
                    }
                },
                "required": ["query"],
                "additionalProperties": False
            },
            "strict": True
        }
    }
]



def send_update(
        channel_layer: Any,
        group_name: str,
        node_id: Optional[str],
        status: str,
        message: str
) -> None:
    """Helper to send a workflow update via the channel layer."""
    payload: Dict[str, Union[str, None]] = {
        'type': 'workflow.update',
        'status': status,
        'message': message,
    }
    if node_id:
        payload['node_id'] = node_id
    async_to_sync(channel_layer.group_send)(group_name, payload)


@shared_task(bind=True)
def process_workflow(self: Task, node_id: str, trigger_id: str, input_text: str) -> List[str]:
    """
    Process the workflow by traversing agents starting at the trigger node.
    Returns a list of final outputs.
    """
    channel_layer = get_channel_layer()
    group_name = f'workflow_{node_id}'

    # Notify that the workflow is starting.
    send_update(channel_layer, group_name, None, 'info', "Workflow starting ...")

    workflow = Workflow.objects.get(pk=node_id)
    trigger_node = Agent.objects.get(slug=trigger_id)
    send_update(channel_layer, group_name, str(trigger_node.slug), 'running',
                f"{trigger_node.type} in progress...")

    # Prepare the initial input based on trigger node type.
    if trigger_node.type == 'chatTrigger':
        initial_input: ChatTriggerEvent = ChatTriggerEvent(output=input_text)
    elif trigger_node.type == 'documentLoader':
        texts = []
        for file in trigger_node.files.all():
            texts.extend(DocumentLoader(file).load())
            file_path = file.file
            try:
                file.delete()
                os.remove(f'media/{file_path}')
            except Exception as e:
                print("Cannot remove file: ", e)
        initial_input: ElementList = ElementList(
            output=[element.model_dump() for element in texts]
        )
    else:
        initial_input = ChatTriggerEvent(output=input_text)  # fallback

    send_update(channel_layer, group_name, str(trigger_node.slug), 'completed',
                f"{trigger_node.type} completed.")

    def process_node(current_agent: Agent,
                     agent_input: Union[ChatTriggerEvent, ChatEvent],
                     visited: Set[Any]) -> List[str]:
        """Recursively process an agent and its successors."""
        send_update(channel_layer, group_name, str(current_agent.slug), 'running',
                    f"{current_agent.type} in progress...")
        try:
            # Handle processing based on the agent type.
            if current_agent.type == 'documentLoader':
                agent_input = ElementList(output=agent_input.output)
            elif current_agent.type == 'vectorStore':
                for element in agent_input.output:
                    embedding = client.embeddings.create(
                        input=element.text,
                        model='text-embedding-ada-002'
                    )
                    print(f"\n\n{embedding.data[0].embedding}\n\n")
                    document = Document.objects.create(
                        uid=element.metadata["uid"],
                        text=element.text,
                        agent=current_agent,  # Or use agent_id=current_agent.id if you prefer
                        name=element.metadata["source"],
                        embedding=embedding.data[0].embedding
                    )

            elif current_agent.type == 'chatTrigger':
                # Update memories for a chatTrigger.
                agent_input = ChatTriggerEvent(output=agent_input.output)
                memories_raw = current_agent.properties.get('memories', '[]')
                try:
                    memories = json.loads(memories_raw) if isinstance(memories_raw, str) else memories_raw
                except json.JSONDecodeError:
                    memories = []
                new_message = {
                    "role": "user",
                    "content": [{
                        "type": "text",
                        "text": agent_input.output
                    }]
                }
                memories.append(new_message)
                current_agent.properties['memories'] = json.dumps(memories)
            elif current_agent.type == 'chat':
                # Retrieve the one-to-one connections for chat_model and memory.
                chat_model_conn = current_agent.connections_out.filter(connection_type='chat_model').first()
                if not chat_model_conn:
                    return []
                chat_model_agent = chat_model_conn.target
                chat_model = chat_model_agent.properties.get('model', '')
                if not chat_model:
                    return []

                send_update(channel_layer, group_name, str(chat_model_agent.slug), 'running',
                            f"{chat_model_agent.type} in progress...")

                memory_conn = current_agent.connections_out.filter(connection_type='memory').first()
                chat_memory = []
                if memory_conn:
                    memory_agent = memory_conn.target
                    mem_raw = memory_agent.properties.get('memories', '[]')
                    try:
                        chat_memory = json.loads(mem_raw) if isinstance(mem_raw, str) else mem_raw
                    except json.JSONDecodeError:
                        chat_memory = []
                # Construct the messages for the external chat API.
                messages = [{
                    "role": "system",
                    "content": [{
                        "type": "text",
                        "text": (
                            "Give a user query, answer it the best you can as a helpful assistant. "
                            "Use emojis to appear more personable. Return a structured JSON in the following format:\n\n"
                            "### Instructions:\n\n"
                            "1. **output**:\n   - The response to the user query\n\n"
                            "### Example:\n\n"
                            "For the input text:\n"
                            "\"What is the capital of france?\"\n\n"
                            "The response should look like this:\n\n"
                            "```json\n"
                            "{\n  \"output\": \"The capital of france is Paris.\"\n}\n"
                            "```"
                        )
                    }]
                }]
                messages.extend(chat_memory)
                messages.append({
                    "role": "user",
                    "content": [{
                        "type": "text",
                        "text": agent_input.output
                    }]
                })
                original_user_message = agent_input.output

                retriever_conn = current_agent.connections_out.filter(connection_type='retriever').first()

                if retriever_conn:
                    retriever_node = retriever_conn.target
                    send_update(channel_layer, group_name, str(retriever_node.slug), 'running',
                                f"{retriever_node.type} in progress...")
                    documents = retriever_node.documents.all()
                    if documents:
                        # Optionally, create a history from previous messages if needed.
                        history = "\n\n".join([
                            f'role: {message["role"]}\nmessage: {message["content"][0]["text"]}'
                            for message in messages
                        ])

                        # 4. Call the model with your messages and tool definitions.
                        response = client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=messages,
                            tools=tools,
                        )

                        # Check if the model requested a function call.
                        tool_calls = response.choices[0].message.tool_calls
                        if tool_calls:
                            tool_call = tool_calls[0]
                            # Parse the arguments provided by the model.
                            args = json.loads(tool_call.function.arguments)
                            print(f"\n\n\n{args}\n\n\n")
                            # Check that the function call name matches our tool.
                            if tool_call.function.name == "knowledge_base_search":
                                # 5. Execute the tool function.
                                tool_result = knowledge_base_search_tool(**args)
                                # 6. Append the function call and its result to the messages.
                                messages.append(response.choices[0].message)  # The function call message.
                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tool_call.id,
                                    "content": tool_result
                                })
                                # 7. Supply the function result back to the model.
                                response_2 = client.chat.completions.create(
                                    model="gpt-4o-mini",
                                    messages=messages,
                                    tools=tools,
                                )
                                final_content = response_2.choices[0].message.content.strip()
                                print(final_content)
                            else:
                                print("Received an unknown function call:", tool_call["function"]["name"])
                        else:
                            # If no function call was requested, simply print the response content.
                            print(response.choices[0].message.content.strip())

                    send_update(channel_layer, group_name, str(retriever_node.slug), 'completed',
                            f"{retriever_node.type} completed.")

                try:
                    response = client.beta.chat.completions.parse(
                        model='gpt-4o-mini',
                        messages=messages,
                        response_format=ChatEvent
                    )
                except Exception as e:
                    send_update(channel_layer, group_name, str(chat_model_agent.slug), 'failed',
                                f"{chat_model_agent.type} failed.")
                    return []
                raw_content = response.choices[0].message.content.strip()
                if raw_content.startswith("```json") and raw_content.endswith("```"):
                    raw_content = raw_content[7:-3].strip()
                data_dict = json.loads(raw_content)
                chat_data = ChatEvent(**data_dict)
                agent_input = chat_data

                send_update(channel_layer, group_name, str(chat_model_agent.slug), 'completed',
                            f"{chat_model_agent.type} completed.")

                if memory_conn:
                    memory_agent = memory_conn.target
                    send_update(channel_layer, group_name, str(memory_agent.slug), 'running',
                                f"{memory_agent.type} in progress...")
                    try:
                        mem_str = memory_agent.properties.get('memories', '[]')
                        try:
                            chat_memory_list = json.loads(mem_str) if isinstance(mem_str, str) else mem_str
                        except json.JSONDecodeError:
                            chat_memory_list = []
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
                        chat_memory_list.extend(new_messages)
                        memory_agent.properties['memories'] = json.dumps(chat_memory_list)
                        memory_agent.save()
                        send_update(channel_layer, group_name, str(memory_agent.slug), 'completed',
                                    f"{memory_agent.type} completed.")
                    except Exception as e:
                        logger.exception("Error updating memory node for agent %s", current_agent.slug)
                        send_update(channel_layer, group_name, str(memory_agent.slug), 'failed',
                                    f"{memory_agent.type} failed.")

            # Signal completion for the current agent.
            send_update(channel_layer, group_name, str(current_agent.slug), 'completed',
                        f"{current_agent.type} completed.")

            # Retrieve next agents from outgoing connections of type 'next'.
            next_conns = current_agent.connections_out.filter(connection_type='next')
            next_agents = [conn.target for conn in next_conns]
            if not next_agents:
                return [agent_input.output]

            outputs = []
            for next_agent in next_agents:
                if next_agent.id in visited:
                    continue  # Avoid cycles.
                new_visited = visited.copy()
                new_visited.add(next_agent.id)
                outputs.extend(process_node(next_agent, agent_input, new_visited))
            return outputs

        except Exception as exc:
            logger.exception("Error processing agent %s", current_agent.type)
            send_update(channel_layer, group_name, str(current_agent.slug), 'failed',
                        f"{current_agent.type} failed.")
            return []

    outputs = process_node(trigger_node, initial_input, visited={trigger_node.id})
    send_update(channel_layer, group_name, None, 'info', "Workflow completed.")
    return outputs
