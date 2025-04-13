# Employee Scheduling Application

...

---

## Policy Document Management UI

...

---

## RAG & Policy Search Migration

- The backend has migrated from LightRAG and BGE/pgvector-based retrieval to a new **custom FAISS-powered approach** (see `backend/utils/llamaindex_faiss.py`).
- All LightRAG and BGE/pgvector code has been removed from the backend.
- The `/api/policies/search` endpoint now provides robust, persistent vector search using FAISS and Ollama embeddings.
- A new module, `backend/utils/llamaindex_faiss.py`, encapsulates all logic for FAISS index management, document ingestion, chunking, embedding (via Ollama), and vector search. The FAISS index and metadata are persisted to disk and loaded automatically on backend startup.
- **Note:** The `llama-index` Python package is NOT used in the backend. All vector search and chunking logic is implemented in the custom module.
- New backend dependencies: `faiss-cpu`, `unstructured`, and `pdfplumber` have been added to `backend/requirements.txt`.

---

## Technologies Used

- **Backend**:
  - Python, Flask, Flask-SQLAlchemy, Flask-Migrate, Flask-JWT-Extended, Flask-CORS
  - PostgreSQL
  - Alembic, Pydantic, Pytest
  - faiss-cpu, unstructured, pdfplumber  # Used for custom RAG integration
- **Frontend**:
  - React, React Router
  - Tailwind CSS
  - Fetch API
- **Containerization (Optional)**:
  - Docker, Docker Compose

---

## Setup Instructions

...

2.  **Backend Setup**:

```bash
    cd backend

    # Create and activate a Python virtual environment
    python -m venv venv
    # On Windows:
    .\venv\Scripts\activate
    # On macOS/Linux:
    # source venv/bin/activate

    # Install Python dependencies
    pip install -r requirements.txt
```

> **Note for Docker/Linux users:**
> The FAISS backend requires system libraries for vector search support.
> If building your own Docker image or running on Linux, ensure the following packages are installed **before** `pip install`:
> - `g++`
> - `libopenblas-dev`
> - `wget`
>
> The provided Dockerfile installs these automatically.

**Required backend dependencies:**  
- faiss-cpu  
- unstructured  
- pdfplumber  
- requests  
- (see requirements.txt for full list)

...
