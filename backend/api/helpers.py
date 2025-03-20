import base64
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any, Optional, List, Dict
from .models import Document

import numpy as np
from django.conf.global_settings import MEDIA_ROOT
from langchain_community.chat_models import (
    AzureChatOpenAI,
    ChatOllama,
    ChatOpenAI
)
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_community.embeddings import (
    AzureOpenAIEmbeddings,
    OllamaEmbeddings,
    OpenAIEmbeddings
)
from langchain_community.utils.math import cosine_similarity
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from neo4j import GraphDatabase
from openai import OpenAI
from pydantic import BaseModel, Field, field_validator

from unstructured.partition.pdf import partition_pdf_or_image, partition_pdf
from unstructured.partition.image import partition_image

from backend.utils.neo4j import get_driver

OPENAI_API_KEY = "REMOVED"
OPENAI_CHAT_COMPLETION_MODEL = 'gpt-4o'
OPENAI_IMAGE_DESCRIPTION_MODEL = 'gpt-4o-mini'
OPENAI_EMBEDDING_MODEL = 'text-embedding-ada-002'
client = OpenAI(api_key=OPENAI_API_KEY)


from django.db.models import F, Value, FloatField
from django.db.models import Func

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



class Element(BaseModel):
    type: str
    text: Any
    metadata: dict


class EntityNode(BaseModel):
    id: str
    label: str
    name: str
    properties: Optional[dict] = Field(default_factory=dict)


class Relationship(BaseModel):
    type: str
    source_id: str
    target_id: str
    properties: Optional[dict] = Field(default_factory=dict)

    @field_validator("type", mode="before")
    def replace_special_chars_in_type(cls, v):
        return re.sub(r'[^a-zA-Z]', '_', v)


class KnowledgeGraphData(BaseModel):
    entities: List[EntityNode]
    relationships: List[Relationship]


class Document(BaseModel):
    text: Any
    knowledge: KnowledgeGraphData
    metadata: dict


class NodeType(BaseModel):
    type: str


class RelationshipType(BaseModel):
    type: str

    @field_validator("type", mode="before")
    def replace_special_chars_in_type(cls, v):
        return re.sub(r'[^a-zA-Z]', '_', v)


class DocumentNodeAndRelationshipTypes(BaseModel):
    entity_types: List[NodeType]
    relationship_types: List[RelationshipType]


def get_upload_path(instance, filename):
    name, extension = os.path.splitext(filename)
    file_path = f'documents/{instance.name}{extension}'
    return file_path


def get_chat_model(service, workspace):
    if service == 'azure':
        return AzureChatOpenAI(
            azure_deployment=os.getenv('AZURE_CHAT_COMPLETION_MODEL'),
            api_version=os.getenv('AZURE_OPENAI_API_VERSION'),
            azure_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT'),
            api_key=os.getenv('AZURE_OPENAI_API_KEY'),
            temperature=workspace.temperature,
            max_tokens=None,
            timeout=None,
            max_retries=2,
        )
    elif service == 'ollama':
        return ChatOllama(
            model=os.getenv('OLLAMA_CHAT_COMPLETION_MODEL'),
            temperature=workspace.temperature,
            base_url=os.getenv('OLLAMA_ENDPOINT')
        )
    elif service == 'openai':
        return ChatOpenAI(
            model=os.getenv('OPENAI_CHAT_COMPLETION_MODEL'),
            api_key=os.getenv('OPENAI_API_KEY'),
            temperature=workspace.temperature
        )


def get_langchain_embedding_model(service):
    if service == 'azure':
        return AzureOpenAIEmbeddings(
            model=os.getenv('AZURE_EMBEDDING_MODEL'),
            azure_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT'),
            api_key=os.getenv('AZURE_OPENAI_API_KEY'),
            openai_api_version=os.getenv('AZURE_OPENAI_API_VERSION'),
        )
    elif service == 'ollama':
        return OllamaEmbeddings(
            model=os.getenv('OLLAMA_EMBEDDING_MODEL'),
        )
    elif service == 'openai':
        return OpenAIEmbeddings(
            model=os.getenv('OPENAI_EMBEDDING_MODEL'),
            api_key=os.getenv('OPENAI_API_KEY'),
        )


