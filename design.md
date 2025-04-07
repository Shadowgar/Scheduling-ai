# Scheduling AI System - Design Documentation

---

## Overview

This document details the architecture, components, and design decisions for upgrading the AI-powered scheduling system with a production-grade, open source Retrieval-Augmented Generation (RAG) pipeline using LightRAG, pgvector, and BGE embeddings.

---

## Goals

- Enable **fast, accurate, policy-aware AI scheduling**
- Use **fully open source, no-cost** technologies
- Support **scalable, maintainable** architecture
- Improve **policy compliance** and **explainability**

---

## Technologies

- **Vector Database:** pgvector (PostgreSQL extension)
- **Embedding Model:** BGE (`BAAI/bge-base-en`)
- **RAG Framework:** LightRAG (planned integration)
- **Backend:** Flask (Python)
- **Frontend:** React
- **AI Model:** Ollama (local LLMs)

---

## Architecture

### 1. **Policy Document Ingestion**

- Upload TXT, PDF, DOCX files
- Extract text and split into paragraph chunks
- Generate BGE embeddings for each chunk
- Store chunks and embeddings in PostgreSQL with pgvector

### 2. **Policy Vector Search API**

- Endpoint: `POST /api/policies/search`
- Input: query string, top_k
- Process:
  - Generate BGE embedding for query
  - Use pgvector cosine similarity to find top-k chunks
- Output: list of relevant policy chunks with scores

### 3. **AI Query Flow**

- User submits scheduling question
- Backend:
  - Retrieves relevant **schedule context** (existing)
  - Calls **Policy Vector Search API** to get policy context
  - Constructs augmented prompt with both contexts
- Sends prompt to Ollama LLM
- Returns policy-compliant AI response

### 4. **LightRAG Integration (Planned)**

- Replace manual vector search with LightRAG framework
- Support hybrid retrieval (vector + knowledge graph)
- Enable advanced features: citations, multi-turn, custom prompts

---

## Policy Vector Search API Design

- **Route:** `/api/policies/search`
- **Method:** POST
- **Request:**
```json
{
  "query": "What is the overtime policy for night shifts?",
  "top_k": 5
}
```
- **Response:**
```json
{
  "results": [
    {
      "chunk_id": 123,
      "document_id": 45,
      "score": 0.87,
      "text": "Overtime for night shifts is compensated at 1.5x regular rate..."
    },
    ...
  ]
}
```
- **Implementation:**
  - Embeds query with BGE
  - Uses pgvector `<#>` cosine distance
  - Orders by similarity, returns top-k

---

## Embedding Pipeline

- Uses HuggingFace `transformers` with `BAAI/bge-base-en`
- Embeds each paragraph chunk during upload
- Stores embedding as vector in pgvector column
- Enables fast, semantic search

---

## AI Prompt Augmentation

- Combines:
  - **Schedule context** (existing)
  - **Policy context** (from vector search)
- Constructs prompt:
```
=== Schedule Context ===
[schedule info]

=== Policy Context ===
[policy info]

User Question:
[question]

Answer:
```
- Ensures AI answers are **grounded in policies**

---

## Next Steps

- Expand LightRAG integration
- Add unit tests for vector search
- Optimize embedding and retrieval
- Document API endpoints and data models
- Continuously update this design doc

---

_Last updated: 2025-04-07_
