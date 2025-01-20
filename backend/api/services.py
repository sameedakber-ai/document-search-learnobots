from .helpers import DocumentLoader, KnowledgeGenerator, Neo4jGraph

class DocumentProcessService:

    @staticmethod
    def process_document(document):
        try:
            elements = DocumentLoader(document=document).load()
            documents, relationship_types = KnowledgeGenerator(elements=elements).generate_knowledge()

            graph = Neo4jGraph()
            graph.delete_all_data()

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








