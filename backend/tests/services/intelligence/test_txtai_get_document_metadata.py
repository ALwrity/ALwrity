"""TxtaiIntelligenceService.get_document_metadata — Phase 2 unit tests.

The Brand Brain semantic search reads ``metadata.type`` for onboarding docs
via the real ``get_document_metadata``; the search API tests stub the service,
so this file pins the actual implementation against a fake embeddings object
that returns the ``(id, text, object)`` tuple shape used by txtai with
``objects: True``.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.intelligence.txtai_service import TxtaiIntelligenceService  # noqa: E402


class _FakeEmbeddings:
    def __init__(self, stored):
        self.stored = stored

    def get(self, doc_id):
        return self.stored.get(str(doc_id))


def _make_service(stored):
    svc = TxtaiIntelligenceService("99")
    svc._initialized = True
    svc.embeddings = _FakeEmbeddings(stored)
    return svc


class TestGetDocumentMetadata:
    def test_returns_metadata_from_object_element(self):
        svc = _make_service({
            "wa_1": ("wa_1", "Website analysis detail", '{"type": "website_analysis", "url": "x"}'),
        })
        assert svc.get_document_metadata("wa_1") == '{"type": "website_analysis", "url": "x"}'

    def test_returns_none_when_no_object_element(self):
        svc = _make_service({"bare": ("bare", "some text")})
        assert svc.get_document_metadata("bare") is None

    def test_returns_none_when_uninitialized(self):
        svc = TxtaiIntelligenceService("99")
        svc._initialized = False
        assert svc.get_document_metadata("wa_1") is None

    def test_returns_none_when_missing_doc(self):
        svc = _make_service({})
        assert svc.get_document_metadata("missing") is None

    def test_dict_doc_reads_object_key(self):
        svc = _make_service({
            "doc": {"id": "doc", "text": "t", "object": {"type": "persona"}},
        })
        assert svc.get_document_metadata("doc") == {"type": "persona"}

    def test_never_raises_on_get_failure(self):
        class _Boom:
            def get(self, doc_id):
                raise RuntimeError("index corrupt")

        svc = TxtaiIntelligenceService("99")
        svc._initialized = True
        svc.embeddings = _Boom()
        assert svc.get_document_metadata("x") is None