class DocumentLoader:

    def __init__(self, document):
        self.file_path = f'media/{document.file}'

    @property
    def get_ext(self):
        return os.path.splitext(self.file_path)[1].lstrip('.').lower()

    # Read image (OCR)
    def parse_image(self, image_path):
        return partition_image(
            filename=image_path,
            strategy="hi_res",
            languages=["eng"]
        )

    # Encode image
    def encode_image(self, image_path):
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    # Generate image description
    def generate_image_description(self, image_path):
        base64_image = self.encode_image(image_path)
        response = client.chat.completions.create(
            model=OPENAI_IMAGE_DESCRIPTION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "What is in this image? Describe it in great detail. If the image contains any numbers or statistics, translate it into great detail with a lengthy prose. Do not leave anything out. If exact numbers or values are hard to read, estimate it the best you can. Act like you are reading it out to someone.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            },
                        },
                    ],
                }
            ],
        )

        return response.choices[0].message.content

    # Categorize PDF into 'text', 'table' or 'image' components
    def generate_elemental_structure(self, raw_elements, include_images=True):
        categorized_elements = []
        for element in raw_elements:
            if "unstructured.documents.elements.Table" in str(type(element)):
                categorized_elements.append(
                    Element(type="table", text=str(element), metadata={'page': element.metadata.page_number}))
            elif "unstructured.documents.elements.CompositeElement" in str(type(element)):
                categorized_elements.append(
                    Element(type="text", text=str(element), metadata={'page': element.metadata.page_number}))
            elif "unstructured.documents.elements.Image" in str(type(element)):
                if include_images:
                    if element.metadata.image_path:
                        try:
                            raw_image_elements = self.parse_image(element.metadata.image_path)
                            if not raw_image_elements:
                                categorized_elements.append(Element(type="image",
                                                                    metadata={'page': element.metadata.page_number,
                                                                              'url': str(element.metadata.image_path)},
                                                                    text=str(self.generate_image_description(
                                                                        element.metadata.image_path))))
                            for raw_image_element in raw_image_elements:
                                if "unstructured.documents.elements.Table" in str(type(raw_image_element)):
                                    categorized_elements.append(Element(type="table", text=str(raw_image_element),
                                                                        metadata={
                                                                            'page': element.metadata.page_number}))
                                elif "unstructured.documents.elements.CompositeElement" in str(type(raw_image_element)):
                                    categorized_elements.append(Element(type="text", text=str(raw_image_element),
                                                                        metadata={
                                                                            'page': element.metadata.page_number}))
                                elif "unstructured.documents.elements.Image" in str(type(raw_image_element)):
                                    categorized_elements.append(Element(type="image",
                                                                        metadata={'page': element.metadata.page_number,
                                                                                  'url': str(
                                                                                      raw_image_element.metadata.image_path)},
                                                                        text=str(self.generate_image_description(
                                                                            raw_image_element.metadata.image_path))))
                                else:
                                    categorized_elements.append(
                                        Element(type="text", metadata={'page': element.metadata.page_number},
                                                text=str(raw_image_element)))
                        except Exception as e:
                            categorized_elements.append(Element(type="image",
                                                                metadata={'page': element.metadata.page_number,
                                                                          'url': str(element.metadata.image_path)},
                                                                text=str(self.generate_image_description(
                                                                    element.metadata.image_path))))
            else:
                categorized_elements.append(
                    Element(type="text", metadata={'page': element.metadata.page_number}, text=str(element)))
        return categorized_elements

    # Combine rogue text elements into one
    def combine_text_elements(self, elements: List[Element]) -> List[Element]:
        all_combined_elements = []
        current_page = 1

        while True:
            page_elements = [element for element in elements if element.metadata['page'] == current_page]
            if not page_elements:
                break

            current_text = ""
            combined_elements = []
            for element in page_elements:
                if element.type == "text":
                    if current_text:
                        current_text += " " + str(element.text)
                    else:
                        current_text = str(element.text)
                else:
                    # Append combined text as a new Element if exists, then add the breakpoint element
                    if current_text:
                        combined_elements.append(
                            Element(type="text", text=current_text, metadata={'page': current_page}))
                        current_text = ""  # Reset current_text for the next batch

                    # Add table or image element directly
                    combined_elements.append(element)

            # Add any remaining text as a final Element
            if current_text:
                combined_elements.append(Element(type="text", text=current_text, metadata={'page': current_page}))

            all_combined_elements.append((combined_elements, current_page))

            current_page += 1

        return all_combined_elements

    def convert_elements_to_text(self, elements: List[Element], fine_tune=False) -> str:
        raw_text = ""
        for element in elements:
            if element.type == 'text':
                raw_text += 'Text: ' + element.text + '\n'
            elif element.type == 'table':
                raw_text += 'Table: ' + element.text + '\n'
            elif element.type == 'image':
                raw_text += 'Image: ' + element.text + '\n'
        PROMPT_TEMPLATE = """
        You are an expert assistant skilled in recreating documents in Markdown format while preserving the original structure and formatting. Your task is to take parsed elements of a PDF (which may include text, tables, and images) and convert them into a well-structured Markdown document. Pay attention to preserving the order and hierarchy of the content, ensuring accuracy and clarity in the final Markdown output.

        ---

        **Guidelines**:
        1. **Order and Structure**:
           - Maintain the exact order of the elements as provided in the parsed input.
           - Reconstruct the original hierarchy (e.g., headings, subheadings, and body text) using appropriate Markdown syntax.

        2. **Formatting**:
           - Use Markdown headings (`#`, `##`, `###`, etc.) to represent sections and subsections.
           - Use bullet points (`-`) or numbered lists for lists.
           - Recreate tables using Markdown table syntax.
           - Represent images using `![Alt Text](image_url_or_placeholder)`.

        3. **Enhancements**:
           - Add bold (`**`) or italic (`_`) formatting where necessary to emphasize important parts.
           - Combine fragmented text from the parsed elements into coherent sentences or paragraphs where appropriate.
           - If the structure is unclear or missing, use your best judgment to infer and recreate it logically.

        4. **Special Handling for Tables**:
           - If a table structure is unclear, reconstruct it with logical column headers and rows based on the content.
           - Align column headers and values appropriately in the Markdown table.

        5. **Images**:
           - Represent images with a placeholder (e.g., `![Image](image_placeholder_url)`) if the URL or image source is unavailable.

        6. **Text**:
           - Group related text elements into coherent paragraphs.
           - Use blockquotes (`>`) for any quotes or special notes.

        7. **Unstructured or Ambiguous Elements**:
           - Clearly label any ambiguous sections as "Unstructured Content" with a Markdown comment (e.g., `<!-- Unstructured Content -->`).
           - Add a note indicating areas where the structure could not be inferred.

        ---

        **Input**:
        Here are the parsed elements of the PDF:
        {parsed_elements}

        **Output**:
        Provide the reconstructed document in Markdown format. Ensure that the final output is accurate, clear, and reflects the structure of the original PDF as closely as possible.

        ---

        **Example**:

        **Input**:
        1. Text: "Invoice #12345"
        2. Table: 
           - Header: ["Item", "Quantity", "Price"]
           - Rows: [["Apple", "2", "$3"], ["Banana", "5", "$2"]]
        3. Text: "Total: $13"
        4. Image: "image_url_here"

        **Output**:
        ```markdown
        # Invoice #12345

        | Item    | Quantity | Price |
        |---------|----------|-------|
        | Apple   | 2        | $3    |
        | Banana  | 5        | $2    |

        **Total:** $13

        ![Invoice Image](image_url_here)

        """
        prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
        prompt = prompt_template.format(parsed_elements=raw_text)
        model = ChatOpenAI(temperature=0.0, api_key=OPENAI_API_KEY, model=OPENAI_CHAT_COMPLETION_MODEL)
        response = model.invoke(prompt).content
        return response

    def extract_raw_pdf_elements(self, file_path: str) -> List:
        return partition_pdf_or_image(
            filename=file_path,
            extract_images_in_pdf=True,
            image_output_dir_path=MEDIA_ROOT,
            extract_image_block_types=["Image"],
            extract_image_block_to_payload=False,
            starting_page_number=1,
            infer_table_structure=True,
            chunking_strategy="by_title",
            max_characters=4000,
            new_after_n_chars=3800,
            combine_text_under_n_chars=2000,
        )

    def load(self):
        path = self.file_path
        ext = self.get_ext

        loaded_documents = []

        if ext == 'md':
            loaded_documents = self.load_markdown(path)
        elif ext == 'txt':
            loaded_documents = self.load_text(path)
        elif ext == 'pdf':
            loaded_documents = self.load_pdf(path)

        return loaded_documents

    def load_markdown(self, file_path):
        def replace_title(match):
            return f"# {match.group(1)}\n"

        def get_split_headers(split):
            section = ""
            for header in ['Header 1', 'Header 2', 'Header 3', 'Header 4']:
                section += f'{split.metadata[header]}:' if header in split.metadata else ''
            if section:
                if section[-1] == ':':
                    section = section[:-1]
            return section

        try:
            document = TextLoader(file_path, encoding="UTF-8").load()[0].page_content
        except RuntimeError or UnicodeDecodeError or FileNotFoundError:
            return []

        title_pattern = r'---\ntitle: (.*?)\n---'
        document = re.sub(title_pattern, replace_title, document, flags=re.DOTALL)

        headers_to_split_on = [
            ("#", "Header 1"),
            ('##', 'Header 2'),
            ('###', 'Header 3'),
            ('####', 'Header 4'),
        ]

        markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on, strip_headers=False)
        md_header_splits = markdown_splitter.split_text(document)

        md_header_split_sections = [get_split_headers(md_header_split) for md_header_split in md_header_splits]

        text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            model_name=OPENAI_EMBEDDING_MODEL, chunk_size=1500, chunk_overlap=0,
        )

        text_splits = []
        text_split_sections = []
        for md_header_split, md_header_split_section in zip(md_header_splits, md_header_split_sections):
            for text_split in text_splitter.split_documents([md_header_split]):
                text_splits.append(text_split.page_content)
                text_split_sections.append(md_header_split_section)
        print(f"\n\n\n{text_splits}\n\n\n")

        return [
            Element(
                type='text', text=text_split,
                metadata={
                    'source': Path(file_path).name,
                    'uid': hashlib.sha256(str.encode(text_split)).hexdigest()
                }
            )
            for text_split, md_header_split_section in zip(text_splits, md_header_split_sections)
        ]

    def load_text(self, file_path):
        try:
            document = TextLoader(file_path, encoding="UTF-8").load()[0].page_content
        except RuntimeError or UnicodeDecodeError or FileNotFoundError or ValueError:
            return []

        text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            model_name='text-embedding-ada-002', chunk_size=1500, chunk_overlap=0,
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

    def load_pdf(self, file_path, include_images=False):
        try:
            pages = []
            loader = PyPDFLoader(file_path)
            documents = [document.page_content for document in PyPDFLoader(file_path).load()]
        except RuntimeError or UnicodeDecodeError or FileNotFoundError or ValueError:
            return []

        return [
            Element(
                type="text",
                text=document,
                metadata = {
                    'source': Path(file_path).name,
                    'uid': hashlib.sha256(str.encode(document)).hexdigest()
                }
            ) for document in documents
        ]

        # raw_pdf_elements = self.extract_raw_pdf_elements(file_path=file_path)
        # categorized_elements_pages = self.combine_text_elements(
        #     self.generate_elemental_structure(raw_elements=raw_pdf_elements, include_images=include_images))
        # elements = []
        # for categorized_elements, page_number in categorized_elements_pages:
        #     text = self.convert_elements_to_text(categorized_elements, fine_tune=False)
        #     elements.append(
        #         Element(
        #             type='text',
        #             text=self.convert_elements_to_text(categorized_elements, fine_tune=False),
        #             metadata={
        #                 'source': Path(file_path).name,
        #                 'page_number': page_number,
        #                 'uid': hashlib.sha256(str.encode(text)).hexdigest()
        #             }
        #         )
        #     )
        # return elements


