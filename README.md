# document-search

document-search is a Retrieval Augmented Generation (RAG) platform that leverages agentic AI to retrieve and generate highly relevant responses from your documents. By combining advanced document parsing, smart chunking strategies, vector embeddings, and real-time communication, document-search delivers an interactive and intuitive experience for both casual users and professionals.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technical Implementation](#technical-implementation)
  - [Document Ingestion & Parsing](#document-ingestion--parsing)
  - [Smart Chunking & Metadata Extraction](#smart-chunking--metadata-extraction)
  - [Vector Embedding & Storage](#vector-embedding--storage)
  - [Query Recontextualization & Retrieval](#query-recontextualization--retrieval)
  - [Chat-based Interaction](#chat-based-interaction)
- [Infrastructure](#infrastructure)
  - [Backend](#backend)
  - [Frontend](#frontend)
  - [Additional Technologies](#additional-technologies)
- [Deployment](#deployment)
- [Getting Started](#getting-started)
- [Contributing](#contributing)
- [License](#license)

## Overview

document-search enables users to upload various document formats (PDF, DOCX, TXT, MD) and then leverages advanced AI techniques to process and retrieve contextually relevant information. Whether you need to extract insights from dense reports or answer questions based on a large set of documents, document-search is designed to streamline and enhance your document analysis workflows.

## Features

- **Multi-format Document Parsing:** Supports PDF, DOCX, TXT, and Markdown files.
- **Smart Chunking Strategy:** Utilizes both preliminary splitting techniques and a Recursive Character Text Splitter to ensure optimal segmentation and metadata preservation.
- **Vector-based Embedding:** Uses OpenAI's `text-embedding-ada-002` model to embed document chunks and store them in PostgreSQL (with pgvector extension) for efficient cosine similarity searches.
- **Conversational Query Handling:** Recontextualizes user queries using chat history and leverages OpenAI’s chat completion models (e.g., GPT-4) to generate context-aware responses.
- **Real-time Communication:** Implements WebSockets to provide a dynamic, real-time chat experience.
- **Robust Caching & Data Storage:** Integrates Redis for caching and PostgreSQL for a resilient database solution.
- **Workflow Automation:** Features a canvas-based workflow graphic that visualizes agent interactions, execution logs, and data flow.

## Technical Implementation

### Document Ingestion & Parsing

1. **File Upload & Loading:**  
   Users can upload documents in PDF, DOCX, TXT, and MD formats.  
   - **PDFs:** Loaded using `PyPDFLoader`.  
   - **DOCX:** Loaded via `DOCX2Text`.  
   - **TXT & MD:** Loaded using `TEXTLoader`.

### Smart Chunking & Metadata Extraction

2. **Chunking Strategy:**  
   - **Preliminary Splitting:** The system applies a smart chunking strategy that splits documents at natural boundaries like page ends and headers.
   - **Secondary Chunking:** Uses a Recursive Character Text Splitter that further divides text based on a predefined set of delimiters: `["\n\n", "\n", " ", ""]`.  
   - **Metadata Extraction:** Metadata such as page number, line number, and file name is extracted and stored to facilitate advanced filtering.

### Vector Embedding & Storage

3. **Embedding Process:**  
   - The chunked documents are embedded into a vector space using OpenAI's `text-embedding-ada-002`.  
   - This embedding process ensures that contextually similar texts are positioned closely in the vector space, enabling effective cosine similarity comparisons.
   - Embedding vectors are stored in PostgreSQL with the pgvector extension, ensuring a robust and scalable vector storage solution.

### Query Recontextualization & Retrieval

4. **Query Processing:**  
   - When a user poses a question, the chat agent utilizes OpenAI’s chat completion models (such as GPT-4) to recontextualize the query in light of the ongoing chat history.
5. **Document Retrieval:**  
   - The recontextualized query and chat history are used to search for similar document chunks in the vector database by calculating cosine similarity.
   - Although metadata filtering capabilities are planned, they are not yet implemented.

### Chat-based Interaction

6. **Response Generation:**  
   - The retrieved document context, combined with the recontextualized query and chat history, is fed back into the chat completion model.
   - This results in highly relevant and context-aware responses to the user’s original query.
   - The frontend presents this interaction through a sophisticated chat interface alongside a graphical workflow and detailed execution logs.

## Infrastructure

### Backend

The backend is developed using Django and Django REST Framework, providing a robust and scalable RESTful API. The major data models include:

- **Workflow:**  
  A canvas representing interconnected nodes (agents) and edges (node connections) that define the automated processing paths.  
  It supports multiple trigger types including document uploads, chat queries, and potential integrations like email or Slack (future work).

- **Node:**  
  The building blocks of the workflow, each node performs a specific function such as triggering workflows, executing chat completions with LLMs, or retrieving information.

- **NodeConnection:**  
  Manages the flow of data between nodes, ensuring efficient information relay throughout the workflow.

- **Document:**  
  Represents the individual chunks of uploaded documents, along with their associated metadata.

APIViews are available for full CRUD operations across these models, facilitating easy integration and extension.

### Frontend

The frontend is a modern React application written in TypeScript. It offers:
- A visually appealing chat interface for real-time user interaction.
- A dynamic workflow graphic that illustrates the flow of information between different processing nodes.
- Execution logs and status updates to keep users informed about the process.

### Additional Technologies

- **Redis:**  
  Used for caching to enhance performance and reduce load on the backend.
- **WebSockets:**  
  Facilitates real-time communication, ensuring that users receive immediate updates and responses.
- **PostgreSQL:**  
  Serves as the primary database, enhanced with the pgvector extension for efficient vector storage.
- **RESTful APIs:**  
  Provides structured and scalable endpoints for interacting with the backend services.
- **OpenAI Models:**  
  Utilizes OpenAI’s embedding and chat completion models to power the AI-driven aspects of the application.

## Deployment

document-search is containerized using Docker. The deployment process is streamlined with Docker Compose:
- **Local Deployment:**  
  Use `docker-compose up --build` to build the images and launch the entire stack locally.
- **Cloud Deployment:**  
  The application has been deployed on AWS EC2, ensuring scalability and robust performance in production environments.

## Getting Started

### Prerequisites

- Docker & Docker Compose installed on your machine.
- AWS account (if deploying on the cloud).
- Basic understanding of Django, React (TypeScript), and containerization concepts.

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/yourusername/document-search.git
   cd document-search