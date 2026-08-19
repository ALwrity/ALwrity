"""
Standalone doc RAG service for ALwrity internal documentation.

Ingests repo docs into a hybrid FAISS+BM25 index partitioned by fictional
company tenants, and serves company-scoped search and RAG via FastAPI.

Run: ``python -m doc_rag`` from ``backend/``.
"""

__version__ = "0.1.0"
