# LlamaIndex + FAISS Integration: Verification & Correction Plan

## 1. Findings

### a. Implementation Status
- The backend implements all required endpoints and logic for document ingestion, chunking, embedding (via Ollama), and vector search using FAISS.
- The core logic is in `backend/utils/llamaindex_faiss.py`.
- All required API endpoints are present in `backend/routes/policy.py`.
- Unit tests for upload, search, error handling, and reindexing exist in `backend/tests/test_policy_vector_search.py`.

### b. Dependency Issues
- `faiss-cpu`, `pdfplumber`, and `requests` are present in `requirements.txt`.
- The `unstructured` package is required (imported in `llamaindex_faiss.py`) but missing from `requirements.txt`. This will cause runtime errors.
- The backend does NOT use the `llama-index` Python package, despite documentation references. All logic is custom.

### c. Documentation/Code Mismatch
- Documentation and task tracking refer to "LlamaIndex" as if the `llama-index` package is used, but the code only uses a custom module named `llamaindex_faiss.py`.
- This could cause confusion for future maintainers or when troubleshooting errors.

---

## 2. Proposed Actions

### a. Fix Dependency Issues
- Add `unstructured` to `backend/requirements.txt` to resolve import errors.

### b. Update Documentation
- Update `LLamaIndex.md` and/or code comments to clarify that the backend uses a custom FAISS integration module (`llamaindex_faiss.py`), not the `llama-index` Python package.
- Remove or reword any statements that imply the `llama-index` package is used.
- Add a note about the actual dependencies and architecture.

- Update `README.md`:
  - In the backend setup/instructions section, clarify the use of the custom FAISS integration and list all required dependencies, including `unstructured`.

### c. (Optional) Rename Module for Clarity
- Rename `backend/utils/llamaindex_faiss.py` → `backend/utils/faiss_vector_search.py`
- Update all imports in the codebase from `llamaindex_faiss` to `faiss_vector_search`.

### d. Verify All Other Dependencies
- Double-check that `faiss-cpu`, `pdfplumber`, and `requests` are present and up to date in `requirements.txt`.

### e. (Optional) Add/Update Tests
- Ensure that unit tests exist for error cases related to missing dependencies.

---

## 3. Mermaid Diagram: Updated Backend Document Flow

```mermaid
flowchart TD
    A[Upload Document (TXT, PDF, DOCX)] --> B[Extract Text (pdfplumber/unstructured)]
    B --> C[Chunk Text]
    C --> D[Embed Chunks (Ollama API)]
    D --> E[Store Embeddings in FAISS]
    E --> F[Persist FAISS Index to Disk]
    F --> G[Vector Search API]
    G --> H[Return Top-K Policy Chunks]
```

---

## 4. Next Steps

- Add `unstructured` to `backend/requirements.txt`.
- Update documentation as described.
- (Optional) Rename the module and update imports.
- Verify all other dependencies.
- (Optional) Add or update tests for dependency errors.