class KnowledgeGenerator:

    def __init__(self, elements):
        self.elements = elements

    def generate_node_and_relationship_types(self, all_types: Dict,
                                             element: Element) -> DocumentNodeAndRelationshipTypes:
        all_entities = all_types['node_types']
        all_relationships = all_types['relationship_types']

        # for document in existing_documents:
        #     all_entities.extend([i.label for i in document.knowledge.entities])
        #     all_relationships.extend([i.type for i in document.knowledge.relationships])
        #
        # all_entities = list(set(all_entities))
        # all_relationships = list(set(all_relationships))

        while True:
            response = client.chat.completions.create(
                model=OPENAI_CHAT_COMPLETION_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": [
                            {
                                "type": "text",
                                "text": """
                            Given the some text from a document, identify and extract relevant and appropriate entity and relationship types for a large neo4j graph. You are also provided existing node and relationship types to provide context for the existing graph. If the text has an entity or relationship type that is very similar to a type in the provided lists, then use it. Otherwise, generate new ones. Return a structured JSON in the following format:

                            ### Instructions:

                            1. **Entity types**:
                               - For each distinct entity type, create an entry under "entity_types" with:
                                 - `type`: The type of the entity (e.g., "Person", "Event", "Location"). Must be unique and relevant to document text. If a similar entity type already exists in the list of provided entity types, then use that to avoid repetition. Otherwise, create a new one. Only use letters and underscore, absolutely no spaces or special characters allowed.

                            2. **Relationship Types**:
                               - For each relationship type, create an entry under "relationship_types" with:
                                 - `type`: The type of relationship (e.g., "INTRODUCED", "ATTENDED", "CONTAINS", etc.). Must be unique and relevant to document text. If a similar entity type already exists in the list of provided entity types, then use that to avoid repetition. Only use letters and underscore, absolutely no spaces or special characters allowed.

                            3. **Format the response** as a JSON object with two main arrays:
                               - `"entity_types"`: An array of entity objects.
                               - `"relationship_types"`: An array of relationship objects.

                            ### Example:

                            For the input text:
                            "Text: Evan introduced Michael at the science convention in 2022. George was also present. Existing entity types: ['Individual', 'Job']. Existing relationship types: ['INTRODUCED', 'CONTAINS', 'RELATED_TO']"

                            The response should look like this:

                            ```json
                            {
                              "entity_types": [
                                {"type": "Individual"},
                                {"type": "Event"},
                              ],
                              "relationship_types": [
                                {"type": "INTRODUCED"},
                                {"type": "ATTENDED"},
                              ]
                            }

                          """
                            }
                        ],
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f'Text: {element.text}. Existing entity types: {all_entities}. Existing relationship types: {all_relationships}'
                            }
                        ]
                    }
                ],
            )

            # Simulate the response content (remove the `'''` in actual usage)
            raw_content = response.choices[0].message.content.strip()

            # Remove any backticks or extraneous characters, e.g., if enclosed in markdown-like syntax
            if raw_content.startswith("```json") and raw_content.endswith("```"):
                raw_content = raw_content[7:-3].strip()

            try:
                data = json.loads(raw_content)
                document_node_and_relationship_types = DocumentNodeAndRelationshipTypes(**data)
                return document_node_and_relationship_types
            except Exception as e:
                print("Validation error:", e)

    # Helper function to generate a unique entity ID
    def generate_entity_id(self, entity: EntityNode) -> str:
        unique_string = f"{entity.label}-{entity.name}-{json.dumps(entity.properties, sort_keys=True)}"
        return hashlib.md5(unique_string.encode('utf-8')).hexdigest()

    def generate_knowledge_graph(self, element: Element, types: DocumentNodeAndRelationshipTypes) -> KnowledgeGraphData:
        node_types = [i.type for i in types.entity_types]
        relationship_types = [i.type for i in types.relationship_types]
        max_retries = 3
        retry_count = 0

        while retry_count < max_retries:
            try:
                response = client.chat.completions.create(
                    model=OPENAI_CHAT_COMPLETION_MODEL,
                    messages=[
                        {
                            "role": "system",
                            "content": [
                                {
                                    "type": "text",
                                    "text": """
                              Given the following text and some entity types and relationship types, identify and extract entities and their relationships using only the types mentioned, then return a structured JSON in a format compatible with a knowledge graph. Use the following instructions for the JSON format:

                                ### Instructions:

                                1. **Entities**:
                                   - For each distinct entity, create an entry under "entities" with:
                                     - `id`: A unique identifier for each entity (you can assign simple unique strings or IDs like "1", "2", etc.).
                                     - `label`: The type or category of the entity (e.g., "Person", "Event", "Location").
                                     - `name`: The name or main identifier of the entity.
                                     - `properties`: Additional optional information about the entity, such as year, location, role, etc., in a dictionary format.

                                2. **Relationships**:
                                   - For each relationship between two entities, create an entry under "relationships" with:
                                     - `type`: The type of relationship (e.g., "INTRODUCED", "ATTENDED"). There should be absolutely no spaces in the type, only underscores.
                                     - `source_id`: The unique ID of the source entity (from `entities`).
                                     - `target_id`: The unique ID of the target entity (from `entities`).
                                     - `properties`: Additional optional information about the relationship (e.g., context details) in a dictionary format.

                                3. **Format the response** as a JSON object with two main arrays:
                                   - `"entities"`: An array of entity objects.
                                   - `"relationships"`: An array of relationship objects.

                                ### Example:

                                For the input text:
                                "Text: Evan introduced Michael at the science convention in 2022. George was also present. Node types: ['Person', 'Event']. Relationship Types: ['INTRODUCED', 'ATTENDED'] "

                                The response should look like this:

                                ```json
                                {
                                  "entities": [
                                    {"id": "1", "label": "Person", "name": "Evan", "properties": {"role": "introducer"}},
                                    {"id": "2", "label": "Person", "name": "Michael"},
                                    {"id": "3", "label": "Event", "name": "Science Convention", "properties": {"year": "2022"}},
                                    {"id": "4", "label": "Person", "name": "George"}
                                  ],
                                  "relationships": [
                                    {"type": "INTRODUCED", "source_id": "1", "target_id": "2"},
                                    {"type": "ATTENDED", "source_id": "1", "target_id": "3"},
                                    {"type": "ATTENDED", "source_id": "2", "target_id": "3"},
                                    {"type": "ATTENDED", "source_id": "4", "target_id": "3"}
                                  ]
                                }

                              """
                                }
                            ],
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": f'Text: {element.text}. Node Types: {node_types}. Relationship Types: {relationship_types}'
                                }
                            ]
                        }
                    ],
                )

                # Simulate the response content (remove the `'''` in actual usage)
                raw_content = response.choices[0].message.content.strip()

                # Remove any backticks or extraneous characters, e.g., if enclosed in markdown-like syntax
                if raw_content.startswith("```json") and raw_content.endswith("```"):
                    raw_content = raw_content[7:-3].strip()

                data = json.loads(raw_content)
                knowledge_graph_data = KnowledgeGraphData(**data)

                # Update relationships with new entity IDs
                id_mapping = {}
                for entity in knowledge_graph_data.entities:
                    new_id = self.generate_entity_id(entity)
                    id_mapping[entity.id] = new_id  # Store the mapping from original ID to new ID
                    entity.id = new_id  # Update the entity's ID to the new format
                for relationship in knowledge_graph_data.relationships:
                    relationship.source_id = id_mapping.get(relationship.source_id, relationship.source_id)
                    relationship.target_id = id_mapping.get(relationship.target_id, relationship.target_id)

                return knowledge_graph_data

            except Exception as e:
                print("Validation error:", e)
                retry_count += 1

        raise ValueError("Max retries exceeded for knowledge graph generation.")

    def generate_knowledge(self) -> KnowledgeGraphData:
        graph = Neo4jGraph()
        types = graph.get_unique_node_and_relationship_types()
        documents = []

        for text_element in self.elements:
            try:
                types_template = self.generate_node_and_relationship_types(
                    all_types=types,
                    element=text_element
                )
                knowledge = self.generate_knowledge_graph(
                    element=text_element,
                    types=types_template
                )

                entity_types = [i.label for i in knowledge.entities]
                relationship_types = [i.type for i in knowledge.relationships]

                types['node_types'].extend(entity_types)
                types['relationship_types'].extend(relationship_types)

                types['node_types'] = list(set(types['node_types']))
                types['relationship_types'] = list(set(types['relationship_types']))

                documents.append(Document(
                    text=text_element.text,
                    knowledge=knowledge,
                    metadata={'source': text_element.metadata['source']})
                )
            except Exception as e:
                print(e)
                continue

        unique_relationship_types = []
        for document in documents:
            unique_relationship_types.extend([i.type for i in document.knowledge.relationships])

        unique_relationship_types = list(set(unique_relationship_types))

        return documents, unique_relationship_types


