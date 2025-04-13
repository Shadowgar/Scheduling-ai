# LlamaIndex + FAISS Migration & Document Management

---

## Migration Status & Current Architecture (as of 2025-04-12)

**Status: COMPLETE (Backend, Database, & Core Frontend)**

- All LightRAG and BGE/pgvector code has been removed from the backend.
- The backend now uses a **custom FAISS integration module** (`backend/utils/llamaindex_faiss.py`), along with `faiss-cpu`, `unstructured`, and `requests` for robust document ingestion, chunking, embedding (via Ollama), and vector search.
- **Note:** The `llama-index` Python package is NOT used in the backend. All vector search and chunking logic is implemented in the custom module.
- The `/api/policies/search` endpoint provides vector search over policy chunks using FAISS and Ollama embeddings.
- The `backend/utils/llamaindex_faiss.py` module manages FAISS index initialization, persistence, document ingestion, chunking, embedding, and search.
- PolicyDocument tracks `chunk_count`, `status` ("Indexed", "Pending", "Error"), and `error_message` for robust error/status reporting.
- **Database migration for these fields is complete and schema is fully in sync.**
- Manual re-indexing is supported via `/api/policies/reindex`.
- Pytest unit tests cover ingestion, search, error handling, and reindexing.
- The frontend PolicyManager UI displays document status, chunk count, error messages, and provides a "Re-index All" button.

**Note:** The `.env` file for environment variables is located in the project root. Docker Compose has been updated to remove all references to lightrag/.env, resolving previous migration and environment issues. If you need to set environment variables for migrations or backend services, use the root .env file.

---

## Backend Implementation

### Database Migration & Environment

- Alembic migration for `chunk_count`, `status`, and `error_message` on `PolicyDocument` is complete. The database schema is now fully compatible with backend and frontend requirements.
- Docker Compose and environment variable loading have been fixed to use the root `.env` file only.

### Key Modules & Endpoints

- **`backend/utils/llamaindex_faiss.py`**
  - `initialize_faiss_index()`: Loads or creates the FAISS index and metadata.
  - `ingest_policy_document(document_id, text)`: Chunks, embeds, and adds a document to FAISS and metadata.
  - `search_policy_chunks(query, top_k)`: Embeds a query and returns top-k similar policy chunks.

- **API Endpoints (`backend/routes/policy.py`):**
  - `POST /api/policies/upload`: Upload TXT, PDF, or DOCX; extract, chunk, embed, and index.
  - `GET /api/policies/`: List all documents with metadata (name, type, upload date, status, chunk count, error).
  - `GET /api/policies/<id>/view`: Get extracted text.
  - `GET /api/policies/<id>/file`: Download original file.
  - `DELETE /api/policies/<id>`: Delete document and its chunks.
  - `POST /api/policies/search`: Vector search over policy chunks.
  - `POST /api/policies/reindex`: Re-index all documents (manual trigger).

- **Status/Error Handling:**
  - Each PolicyDocument tracks `status` ("Indexed", "Pending", "Error"), `chunk_count`, and `error_message`.
  - Errors in chunking, embedding, or FAISS ingestion are logged and reflected in the document's status and error_message.

- **Persistence:**
  - FAISS index and metadata are saved to disk and loaded on backend startup.
  - Re-indexing resets and rebuilds the FAISS index and all document chunks.

- **Testing:**
  - Pytest unit tests in `backend/tests/test_policy_vector_search.py` cover upload, search, error handling, and reindexing.

---

## Frontend Implementation

- **PolicyManager UI (`frontend/src/components/PolicyManager.js`):**
  - Uploads new documents.
  - Lists all documents with:
    - Filename, type, upload date
    - Status indicator ("Indexed", "Pending", "Error")
    - Chunk count
    - Error message (if any)
    - View/download/delete actions
  - "Re-index All" button triggers backend re-indexing and refreshes the list.
  - Visual cues for error/pending status.

- **Other Components:**
  - `PolicyFileViewer.js`: Displays original file.
  - `PolicyViewer.js`: Displays extracted text.

---

## Environment & Migration Notes

- **.env Location:** The `.env` file is in the project root. Use this for all environment variables (Flask, DB, etc.) for Docker and migration commands.
- **Docker:** All backend operations (including Alembic migrations) should be run inside the backend Docker container.
- **No virtualenv:** Do not use backend/new_venv/; all dependencies are managed via Docker and requirements.txt.

---

## Future Enhancements

- **Prompt Augmentation:** (Planned) Combine schedule and policy context for LLM queries.
- **Frontend Table/Grid:** (Planned) Add sorting, filtering, and chunk/extracted text views.
- **Advanced Error Handling:** (Planned) More granular error/status reporting and recovery options.

---

## Summary

The LlamaIndex + FAISS migration is complete for backend, database, and core document management UI. The system now supports robust, production-ready document ingestion, chunking, embedding, vector search, error/status tracking, and re-indexing, with a clear upgrade path for future enhancements. All environment and migration issues have been resolved.

---

**Dependencies Used:**
- `faiss-cpu`
- `unstructured`
- `pdfplumber`
- `requests`
- (Custom code in `llamaindex_faiss.py` for all vector search and chunking logic)
