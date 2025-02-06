from collections import deque

from .helpers import DocumentLoader, KnowledgeGenerator, Neo4jGraph


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