class Neo4jGraph:
    def __init__(self):
        self.driver = get_driver()

    # Close neo4j driver
    def close(self):
        self.driver.close()

    # Delete all nodes and relationships
    def delete_all_data(self):
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
        self.close()

    # Embed document text
    def calculate_document_embedding(self, text: Any) -> Optional[list]:
        """
        Placeholder for document text embedding calculation.
        Returns a list representing the embedding.
        """
        # Placeholder: Add code here to calculate and return embedding
        client = OpenAI(api_key=OPENAI_API_KEY)

        return client.embeddings.create(
            input=text,
            model=OPENAI_EMBEDDING_MODEL
        ).data[0].embedding

    @staticmethod
    def format_label(label: str) -> str:
        """
        Formats labels to be compatible with Neo4j constraints (e.g., spaces to underscores).
        """
        return label.replace(" ", "_")

    # Insert document with node2vec embedding
    def insert_document(self, document: Document, slug: str):
        """
        Inserts a document into the graph with its text embedding and associated knowledge.
        """
        embedding = self.calculate_document_embedding(document.text)

        with self.driver.session() as session:
            # Insert the document as a node with embedding
            doc_id = hashlib.sha256(str.encode(document.text)).hexdigest()
            doc_properties = {"text": document.text, "embedding": embedding}
            session.write_transaction(self._create_or_update_document_node, doc_id, doc_properties, slug)

            special_entity_node = EntityNode(id=f'Source-{document.metadata['source']}', label='Source',
                                             name=document.metadata['source'], properties={})
            special_entity_relationship = Relationship(type='CONTAINS', source_id=doc_id,
                                                       target_id=f'Source-{document.metadata['source']}')

            # Insert entities and relationships
            for entity in document.knowledge.entities:
                session.write_transaction(self._create_or_update_node, entity, doc_id)
            session.write_transaction(self._create_or_update_node, special_entity_node, doc_id)
            for rel in document.knowledge.relationships:
                session.write_transaction(self._create_relationship, rel)
            session.write_transaction(self._create_relationship, special_entity_relationship)

    def update_node2vec_embeddings(self, relationship_types=None):
        # Step 1: Retrieve all unique node labels
        with self.driver.session() as session:
            labels_result = session.run("CALL db.labels() YIELD label RETURN collect(label) AS labels")
            all_labels = labels_result.single()["labels"]

        # Default to an empty list if no relationships are provided
        if relationship_types is None:
            relationship_types = []

        # Step 1.5: Retrieve existing relationship types
        with self.driver.session() as session:
            relationships_result = session.run(
                "CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS types")
            existing_relationship_types = set(relationships_result.single()["types"])

        # Filter out relationship types that don’t exist
        valid_relationship_types = [rel for rel in relationship_types if rel in existing_relationship_types]

        # Format the valid relationships in Cypher for undirected projection
        relationships_str = ",\n".join(
            [f"{rel}: {{ type: '{rel}', orientation: 'UNDIRECTED' }}" for rel in valid_relationship_types]
        )

        # Step 3: Drop the existing 'node2vec' graph projection if it exists
        with self.driver.session() as session:
            session.run("""
                CALL {
                    CALL gds.graph.exists('node2vec')
                    YIELD exists
                    RETURN exists
                }
                WITH exists
                WHERE exists
                CALL gds.graph.drop('node2vec') YIELD graphName
                RETURN graphName
            """)

            # Step 4: Project the graph with all labels and valid relationships
            session.run(f"""
                CALL gds.graph.project(
                    'node2vec',
                    {all_labels},
                    {{
                        {relationships_str}
                    }}
                )
            """)

            # Step 5: Run node2vec to update embeddings for all nodes
            session.run("""
                CALL gds.node2vec.write('node2vec', {
                    writeProperty: 'embedding_vector',
                    embeddingDimension: 128,
                    iterations: 10,
                    walkLength: 10
                })
            """)

    @staticmethod
    def _create_or_update_document_node(tx, doc_id: str, properties: dict, slug: str):
        """
        Creates or updates a document node in the graph.
        """
        tx.run(
            """
            MERGE (d:Document {id: $doc_id})
            SET d += $properties, d.agent_slug = $slug
            """,
            doc_id=doc_id, properties=properties, slug=slug
        )

    @staticmethod
    def _create_or_update_node(tx, entity: EntityNode, doc_id: str):
        """
        Creates or updates an entity node and links it to the document node.
        """
        formatted_label = Neo4jGraph.format_label(entity.label)
        tx.run(
            f"""
            MERGE (e:{formatted_label} {{id: $id}})
            SET e.name = $name, e += $properties
            WITH e
            MATCH (d:Document {{id: $doc_id}})
            MERGE (d)-[:CONTAINS]->(e)
            """,
            id=entity.id, name=entity.name, properties=entity.properties, doc_id=doc_id
        )

    @staticmethod
    def _create_relationship(tx, relationship: Relationship):
        """
        Creates a relationship between two entity nodes.
        """
        tx.run(
            f"""
            MATCH (a {{id: $source_id}}), (b {{id: $target_id}})
            MERGE (a)-[r:{relationship.type}]->(b)
            SET r += $properties
            """,
            source_id=relationship.source_id,
            target_id=relationship.target_id,
            properties=relationship.properties
        )

    def insert_knowledge_graph_data(self, data: KnowledgeGraphData):
        with self.driver.session() as session:
            # Insert entities as nodes
            for entity in data.entities:
                session.write_transaction(self._create_or_update_node, entity)

            # Insert relationships as edges
            for rel in data.relationships:
                session.write_transaction(self._create_relationship, rel)

    # Placeholder for embedding calculation (to be implemented by user)
    def calculate_embedding(self, text: str) -> np.ndarray:

        return client.embeddings.create(
            input=text,
            model=OPENAI_EMBEDDING_MODEL
        ).data[0].embedding

    # Method to find the top N most similar documents based on query embedding
    def retrieve_similar_documents(self, query: str, top_n: int = 5) -> List[dict]:
        query_embedding = self.calculate_embedding(query)

        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (doc:Document)
                WHERE doc.embedding IS NOT NULL
                WITH doc, gds.similarity.cosine(
                    doc.embedding, 
                    $query_embedding
                ) AS similarity
                RETURN doc, similarity
                ORDER BY similarity DESC
                LIMIT $top_n
                """,
                query_embedding=query_embedding,
                top_n=top_n
            )

            documents = [
                {
                    "id": record["doc"]["id"],
                    "text": record["doc"]["text"],
                    "similarity": record["similarity"]
                }
                for record in result
            ]
        return documents

    def get_document_text_embedding(self, doc_id: str):
        # Cypher query to get the embedding field of the Document node by id
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (doc:Document {id: $doc_id})
                RETURN doc.embedding AS embedding
                """,
                doc_id=doc_id
            )

            # Extract the embedding from the result (assuming it's stored as a list or array)
            record = result.single()  # Get the single result (since it's expected to return one document)

            if record is not None:
                embedding = record["embedding"]
                return embedding
            else:
                # If no embedding is found for the document, return None or handle the case as needed
                return None

    def generate_cypher_query(self, query: str, entities: str, relationships: str) -> str:
        PROMPT_TEMPLATE = """You are an assistant tasked with transforming a user query \
        into a cypher query to query a neo4j graph. Use the graph node and relationship \
        types to form a relevant cypher query based on the user query. \
        Simply output the cypher query as plain string without any explanation \
        and without any type indicators. Format dates only as YYYY-MM-DD. \
        Here are the document entities: {entities}. \
        Here are the document relationships: {relationships}. \
        Here is the user query: {user_query}"""
        prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
        prompt = prompt_template.format(user_query=query, entities=entities, relationships=relationships)
        model = ChatOpenAI(temperature=0.0, api_key=OPENAI_API_KEY, model=OPENAI_CHAT_COMPLETION_MODEL)
        response = model.invoke(prompt).content
        return response

    def retrieve_entities_for_document(self, document_id: str) -> List[dict]:
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (doc:Document {id: $document_id})-[:CONTAINS]->(entity)
                RETURN entity
                """,
                document_id=document_id
            )

            # Process and structure the returned entities, excluding 'embedding' property
            entities = [
                {
                    "id": record["entity"]["id"],
                    "name": record["entity"].get("name", ""),
                    "label": list(record["entity"].labels)[0],  # Assuming one main label per entity
                    "properties": {k: v for k, v in dict(record["entity"]).items() if
                                   k != "embedding" and k != 'embedding_vector'},
                }
                for record in result
            ]

        return entities

    def retrieve_relationships_for_document(self, document_id: str) -> List[dict]:
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (doc:Document {id: $document_id})-[:CONTAINS]->(entity1)
                MATCH (entity1)-[rel]->(entity2)
                WHERE (doc)-[:CONTAINS]->(entity2)
                RETURN entity1.id AS source_id, entity2.id AS target_id, type(rel) AS relationship_type, rel AS properties
                """,
                document_id=document_id
            )

            # Process and structure the returned relationships
            relationships = [
                {
                    "source_id": record["source_id"],
                    "target_id": record["target_id"],
                    "type": record["relationship_type"],
                    "properties": dict(record["properties"])
                }
                for record in result
            ]

        return relationships

    def get_unique_node_and_relationship_types(self):
        """
        Retrieves unique node labels (types) and relationship types from document nodes
        that have the specified agent_slug.
        Returns a dictionary with 'node_types' and 'relationship_types'.
        """
        with self.driver.session() as session:
            # Get unique node labels for document nodes with the provided agent_slug.
            node_result = session.run(
                """
                MATCH (d:Document)
                RETURN DISTINCT labels(d) AS nodeLabels
                """,
            )
            node_types = {label for record in node_result for label in record["nodeLabels"]}

            # Get unique relationship types for relationships originating from document nodes with the provided agent_slug.
            rel_result = session.run(
                """
                MATCH (d:Document)-[r]->(n)
                WHERE d.agent_slug = $agent_slug
                RETURN DISTINCT type(r) AS relationshipType
                """,
            )
            relationship_types = {record["relationshipType"] for record in rel_result}

        return {
            "node_types": list(node_types),
            "relationship_types": list(relationship_types),
        }

    # Helper to retrieve detailed document information for final results
    def get_document_details(self, document_id: str) -> dict:
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (doc:Document {id: $document_id})
                RETURN doc.id AS id, doc.text as text
                """,
                document_id=document_id
            )
            record = result.single()
            if record:
                return {"id": record["id"], 'text': record['text']}
            return {}

    def get_document_embedding(self, doc_id: str):
        # Cypher query to get the embedding field of the Document node by id
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (doc:Document {id: $doc_id})
                RETURN doc.embedding_vector AS embedding
                """,
                doc_id=doc_id
            )

            # Extract the embedding from the result (assuming it's stored as a list or array)
            record = result.single()  # Get the single result (since it's expected to return one document)

            if record is not None:
                embedding = record["embedding"]
                return embedding
            else:
                # If no embedding is found for the document, return None or handle the case as needed
                return None

    def extract_documents_by_keywords(self, user_query: str) -> List[Dict]:
        """
        Extracts all documents from the Neo4j graph that match the keywords in the user query.
        Combines fuzzy search and embedding similarity search for keywords only.

        :param user_query: The user's search query.
        :return: A list of dictionaries representing matching documents.
        """
        preprocessed_query = self.preprocess_query(user_query)  # Implement preprocessing if needed

        query_variations = [
            # Partial matching using CONTAINS
            (
                f"""
                MATCH (doc:Document)-[:CONTAINS]->(e)
                WHERE e.name CONTAINS $user_query
                RETURN DISTINCT doc
                """,
                {"user_query": preprocessed_query},
            ),

            # Fuzzy matching using Levenshtein similarity
            (
                f"""
                MATCH (doc:Document)-[:CONTAINS]->(e)
                WHERE apoc.text.levenshteinSimilarity(e.name, $user_query) > 0.6
                RETURN DISTINCT doc
                """,
                {"user_query": preprocessed_query},
            ),

            # Semantic similarity using embeddings (if available)
            (
                f"""
                MATCH (doc:Document)-[:CONTAINS]->(e)
                WITH doc, gds.similarity.cosine(e.embedding, $query_embedding) AS similarity
                WHERE similarity > 0.7
                RETURN DISTINCT doc
                """,
                {"query_embedding": self.calculate_embedding(preprocessed_query)},
            ),
        ]

        matching_documents = []

        # Execute each query variation
        with self.driver.session() as session:
            for cypher, parameters in query_variations:
                try:
                    result = session.run(cypher, **parameters)
                    for record in result:
                        doc = record["doc"]
                        matching_documents.append({
                            "id": doc["id"],
                            "name": doc.get("name", "Unnamed Document"),
                            **doc,  # Include other document properties if needed
                        })
                except Exception as e:
                    print(f"Error executing query variation: {e}")

        # Deduplicate matching documents by their ID
        unique_documents = {doc["id"]: doc for doc in matching_documents}.values()
        return list(unique_documents)

    def preprocess_query(self, query: str) -> str:
        """
        Placeholder for preprocessing the user query.
        :param query: Raw user query.
        :return: Preprocessed query string.
        """
        return query.strip().lower()

    def calculate_query_embedding(self, query: str) -> List[float]:
        """
        Placeholder for calculating embeddings for the query.
        Replace this with your actual embedding calculation logic.
        :param query: The user query.
        :return: A list representing the query embedding.
        """
        # Mock embedding; replace with real logic (e.g., calling an LLM or embedding service)
        return [0.1, 0.2, 0.3, 0.4]

    def evaluate_relevance(self, query: str, text: str, entities: dict) -> str:
        PROMPT_TEMPLATE = """
        You are an assistant tasked with determining whether a document is relevant to a user's query.
        Here is the user query: "{query}"
        Here is the document content: {content}.
        Here is the metadata: {metadata}
        Respond with "RELEVANT" if the document is relevant, and "NOT RELEVANT" otherwise. Nothing else at all.
        """
        prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
        prompt = prompt_template.format(query=query, content=text, metadata=str(entities))
        model = ChatOpenAI(temperature=0.0, api_key=OPENAI_API_KEY, model=OPENAI_CHAT_COMPLETION_MODEL)
        response = model.invoke(prompt).content
        return response

    def generate_response(self, query: str, partial_response: str, document_text: str) -> str:
        PROMPT_TEMPLATE = """
        You are a highly skilled assistant tasked with answering user queries by processing multiple documents in batches. Your goal is to provide a complete and accurate response by sequentially analyzing documents and appending relevant information to an evolving partial response.

        **Guidelines**:
        1. Focus only on information from the **current document** that directly addresses the **user query**. Do not include unrelated details.
        2. Refine and append to the **partial response** by integrating new information from the current document. Ensure the response remains coherent, concise, and relevant.
        3. Do not repeat information already present in the partial response.
        4. Use consistent formatting and language throughout the partial response to maintain clarity.
        5. If no relevant information is found in the current document, do not modify the partial response.

        **Input**:
        - **User Query**: {user_query}
        - **Partial Response**: {partial_response}
        - **Current Document Text**: {document_text}

        **Output**:
        Return the updated **Partial Response**, integrating relevant information from the current document.

        ---

        **Example**:
        **User Query**: "What are the key milestones in Project Alpha?"
        **Partial Response**: 
        "Key milestones in Project Alpha include:
        - Initial design phase completed in January 2021.
        - Beta testing started in August 2021."

        **Current Document Text**: 
        "The final launch of Project Alpha occurred in December 2021. After beta testing, a feedback session was held in November 2021."

        **Output**: 
        "Key milestones in Project Alpha include:
        - Initial design phase completed in January 2021.
        - Beta testing started in August 2021.
        - Feedback session held in November 2021.
        - Final launch in December 2021."

        ---

        Use this structured approach for every batch of documents. Your response should evolve incrementally, always reflecting the most accurate and comprehensive information.
        """
        prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
        prompt = prompt_template.format(user_query=query, partial_response=partial_response,
                                        document_text=document_text)
        model = ChatOpenAI(temperature=0.0, api_key=OPENAI_API_KEY, model=OPENAI_CHAT_COMPLETION_MODEL)
        response = model.invoke(prompt).content
        return response

    def generate_final_response(self, query: str, partial_responses: str) -> str:
        PROMPT_TEMPLATE = """
        You are an expert assistant tasked with synthesizing information from multiple partial responses to provide a seamless, comprehensive, and accurate answer to a user's query. Your objective is to integrate all the information from the partial responses into a single, well-structured response.

        **Guidelines**:
        1. Use the **user query** to determine the scope and focus of your final answer.
        2. Combine and organize the information from the **partial responses** to create a clear, concise, and coherent answer. Eliminate redundancy or conflicting information.
        3. Ensure the final response addresses the user query in its entirety, covering all relevant points extracted from the partial responses.
        4. Use professional and consistent formatting for the final response.
        5. If there are gaps in the information provided by the partial responses, explicitly state this in the final response.

        **Input**:
        - **User Query**: {user_query}
        - **Partial Responses**: {partial_responses}

        **Output**:
        Provide a single, complete answer to the user query using the information from the partial responses.

        ---

        **Example**:
        **User Query**: "What are the key milestones in Project Alpha?"

        **Partial Responses**:
        1. "Key milestones in Project Alpha include:
           - Initial design phase completed in January 2021.
           - Beta testing started in August 2021."
        2. "Additional milestones:
           - Feedback session held in November 2021.
           - Final launch in December 2021."

        **Output**:
        "Key milestones in Project Alpha include:
        - Initial design phase completed in January 2021.
        - Beta testing started in August 2021.
        - Feedback session held in November 2021.
        - Final launch in December 2021."

        ---

        **Considerations**:
        - Prioritize clarity and relevance in the final response.
        - Ensure that the answer flows naturally, as if it were generated from a single source.
        - Do not include extraneous details or formatting from the partial responses unless they are directly relevant to the user query.
        """
        prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
        prompt = prompt_template.format(user_query=query, partial_responses=partial_responses)
        model = ChatOpenAI(temperature=0.0, api_key=OPENAI_API_KEY, model=OPENAI_CHAT_COMPLETION_MODEL)
        response = model.invoke(prompt).content
        return response

    # Retrieve relevant documents with recursive traversal algorithm
    def retrieve_relevant_documents_advanced(self, query: str, min_final_docs: int = 5, max_depth: int = 3,
                                             seed_docs: int = 5) -> List[dict]:
        # Step 1: Generate Cypher query condition from LLM based on user query
        query_embedding = self.calculate_embedding(text=query)

        # Step 2: Get initial seed documents based on embedding similarity
        seed_documents = self.retrieve_similar_documents(query, top_n=seed_docs)  # Increase initial seeds
        seed_document_ids = [doc["id"] for doc in seed_documents]
        final_documents = []
        checked_documents_id = set()  # Use a set for faster lookups

        # Helper function to calculate cosine similarity between two embeddings
        def calculate_cosine_similarity(embedding1, embedding2):
            return cosine_similarity([embedding1], [embedding2])[0][0]

        # Recursive traversal function leveraging node embeddings
        def traverse_documents(document_ids: List[str], current_depth: int):
            if len(final_documents) >= min_final_docs or current_depth > max_depth:
                return

            print(f'Transversing graph: Level {current_depth} ...')

            with self.driver.session() as session:
                for doc_id in document_ids:
                    if len(final_documents) >= min_final_docs:
                        return

                    print('query_embedding: ', len(query_embedding))
                    print('doc_embedding: ', len(self.get_document_text_embedding(doc_id=doc_id)))

                    if calculate_cosine_similarity(query_embedding,
                                                   self.get_document_text_embedding(doc_id=doc_id)) <= 0.70:
                        continue

                    # Ensure that the doc_id check happens only after traversal is complete
                    if doc_id in checked_documents_id:
                        continue

                    # Step 1: Retrieve the embedding of the current document
                    current_doc_embedding = self.get_document_embedding(doc_id)

                    # Only mark the document as checked after traversal into it starts
                    checked_documents_id.add(doc_id)

                    document_details = self.get_document_details(doc_id)
                    document_entities = self.retrieve_entities_for_document(document_id=doc_id)

                    if self.evaluate_relevance(query, document_details['text'],
                                               entities=document_entities) == 'RELEVANT':
                        final_documents.append(document_details)
                        print("Exact Match found!")
                        print("\n")
                    else:
                        print("No matches found :(")

                    # Step 3: Expand to entities if condition is not met
                    result = session.run(
                        """
                        MATCH (doc:Document {id: $doc_id})-[:CONTAINS]->(entity)
                        RETURN labels(entity)[0] AS entity_label, entity.name AS entity_name
                        """,
                        doc_id=doc_id
                    )
                    entities = [{"label": record["entity_label"], "name": record["entity_name"]} for record in result]

                    # Step 4: For each entity with label and name, expand to connected documents
                    for entity in entities:
                        result = session.run(
                            """
                            MATCH (relatedDoc:Document)-[:CONTAINS]->(relatedEntity)
                            WHERE $entity_label IN labels(relatedEntity)
                            AND (relatedEntity.name = $entity_name OR $entity_name IS NULL)
                            RETURN DISTINCT relatedDoc.id AS related_doc_id
                            """,
                            entity_label=entity["label"],
                            entity_name=entity.get("name", ""),
                            doc_id=doc_id
                        )
                        related_doc_ids = [record["related_doc_id"] for record in result]

                        # Step 5: Rank related documents by embedding similarity
                        related_doc_embeddings = []
                        for related_doc_id in related_doc_ids:
                            embedding = self.get_document_embedding(related_doc_id)
                            similarity = calculate_cosine_similarity(current_doc_embedding, embedding)
                            related_doc_embeddings.append((related_doc_id, similarity))

                        # Step 6: Sort related documents by similarity (descending)
                        related_doc_embeddings.sort(key=lambda x: x[1], reverse=True)

                        # Step 7: Select the top N most similar documents (you can adjust this number)
                        top_related_docs = [doc_id for doc_id, _ in related_doc_embeddings[:5]]  # Example: top 5

                        # Step 8: Recursively traverse the top N most similar documents
                        if top_related_docs:
                            traverse_documents(top_related_docs, current_depth + 1)  # Recursive call

        # Begin traversal
        traverse_documents(seed_document_ids, 0)
        return final_documents


