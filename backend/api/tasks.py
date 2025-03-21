import json
import os
from collections import deque
import re

from django.db import transaction

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
import time
from pathlib import Path

from openai import OpenAI
from pydantic import BaseModel
import openai

from .models import Agent, Workflow, Document, Memory

from django.db.models import F, Value, FloatField
from django.db.models import Func
from pgvector.django import CosineDistance
import hashlib

import json
import logging
from typing import Any, Dict, List, Set, Union, Optional, TypedDict

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer

from functools import wraps
import concurrent.futures

import os
import tempfile

from langchain_community.document_loaders import TextLoader, PyPDFLoader, Docx2txtLoader
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

class ChatTriggerEvent(BaseModel):
    output: str


class ChatEvent(BaseModel):
    output: str


client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))


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

class ChatMemory(BaseModel):
    id: str
    input: str
    output: str
    agent: str




def get_similar_documents(query_embedding, threshold=0.60):
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
        model=os.getenv('OPENAI_EMBEDDING_MODEL')
    )
    query_embedding = embedding_response.data[0].embedding

    # Retrieve documents similar to the query.
    similar_docs = get_similar_documents(query_embedding)[:5]

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


class DocumentLoader:

    def __init__(self, file_path: str):
        self.file_path = file_path

    @property
    def get_ext(self):
        return os.path.splitext(self.file_path)[1].lstrip('.').lower()

    def load(self):
        ext = self.get_ext
        loaded_documents = []
        if ext == 'md':
            loaded_documents = self.load_markdown(self.file_path)
        elif ext == 'txt':
            loaded_documents = self.load_text(self.file_path)
        elif ext == 'pdf':
            loaded_documents = self.load_pdf(self.file_path)
        elif ext == 'docx':
            loaded_documents = self.load_docx(self.file_path)
        else:
            logger.error("Unsupported file extension: %s", ext)
            return []
        return loaded_documents

    def load_markdown(self, file_path):
        def replace_title(match):
            return f"# {match.group(1)}\n"

        def get_split_headers(split):
            # Build a header section from the split metadata.
            section = ""
            for header in ['Header 1', 'Header 2', 'Header 3', 'Header 4']:
                if header in split.metadata:
                    section += f"{split.metadata[header]}:"
            # Remove trailing colon if it exists.
            if section.endswith(':'):
                section = section[:-1]
            return section

        try:
            document_obj = TextLoader(file_path, encoding="UTF-8").load()
            if not document_obj:
                logger.error("TextLoader returned no document for file: %s", file_path)
                return []
            document = document_obj[0].page_content
        except Exception as e:
            logger.exception("Markdown loading failed for file %s: %s", file_path, e)
            return []

        try:
            # Replace title metadata with a markdown header.
            title_pattern = r'---\ntitle: (.*?)\n---'
            document = re.sub(title_pattern, replace_title, document, flags=re.DOTALL)

            # Define headers to split on.
            headers_to_split_on = [
                ("#", "Header 1"),
                ("##", "Header 2"),
                ("###", "Header 3"),
                ("####", "Header 4"),
            ]

            # Split document into sections based on markdown headers.
            markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on, strip_headers=False)
            md_header_splits = markdown_splitter.split_text(document)
            md_header_split_sections = [get_split_headers(split) for split in md_header_splits]

            # Further split each section into chunks.
            text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
                model_name=os.getenv('OPENAI_EMBEDDING_MODEL'), chunk_size=1500, chunk_overlap=0,
            )

            text_splits = []
            # Note: text_split_sections is constructed if needed for additional metadata.
            # Here, we only use it for debugging; if needed, attach it to each Element.
            text_split_sections = []
            for md_split, md_split_section in zip(md_header_splits, md_header_split_sections):
                for text_split in text_splitter.split_documents([md_split]):
                    text_splits.append(text_split.page_content)
                    text_split_sections.append(md_split_section)

            # Build Element objects from each text chunk.
            elements = [
                Element(
                    type='text',
                    text=text_split,
                    metadata={
                        'source': Path(file_path).name,
                        'uid': hashlib.sha256(text_split.encode()).hexdigest()
                    }
                )
                for text_split in text_splits
            ]
            return elements
        except Exception as e:
            logger.exception("Error processing markdown file %s: %s", file_path, e)
            return []

    def load_text(self, file_path):
        try:
            document = TextLoader(file_path, encoding="UTF-8").load()[0].page_content
        except RuntimeError or UnicodeDecodeError or FileNotFoundError or ValueError:
            return []

        text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            model_name=os.getenv('OPENAI_EMBEDDING_MODEL'), chunk_size=1500, chunk_overlap=0,
        )

        return [
            Element(
                type='text',
                text=split,
                metadata={
                    'source': Path(file_path).name,
                    'uid': hashlib.sha256(str.encode(split)).hexdigest()
                }
            ) for i, split in enumerate(text_splitter.split_text(document))
        ]
    
    def load_docx(self, file_path):
        try:
            document = Docx2txtLoader(file_path).load()[0].page_content
        except RuntimeError or UnicodeDecodeError or FileNotFoundError or ValueError:
            return []
        
        text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            model_name=os.getenv('OPENAI_EMBEDDING_MODEL'), chunk_size=1500, chunk_overlap=0,
        )

        return [
            Element(
                type='text',
                text=split,
                metadata={
                    'source': Path(file_path).name,
                    'uid': hashlib.sha256(str.encode(split)).hexdigest()
                }
            ) for i, split in enumerate(text_splitter.split_text(document))
        ]

    def load_pdf(self, file_path):
        try:
            loader = PyPDFLoader(file_path)
            documents = [document.page_content for document in PyPDFLoader(file_path).load()]
        except RuntimeError or UnicodeDecodeError or FileNotFoundError or ValueError as e:
            logger.error("PDF loading failed: %s", e)
            return []

        text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            model_name=os.getenv('OPENAI_EMBEDDING_MODEL'), chunk_size=1500, chunk_overlap=0,
        )

        texts = []
        for document in documents:
            texts.extend(text_splitter.split_text(document))

        return [
            Element(
                type="text",
                text=split,
                metadata = {
                    'source': Path(file_path).name,
                    'uid': hashlib.sha256(str.encode(split)).hexdigest()
                }
            ) for split in texts
        ]


