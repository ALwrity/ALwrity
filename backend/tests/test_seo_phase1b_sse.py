"""Phase 1B TDD — analyze-with-progress must return StreamingResponse (SSE).

Leaves content-strategy / calendar untouched. Reuses conftest stubs.
"""
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.responses import StreamingResponse


def _make_request():
    import api.blog_writer.seo_analysis as mod

    return mod.SEOAnalysisRequest(
        blog_content="Hello world content for SEO testing. " * 20,
        blog_title="Test",
        research_data={"keywords": ["test"]},
    )


async def _call_endpoint():
    import api.blog_writer.seo_analysis as mod

    req = _make_request()
    fake_db = MagicMock()
    with (
        __import__("unittest.mock", fromlist=["patch"]).patch.object(
            mod.seo_analyzer,
            "analyze_blog_content",
            new=AsyncMock(return_value={"overall_score": 80}),
        ),
    ):
        return await mod.analyze_blog_seo_with_progress(
            req, {"id": "u1"}, fake_db
        )


def test_analyze_with_progress_returns_streaming_response():
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(_call_endpoint()) \
        if False else __import__("asyncio").run(_call_endpoint())
    assert isinstance(result, StreamingResponse), (
        f"must return StreamingResponse, got {type(result).__name__} (bare generator breaks SSE)"
    )
    assert result.media_type == "text/event-stream"


def test_analyze_with_progress_streams_chunks():
    import asyncio

    async def _collect():
        result = await _call_endpoint()
        assert isinstance(result, StreamingResponse)
        chunks = []
        async for chunk in result.body_iterator:
            if isinstance(chunk, str):
                chunk = chunk.encode()
            chunks.append(chunk)
            if len(chunks) >= 3:
                break
        return chunks

    chunks = asyncio.run(_collect())
    assert len(chunks) >= 3, f"expected >=3 SSE chunks, got {len(chunks)}"
    assert all(len(c) > 0 for c in chunks)