# Define a simple class to hold pipeline node information.
class PipelineNode:
    def __init__(self, slug, node_type, properties):
        self.slug = slug
        self.node_type = node_type
        self.properties = properties
        self.children = []  # Outgoing edges: nodes that depend on this node.
        self.parents = []  # Incoming edges: nodes that feed into this node.

    def __repr__(self):
        return f"PipelineNode({self.slug}, {self.node_type})"


# Dummy processing functions for different node types.
def process_loader(properties, input_data, mode=None):
    slug = properties.get("slug")
    print(f"--> [Loader] Processing {slug} with input: {input_data}")
    # Load Documents
    documents = json.loads(properties.get('selectedDocuments'))
    documents = [DocumentFile.objects.get(pk=document['id']) for document in documents]
    graph = Neo4jGraph()
    for document in documents:
        elements = DocumentLoader(document=document).load()
        documents, relationship_types = KnowledgeGenerator(elements=elements).generate_knowledge()
        for document_x in documents:
            try:
                graph.insert_document(document=document_x, slug=slug)
            except Exception as e:
                print(e)
                continue
        graph.update_node2vec_embeddings(relationship_types=relationship_types)
    return slug


def process_chat_agent(properties, input_data, mode=None):
    slug = properties.get("slug")
    print(f"--> [ChatAgent] Processing {slug} with input: {input_data}")
    # Simulate processing via an AI chat agent.
    graph = Neo4jGraph()

    if mode == "RAG":
        # Retrieve relevant documents when in RAG mode.
        similar_docs = graph.retrieve_relevant_documents_advanced(
            query=properties.get('prompt'),
            max_depth=2,
            seed_docs=4,
            min_final_docs=4
        )
        responses = ['']
        for doc in similar_docs:
            responses.append(
                graph.generate_response(
                    query=properties.get('prompt'),
                    partial_response=responses[-1],
                    document_text=doc['text']
                )
            )
        complete_response = graph.generate_final_response(
            query=properties.get('prompt'),
            partial_responses=responses[-1]
        )
        print("RAG response:", complete_response)
        graph.close()
        return f"chat_response_from_{slug} (RAG)"
    else:
        # Standalone mode: use the stored 'context' property.
        context = properties.get('context')
        # Here you could call your LLM with the context; we'll simulate it.
        response = f"chat_response_from_{slug} (standalone, context: {context})"
        print("Standalone response:", response)
        graph.close()
        return response