class WorkflowException(Exception):
    """Custom exception for workflow-critical failures."""
    pass

class TimeoutWorkflowException(WorkflowException):
    """Exception raised when an API call exceeds the timeout limit."""
    pass

def timeout_decorator(timeout=60):
    """
    Decorator that runs the function in a separate thread and raises a TimeoutWorkflowException
    if it does not complete within the specified timeout (in seconds).
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(func, *args, **kwargs)
                try:
                    result = future.result(timeout=timeout)
                except concurrent.futures.TimeoutError as e:
                    logger.error("Timeout in %s: exceeded %s seconds", func.__name__, timeout)
                    raise TimeoutWorkflowException(
                        f"Timeout: {func.__name__} took longer than {timeout} seconds"
                    ) from e
                return result
        return wrapper
    return decorator

def api_exception_handler(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except openai.AuthenticationError as auth_err:
            logger.error("Authentication failed in %s: %s", func.__name__, auth_err)
            raise WorkflowException("Authentication failure during API call") from auth_err
        except openai.RateLimitError as rate_err:
            logger.error("Rate limit reached in %s: %s", func.__name__, rate_err)
            raise WorkflowException("Rate limit reached during API call") from rate_err
        except openai.APIError as api_err:
            logger.error("API error in %s: %s", func.__name__, api_err)
            raise WorkflowException("API error during API call") from api_err
        except Exception as exc:
            logger.exception("Unexpected error in %s", func.__name__)
            raise WorkflowException("Unexpected error during API call") from exc
    return wrapper

@api_exception_handler
@timeout_decorator(timeout=60)
def get_embedding(text: str):
    # This function calls the external API to get an embedding.
    return client.embeddings.create(
        input=text,
        model=os.getenv('OPENAI_EMBEDDING_MODEL')
    )

@timeout_decorator(timeout=60)
def load_document(file):
    """
    Helper function to load a document with a timeout.
    If the loading takes longer than 60 seconds, a TimeoutWorkflowException will be raised.
    """
    return DocumentLoader(file).load()

def refine_prompt_using_chat_history(query: str, chat_history: List[MemoryItem]) -> str:
    refine_prompt = (
        "Given the conversation history and latest query, generate a concise search query focusing on key terms:"
    )
    
    # Build a string from chat history. Adjust indexing if your structure differs.
    chat_history_str = "\n\n".join([
        f'role: {message["role"]}\nmessage: {message["content"][0]["text"]}'
        for message in chat_history if message["role"] != "system"
    ])
    
    # Build the full prompt to send to OpenAI
    full_prompt = (
        f"{refine_prompt}\n\n"
        f"Conversation History:\n{chat_history_str}\n\n"
        f"Latest Query: {query}\n\n"
        f"Refined Search Query:"
    )
    
    # Call OpenAI's ChatCompletion API. Adjust model, temperature, and max_tokens as needed.
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that refines search queries based on conversation context."},
            {"role": "user", "content": full_prompt}
        ],
        temperature=0.2,
    )
    
    refined_query = response.choices[0].message.content.strip()
    return refined_query
    

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


def update_status(channel_layer, group_name, slug: Union[str, int, None], status: str, message: str) -> None:
    """
    Helper to send a status update via the channel layer.
    """
    send_update(channel_layer, group_name, slug, status, message)


def safe_json_loads(data: Union[str, list]) -> list:
    """
    Safely parse JSON data. Returns a list or an empty list if parsing fails.
    """
    if isinstance(data, str):
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            logger.exception("JSON decode error for data: %s", data)
            return []
    return data


def remove_file(file) -> None:
    """
    Remove a file from the filesystem if it exists.
    """
    try:
        file_path = f"media/{str(file.file)}"
        file.delete()
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError as e:
                logger.exception("Error removing file %s: %s", file_path, e)
        else:
            logger.warning("File %s does not exist", file_path)
    except ObjectDoesNotExist:
        logger.warning("File %s does not exist", file_path)


def process_trigger_document_loader(trigger_node, files, channel_layer, group_name) -> ElementList:
    """
    Process a trigger node of type documentLoader.
    Saves uploaded files to temporary storage, loads documents from them,
    deletes the temporary files, and returns an ElementList.
    """
    texts = []
    for file in files:
        suffix = os.path.splitext(file.name)[1]
        tmp_path = None  # Initialize tmp_path
        try:
            # Save the uploaded file to a temporary file.
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                for chunk in file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            # Process the document using the temporary file path.
            try:
                loaded_texts = load_document(tmp_path)
                texts.extend(loaded_texts)
            except TimeoutWorkflowException as te:
                logger.error("Timeout while loading document for file %s: %s", file.name, te)
                update_status(
                    channel_layer, group_name, 1, 'warning',
                    f"Timeout while loading document for file {file.name}: {te}"
                )
            except Exception as exc:
                logger.exception("Error loading document for file %s", file.name)
        except Exception as outer_exc:
            logger.exception("Error saving temporary file for %s: %s", file.name, outer_exc)
        finally:
            # Attempt to remove the temporary file regardless of processing outcome.
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception as cleanup_exc:
                    logger.exception("Error removing temporary file %s", tmp_path)
    return ElementList(output=[element.model_dump() for element in texts])




def process_vector_store(current_agent, agent_input: Union[ChatTriggerEvent, ChatEvent, ElementList],
                         channel_layer, group_name) -> None:
    """
    Process an agent of type vectorStore by creating embeddings and storing documents.
    """
    for element in agent_input.output:
        try:
            embedding = get_embedding(element.text)
            with transaction.atomic():
                document, created = Document.objects.get_or_create(
                    uid=element.metadata["uid"],
                    name=element.metadata["source"],
                    defaults={
                        "text": element.text,
                        "agent": current_agent,
                        "embedding": embedding.data[0].embedding,
                    }
                )
        except WorkflowException as we:
            # Optionally, log or handle the workflow exception at this level.
            logger.error("Workflow failed during vectorStore processing: %s", we)
            # You might re-raise, or handle it in a way that halts further processing.
            raise


def process_chat_trigger(current_agent, agent_input: Union[ChatTriggerEvent, ChatEvent, ElementList],
                         channel_layer, group_name) -> ChatTriggerEvent:
    """
    Process an agent of type chatTrigger by updating its memories.
    """
    # Convert or reinitialize the input as a ChatTriggerEvent.
    agent_input = ChatTriggerEvent(output=agent_input.output)
    memories_raw = current_agent.properties.get('memories', '[]')
    memories = safe_json_loads(memories_raw)
    new_message = {
        "role": "user",
        "content": [{
            "type": "text",
            "text": agent_input.output
        }]
    }
    memories.append(new_message)
    current_agent.properties['memories'] = json.dumps(memories)
    current_agent.save(update_fields=['properties'])
    return agent_input


def process_chat_agent(current_agent, agent_input: Union[ChatTriggerEvent, ChatEvent, ElementList],
                       channel_layer, group_name) -> ChatEvent:
    """
    Process an agent of type chat. Handles retrieving the chat model,
    assembling the conversation, executing tool calls if requested,
    and updating the memory node.
    """
    # Retrieve the chat model connection.
    chat_model_conn = current_agent.connections_out.filter(connection_type='chat_model').first()
    if not chat_model_conn:
        raise WorkflowException("Missing chat model connection.")
    chat_model_agent = chat_model_conn.target
    chat_model = chat_model_agent.properties.get('model', os.getenv('OPENAI_CHAT_MODEL'))
    if not chat_model:
        raise WorkflowException("Missing chat model.")

    update_status(channel_layer, group_name, str(chat_model_agent.slug), 'running',
                  f"{chat_model_agent.type} in progress...")

    # Retrieve any memory if available.
    memory_conn = current_agent.connections_out.filter(connection_type='memory').first()
    chat_memory = []
    if memory_conn:
        memory_agent = memory_conn.target
        mem_raw = memory_agent.properties.get('memories', '[]')
        chat_memory = safe_json_loads(mem_raw)[:5]

    # Build the conversation messages.
    messages = [{
        "role": "system",
        "content": [{
            "type": "text",
            "text": "Give a user query, answer it the best you can as a helpful assistant.\n"
            "Structure your response in a neat markdown format with proper markdown "
            "structure.\nUse proper markdown headers and sub headers and ordered " 
            "or unordered lists wherever applicable."
        }]
    }]
    messages.extend(chat_memory)
    update_status(channel_layer, group_name, str(chat_model_agent.slug), 'running',
                      f"{chat_model_agent.type} in progress...")
    refined_user_query = agent_input.output
    try:
        refined_user_query = refine_prompt_using_chat_history(chat_history=messages, query=agent_input.output)
    except Exception as e:
        update_status(channel_layer, group_name, str(chat_model_agent.slug), 'failed',
                      f"{chat_model_agent.type} failed.")
        logger.error("Could not refine user input: %s", e)
        
    messages.append({
        "role": "user",
        "content": [{
            "type": "text",
            "text": refined_user_query
        }]
    })

    original_user_message = agent_input.output

    chat_data = None

    # Process retriever connection if available.
    retriever_conn = current_agent.connections_out.filter(connection_type='retriever').first()
    if retriever_conn:
        retriever_node = retriever_conn.target
        update_status(channel_layer, group_name, str(retriever_node.slug), 'running',
                      f"{retriever_node.type} in progress...")
        
        documents = retriever_node.documents.all()
        if documents:

            response = client.beta.chat.completions.parse(
                model=os.getenv('OPENAI_CHAT_MODEL'),
                messages=messages,
                tools=tools,
                response_format=ChatEvent
            )
            tool_calls = response.choices[0].message.tool_calls
            if tool_calls:
                # Append the assistant message with tool_calls to messages
                assistant_message = response.choices[0].message
                messages.append(assistant_message)
                
                # Process each tool_call
                for tool_call in tool_calls:
                    try:
                        args = json.loads(tool_call.function.arguments)
                    except json.JSONDecodeError:
                        logger.exception("Failed to parse tool call arguments.")
                        args = {}
                    
                    if tool_call.function.name == "knowledge_base_search":
                        tool_result = knowledge_base_search_tool(**args)
                        # Append tool response for each tool_call
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": tool_result  # Ensure this is a string
                        })
                    else:
                        logger.warning("Received unknown function call: %s", tool_call.function.name)
                
                # Get final response after handling all tool calls
                response_2 = client.beta.chat.completions.parse(
                    model=os.getenv('OPENAI_CHAT_MODEL'),
                    messages=messages,
                    tools=tools,
                    response_format=ChatEvent
                )
                raw_content = response_2.choices[0].message.content.strip()
                if raw_content.startswith("```json") and raw_content.endswith("```"):
                    raw_content = raw_content[7:-3].strip()
                try:
                    data_dict = json.loads(raw_content)
                    chat_data = ChatEvent(**data_dict)
                except Exception:
                    logger.exception("Error parsing chat response: %s", raw_content)
                    raise WorkflowException("Failed to parse chat response.")
                
                logger.info("Final content from tool call: %s", raw_content)
        update_status(channel_layer, group_name, str(retriever_node.slug), 'completed',
                      f"{retriever_node.type} completed.")

    if not chat_data:
        update_status(channel_layer, group_name, str(chat_model_agent.slug), 'running',
                      f"{chat_model_agent.type} in progress...")
        try:
            response = client.beta.chat.completions.parse(
                model=os.getenv('OPENAI_CHAT_MODEL'),
                messages=messages,
                response_format=ChatEvent
            )
        except Exception as e:
            update_status(channel_layer, group_name, str(chat_model_agent.slug), 'failed',
                        f"{chat_model_agent.type} failed.")
            raise WorkflowException("Chat model API call failed.")

        raw_content = response.choices[0].message.content.strip()
        if raw_content.startswith("```json") and raw_content.endswith("```"):
            raw_content = raw_content[7:-3].strip()

        try:
            data_dict = json.loads(raw_content)
            chat_data = ChatEvent(**data_dict)
        except Exception:
            logger.exception("Error parsing chat response: %s", raw_content)
            raise WorkflowException("Failed to parse chat response.")

        update_status(channel_layer, group_name, str(chat_model_agent.slug), 'completed',
                    f"{chat_model_agent.type} completed.")

    # Update memory if connection is available.
    if memory_conn:
        memory_agent = memory_conn.target
        update_status(channel_layer, group_name, str(memory_agent.slug), 'running',
                      f"{memory_agent.type} in progress...")
        try:
            mem_str = memory_agent.properties.get('memories', '[]')
            chat_memory_list = safe_json_loads(mem_str)
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
            memory_agent.save(update_fields=['properties'])
            update_status(channel_layer, group_name, str(memory_agent.slug), 'completed',
                          f"{memory_agent.type} completed.")
        except Exception:
            logger.exception("Error updating memory node for agent %s", current_agent.slug)
            update_status(channel_layer, group_name, str(memory_agent.slug), 'failed',
                          f"{memory_agent.type} failed.")
    return chat_data


def process_agent(current_agent, agent_input: Union[ChatTriggerEvent, ChatEvent, ElementList],
                  visited: Set[Any], channel_layer, group_name) -> List[str]:
    """
    Recursively processes an agent and its successors.
    """
    update_status(channel_layer, group_name, str(current_agent.slug), 'running',
                  f"{current_agent.type} in progress...")
    try:
        # Process agent based on its type.
        if current_agent.type == 'documentLoader':
            # For documentLoader, simply convert input.
            agent_input = ElementList(output=agent_input.output)
        elif current_agent.type == 'vectorStore':
            process_vector_store(current_agent, agent_input, channel_layer, group_name)
        elif current_agent.type == 'chatTrigger':
            agent_input = process_chat_trigger(current_agent, agent_input, channel_layer, group_name)
        elif current_agent.type == 'chat':
            agent_input = process_chat_agent(current_agent, agent_input, channel_layer, group_name)
        else:
            logger.warning("Unknown agent type '%s' encountered.", current_agent.type)

        update_status(channel_layer, group_name, str(current_agent.slug), 'completed',
                      f"{current_agent.type} completed.")

        # Retrieve and process next agents.
        next_conns = current_agent.connections_out.filter(connection_type='next')
        next_agents = [conn.target for conn in next_conns]
        if not next_agents:
            return [agent_input.output]

        outputs = []
        for next_agent in next_agents:
            if next_agent.id in visited:
                continue  # Avoid processing cycles.
            new_visited = visited.copy()
            new_visited.add(next_agent.id)
            outputs.extend(process_agent(next_agent, agent_input, new_visited, channel_layer, group_name))
        return outputs

    except WorkflowException:
        # Critical failures should halt further processing.
        raise
    except Exception:
        logger.exception("Error processing agent %s", current_agent.slug)
        update_status(channel_layer, group_name, -1, 'failed', "Workflow failed.")
        update_status(channel_layer, group_name, str(current_agent.slug), 'failed',
                      f"{current_agent.type} failed.")
        return []


@shared_task(bind=True)
def process_workflow(self, node_id: str, trigger_id: str, new_memory: ChatMemory = None, files = None) -> ChatMemory:
    """
    Process the workflow by traversing agents starting at the trigger node.
    Returns a list of final outputs.
    """
    channel_layer = get_channel_layer()
    group_name = f'workflow_{node_id}'
    update_status(channel_layer, group_name, None, 'info', "Workflow starting ...")

    try:

        # Retrieve workflow and trigger node with proper exception handling.
        try:
            workflow = Workflow.objects.get(pk=node_id)
        except ObjectDoesNotExist:
            raise WorkflowException("Workflow not found.")

        try:
            trigger_node = Agent.objects.get(slug=trigger_id)
        except ObjectDoesNotExist:
            raise WorkflowException("Trigger agent not found.")

        update_status(channel_layer, group_name, str(trigger_node.slug), 'running',
                      f"{trigger_node.type} in progress...")

        # Prepare the initial input based on trigger type.
        if trigger_node.type == 'chatTrigger':
            input_text = new_memory['input']
            initial_input = ChatTriggerEvent(output=input_text)
        elif trigger_node.type == 'documentLoader':
            if not files:
                raise WorkflowException("No files were uploaded")
            try:
                initial_input = process_trigger_document_loader(trigger_node, files, channel_layer, group_name)
            except Exception as e:
                logger.exception("Error processing documentLoader for trigger node %s", trigger_node.slug)
                update_status(
                    channel_layer,
                    group_name,
                    str(trigger_node.slug),
                    'failed',
                    f"{trigger_node.type} failed."
                )
                return []
        else:
            initial_input = ChatTriggerEvent(output=input_text)

        update_status(channel_layer, group_name, str(trigger_node.slug), 'completed',
                      f"{trigger_node.type} completed.")

        # Begin recursive processing.
        outputs = process_agent(trigger_node, initial_input, visited={trigger_node.id}, channel_layer=channel_layer, group_name=group_name)
    except WorkflowException as we:
        update_status(channel_layer, group_name, -1, 'failed', f"Error: {we}")
        return []
    else:
        update_status(channel_layer, group_name, None, 'info', "Workflow completed.")
        if trigger_node.type == 'chatTrigger':
            final_output = "\n".join(output for output in outputs if output)
            Memory.objects.create(input=new_memory['input'], output=final_output, slug=new_memory['id'], agent=Agent.objects.get(slug=trigger_id))
            new_memory['output'] = final_output
            return new_memory
        return []