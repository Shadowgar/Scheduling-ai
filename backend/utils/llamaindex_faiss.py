"""
LlamaIndex + FAISS integration module.

Implements:
- Initializing and managing the FAISS index
- Ingesting and chunking policy documents
- Embedding text using Ollama
- Performing vector search over policy chunks

Dependencies: llama-index, faiss-cpu, unstructured, requests
"""

from typing import List, Dict, Any, Optional
import faiss
import numpy as np
import requests
from config import Config
from unstructured.partition.text import partition_text

import json
import os

# In-memory FAISS index and chunk metadata store
_faiss_index = None
_chunk_metadata: List[Dict[str, Any]] = []
_embedding_dim = 768  # Default for nomic-embed-text

_FAISS_INDEX_PATH = "faiss_index.bin"
_FAISS_META_PATH = "faiss_metadata.json"

def initialize_faiss_index(index_path: Optional[str] = None, meta_path: Optional[str] = None):
    """
    Initialize or load the FAISS index and metadata.

    Args:
        index_path (str, optional): Path to load/save the FAISS index.
        meta_path (str, optional): Path to load/save the chunk metadata.

    Returns:
        faiss.Index: The FAISS index object.
    """
    global _faiss_index, _chunk_metadata
    idx_path = index_path or _FAISS_INDEX_PATH
    m_path = meta_path or _FAISS_META_PATH
    if os.path.exists(idx_path) and os.path.exists(m_path):
        try:
            _faiss_index = faiss.read_index(idx_path)
            with open(m_path, "r", encoding="utf-8") as f:
                _chunk_metadata = json.load(f)
        except Exception:
            _faiss_index = faiss.IndexFlatL2(_embedding_dim)
            _chunk_metadata = []
    else:
        _faiss_index = faiss.IndexFlatL2(_embedding_dim)
        _chunk_metadata = []
    return _faiss_index

def save_faiss_index(index_path: Optional[str] = None, meta_path: Optional[str] = None):
    """
    Save the FAISS index and chunk metadata to disk.

    Args:
        index_path (str, optional): Path to save the FAISS index.
        meta_path (str, optional): Path to save the chunk metadata.
    """
    global _faiss_index, _chunk_metadata
    idx_path = index_path or _FAISS_INDEX_PATH
    m_path = meta_path or _FAISS_META_PATH
    if _faiss_index is not None:
        faiss.write_index(_faiss_index, idx_path)
    with open(m_path, "w", encoding="utf-8") as f:
        json.dump(_chunk_metadata, f, ensure_ascii=False, indent=2)

def _embed_text_ollama(text: str) -> List[float]:
    """
    Generate embedding for a text chunk using Ollama's /api/embed endpoint.
    """
    try:
        response = requests.post(
            f"{Config.OLLAMA_API_URL}/embed",
            json={"model": "nomic-embed-text", "input": text},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        # Ollama returns "embeddings": [[...]] for single input
        if "embeddings" not in data or not data["embeddings"]:
            print(f"Ollama embedding API response missing 'embeddings': {data}")
            return [0.0] * _embedding_dim
        return data["embeddings"][0]
    except Exception as e:
        print(f"Ollama embedding error: {e}")
        try:
            print("Ollama response text:", response.text)
        except Exception:
            pass
        return [0.0] * _embedding_dim

def ingest_policy_document(document_id: int, text: str) -> List[Dict[str, Any]]:
    """
    Ingest and chunk a policy document, embed each chunk, and add to FAISS index.

    Args:
        document_id (int): The database ID of the policy document.
        text (str): The full extracted text of the document.

    Returns:
        List[Dict]: List of chunk metadata (e.g., chunk_id, embedding, text).
    """
    global _faiss_index, _chunk_metadata

    if _faiss_index is None:
        initialize_faiss_index()

    # Chunk the document using unstructured (simple paragraph split fallback)
    try:
        chunks = [el.text for el in partition_text(text) if el.text.strip()]
    except Exception:
        # Fallback: split by double newline
        chunks = [p.strip() for p in text.split('\n\n') if p.strip()]

    new_metadata = []
    vectors = []
    for idx, chunk_text in enumerate(chunks):
        embedding = _embed_text_ollama(chunk_text)
        vectors.append(embedding)
        chunk_info = {
            "chunk_id": len(_chunk_metadata) + idx,
            "document_id": document_id,
            "text": chunk_text,
            "embedding": embedding,
        }
        new_metadata.append(chunk_info)

    if vectors:
        arr = np.array(vectors).astype("float32")
        _faiss_index.add(arr)
        _chunk_metadata.extend(new_metadata)
        save_faiss_index()  # Persist after ingestion

    return new_metadata

def search_policy_chunks(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Perform a vector search over policy chunks using LlamaIndex + FAISS.

    Args:
        query (str): The search query text.
        top_k (int): Number of top results to return.

    Returns:
        List[Dict]: List of matching chunk metadata (e.g., chunk_id, score, text).
    """
    global _faiss_index, _chunk_metadata

    if _faiss_index is None or _faiss_index.ntotal == 0:
        return []

    query_emb = _embed_text_ollama(query)
    arr = np.array([query_emb]).astype("float32")
    D, I = _faiss_index.search(arr, top_k)
    results = []
    for idx, score in zip(I[0], D[0]):
        if 0 <= idx < len(_chunk_metadata):
            meta = _chunk_metadata[idx].copy()
            meta["score"] = float(score)
            results.append(meta)
    return results

# Ensure FAISS index and metadata are loaded on import
initialize_faiss_index()