def process_generic(properties, input_data, mode=None):
    slug = properties.get("slug")
    print(f"--> [Generic] Processing {slug} with input: {input_data}")
    return f"processed_{slug}"


# Map node types to processing functions.
PROCESSORS = {
    "documentLoader": process_loader,
    "askAI": process_chat_agent,
    # Other node types can be added here.
}


class Neo4jNodes:
    def __init__(self):
        self.driver = get_driver()

    def close(self):
        self.driver.close()

    # Delete all nodes and relationships
    def delete_all_data(self):
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
        self.close()

    def query(self, cypher_query, parameters=None):
        with self.driver.session() as session:
            return session.run(cypher_query, parameters or {})

    def upsert_node(self, slug: str, data: dict, user_id: str):
        """
        Upsert a node based on the provided data.
        The node is uniquely identified by 'slug'. All fields in data are applied.
        If 'documents' or 'selectedDocuments' are present, they are converted to JSON strings.
        A dynamic label is added based on the value of data["type"] (if provided).

        :param slug: The unique identifier of the node.
        :param data: A dictionary containing the node's properties.
        :param user_id: User identifier.
        :return: The internal Neo4j node id.
        """

        # Convert 'documents' if present.
        if 'documents' in data:
            # Ensure documents is a list, then dump to JSON.
            if not isinstance(data['documents'], list):
                data['documents'] = [data['documents']]
            data['documents'] = json.dumps(data['documents'])

        # Convert 'selectedDocuments' if present.
        if 'selectedDocuments' in data:
            # Ensure selectedDocuments is a list, then dump to JSON.
            if not isinstance(data['selectedDocuments'], list):
                data['selectedDocuments'] = [data['selectedDocuments']]
            data['selectedDocuments'] = json.dumps(data['selectedDocuments'])

        # Set the user id.
        data['user_id'] = user_id

        # Use the type from data if available; otherwise default to "Node".
        node_type = data.get("type", "Node")

        with self.driver.session() as session:
            result = session.run(
                """
                MERGE (n:Node:Agent {slug: $slug})
                ON CREATE SET n += $data
                ON MATCH SET n += $data
                WITH n
                CALL apoc.create.addLabels(n, [$node_type]) YIELD node
                RETURN id(node) AS node_id
                """,
                slug=slug,
                data=data,
                node_type=node_type
            )
            return result.single()["node_id"]

    def create_edge(self, slug, source_id, target_id, user_id):
        with self.driver.session() as session:
            print(f"Creating edge: {slug}, {source_id} -> {target_id}, user_id: {user_id}")
            result = session.run(
                "MATCH (a:Node {slug: $source_id}), (b:Node {slug: $target_id}) "
                "WHERE a.user_id = $user_id AND b.user_id = $user_id "
                "CREATE (a)-[r:CONNECTED {slug: $slug, user_id: $user_id}]->(b) RETURN id(r)",
                source_id=source_id, target_id=target_id, user_id=user_id, slug=slug
            )
            return result.single()[0]

    def delete_node(self, slug: str) -> None:
        with self.driver.session() as session:
            session.run(
                "MATCH (n:Node {slug: $slug}) DETACH DELETE n",
                slug=slug
            )

    def get_nodes_by_user(self, user_id):
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (n:Node:Agent)
                WHERE n.user_id = $user_id
                RETURN id(n) AS id, n.slug AS slug,
                CASE 
                  WHEN "documentLoader" IN labels(n) THEN {
                      type: n.type,
                      label: n.label,
                      canvasId: n.canvasId,
                      position_x: n.position_x,
                      position_y: n.position_y,
                      imageModel: n.imageModel,
                      temperature: n.temperature,
                      extractImages: n.extractImages,
                      documents: n.documents,
                      selectedDocuments: n.selectedDocuments
                  }
                  WHEN "askAI" IN labels(n) THEN {
                      type: n.type,
                      label: n.label,
                      canvasId: n.canvasId,
                      temperature: n.temperature,
                      position_x: n.position_x,
                      position_y: n.position_y,
                      aiModel: n.aiModel,
                      prompt: n.prompt,
                      context: n.context
                  }
                  ELSE {
                      type: n.type,
                      label: n.label,
                      canvasId: n.canvasId,
                      position_x: n.position_x,
                      position_y: n.position_y
                  }
                END AS data
                """,
                user_id=user_id
            )
            nodes = []
            for record in result:
                # The "data" map now contains only the relevant fields
                data = record["data"]

                # If the documents property exists and is a JSON string, decode it.
                if data.get("documents"):
                    try:
                        data["documents"] = json.loads(data["documents"])
                    except Exception as e:
                        print(f"Error decoding documents: {e}")
                        data["documents"] = []
                else:
                    data["documents"] = []

                if data.get("selectedDocuments"):
                    try:
                        data["selectedDocuments"] = json.loads(data["selectedDocuments"])
                    except Exception as e:
                        print(f"Error decoding selectedDocuments: {e}")
                        data["selectedDocuments"] = []
                else:
                    data["selectedDocuments"] = []

                # Optionally, you can merge the id and slug into the data or keep them separate.
                node = {
                    "id": record["id"],
                    "slug": record["slug"],
                    **data
                }
                nodes.append(node)
            return nodes

    def get_all_edges(self, user_id):
        with self.driver.session() as session:
            result = session.run(
                "MATCH (a:Node)-[r:CONNECTED]->(b:Node) RETURN a.slug AS source_id, b.slug AS target_id, r.slug AS slug"
            )
            return [record.data() for record in result]

    def get_root_nodes(self, canvas_id):
        query = """
        MATCH (n:Node)
        WHERE NOT (n)<-[:CONNECTED_TO]-() AND n.canvas_id = $canvas_id
        RETURN id(n) AS node_id, n.label AS label
        """
        return self.query(query, {"canvas_id": canvas_id}).data()

    def get_execution_order(self, canvas_id):
        query = """
        MATCH path = (n:Node)-[:CONNECTED_TO*]->(m:Node)
        WHERE n.canvas_id = $canvas_id
        WITH collect(path) AS paths
        RETURN paths
        """
        return self.query(query, {"canvas_id": canvas_id}).data()

    def process_pipeline(self, canvas_id):
        with self.driver.session() as session:
            # Retrieve all nodes with the label "Node" and explicitly get their labels.
            nodes_result = session.run("MATCH (n:Node:Agent) RETURN n, labels(n) AS node_labels")
            nodes_data = nodes_result.data()

            # Build a dictionary mapping slug to PipelineNode.
            nodes_dict = {}
            for record in nodes_data:
                n = record["n"]
                slug = n.get("slug")
                # Determine node type: if the node has a property "type", use it;
                # otherwise, check the returned node_labels (ignoring the generic "Node" label).
                node_type = n.get("type", "Node")
                for label in record["node_labels"]:
                    if label != "Node":
                        node_type = label
                        break
                # Create our in-memory node.
                nodes_dict[slug] = PipelineNode(slug, node_type, dict(n))

            # --- STEP 2: Extract Edges ---
        with self.driver.session() as session:
            # Retrieve relationships with source and target slugs.
            edges_result = session.run(
                "MATCH (a:Node)-[r:CONNECTED]->(b:Node) RETURN a.slug AS source, b.slug AS target"
            )
            edges_data = edges_result.data()

            # Build the graph: link source nodes to target nodes.
            for record in edges_data:
                source_slug = record["source"]
                target_slug = record["target"]
                if source_slug in nodes_dict and target_slug in nodes_dict:
                    source_node = nodes_dict[source_slug]
                    target_node = nodes_dict[target_slug]
                    source_node.children.append(target_node)
                    target_node.parents.append(source_node)

        # --- STEP 3: Determine Execution Order via Topological Sorting ---
        # Compute in-degree for each node.
        in_degree = {slug: len(node.parents) for slug, node in nodes_dict.items()}
        # Starting nodes: nodes with no incoming edges.
        start_nodes = [node for slug, node in nodes_dict.items() if in_degree[slug] == 0]

        if not start_nodes:
            print("No starting nodes found – the graph may contain cycles!")
            return

        sorted_nodes = []
        queue = start_nodes[:]

        while queue:
            current = queue.pop(0)
            sorted_nodes.append(current)
            for child in current.children:
                in_degree[child.slug] -= 1
                if in_degree[child.slug] == 0:
                    queue.append(child)

        # Check if all nodes were sorted; if not, there is a cycle.
        if len(sorted_nodes) != len(nodes_dict):
            print("Warning: Cycle detected in the graph. "
                  "Topological sort is incomplete, and additional cycle handling is needed.")

        # --- STEP 4: Execute the Pipeline ---
        # A dictionary to hold each node's output.
        node_outputs = {}

        # Process nodes in the computed topological order.
        for node in sorted_nodes:
            # Gather inputs from all parent nodes.
            if not node.parents:
                input_data = None  # Could be replaced with an initial input value.
            else:
                parent_outputs = [node_outputs[parent.slug] for parent in node.parents if parent.slug in node_outputs]
                input_data = parent_outputs[0] if len(parent_outputs) == 1 else parent_outputs

            # For ChatAgent nodes (mapped to "askAI"), decide the mode based on parent types.
            mode = None
            if node.node_type == "askAI":
                # If any parent is a Loader agent (i.e., type "documentLoader"), switch to RAG mode.
                mode = "RAG" if any(parent.node_type == "documentLoader" for parent in node.parents) else "standalone"

            processor = PROCESSORS.get(node.node_type, process_generic)
            print(f"Executing node {node.slug} of type {node.node_type} with mode: {mode}")
            # Call the processor, passing the mode parameter.
            output = processor(node.properties, input_data, mode=mode)
            node_outputs[node.slug] = output

        # --- STEP 5: Final Output ---
        print("\nPipeline execution completed. Final outputs by node:")
        for slug, output in node_outputs.items():
            print(f" - {slug}: {output}")
