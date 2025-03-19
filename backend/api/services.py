import json
import os
from collections import deque
from openai import OpenAI

from pydantic import BaseModel

from .helpers import DocumentLoader, KnowledgeGenerator, Neo4jGraph
from .models import Agent


class ChatTriggerEvent(BaseModel):
    output: str


class ChatEvent(BaseModel):
    output: str


client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))


class DocumentProcessService:

    @staticmethod
    def process_document(document):
        try:
            elements = DocumentLoader(document=document).load()
            documents, relationship_types = KnowledgeGenerator(elements=elements).generate_knowledge()

            graph = Neo4jGraph()

            for document in documents:
                try:
                    graph.insert_document(document=document)
                except Exception as e:
                    print(e)
                    continue

            graph.update_node2vec_embeddings(relationship_types=relationship_types)
        except Exception as e:
            print(e)

        return document


class ChatService:

    @staticmethod
    def generate_response(chat):
        graph = Neo4jGraph()

        similar_docs = graph.retrieve_relevant_documents_advanced(
            query=chat.input,
            max_depth=2,
            seed_docs=4,
            min_final_docs=4)

        graph.close()

        responses = ['']
        for doc in similar_docs:
            responses.append(
                graph.generate_response(
                    query=chat.input,
                    partial_response=responses[-1],
                    document_text=doc['text']
                )
            )

        complete_response = graph.generate_final_response(
            query=chat.input,
            partial_responses=responses[-1]
        )

        print(complete_response)

        chat.output = complete_response
        chat.save()

        return chat

    @staticmethod
    def execute_workflow(chat):
        workflow = chat.workflow
        chat_trigger_node = Agent.objects.filter(workflow=workflow, type='chatTrigger').first()
        initial_input = ChatTriggerEvent(output=chat.input)

        def process_node(current_agent, agent_input, visited):
            """
            Process the current agent and recursively traverse its next_agents.
            Avoid cycles using the visited set. Returns a list of final outputs.
            """
            # Process the current agent if needed

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
        return outputs

# class CanvasService:
#
#     def get_root_nodes(self, canvas):
#         """
#         Returns all nodes in a canvas that have no incoming edges.
#         """
#         nodes_with_incoming_edges = Edge.objects.filter(canvas=canvas).values_list('target', flat=True)
#         return Node.objects.filter(canvas=canvas).exclude(id__in=nodes_with_incoming_edges)
#
#
#     def process_pipeline(self, canvas):
#         """
#         Processes the pipeline from root nodes to the last nodes.
#         """
#         # Step 1: Find all root nodes
#         roots = self.get_root_nodes(canvas)
#
#         # Step 2: Prepare a queue (BFS-like traversal)
#         queue = deque(roots)
#         processed = set()
#
#         while queue:
#             node = queue.popleft()
#             if node.id in processed:
#                 continue
#
#             print(f"Processing Node: {node.label} ({node.type})")
#             self.process_node(node)  # Custom processing logic for each type
#
#             processed.add(node.id)
#
#             # Step 3: Add outgoing connected nodes
#             for edge in node.outgoing_edges.all():
#                 queue.append(edge.target)
#
#     def process_node(self, node):
#         """
#         Performs node-type specific processing.
#         """
#         if node.type == 'documentLoader':
#             print(f"Loading document: {node.data.get('file_path', 'No file')}")
#         elif node.type == 'textUpdater':
#             print(f"Updating text: {node.data.get('transformation', 'No transformation')}")
#         elif node.type == 'askAI':
#             print(f"Asking AI: {node.data.get('prompt', 'No prompt')}")
