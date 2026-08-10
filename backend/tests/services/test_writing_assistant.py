from unittest.mock import AsyncMock, patch

import pytest

from services.writing_assistant import WritingAssistantService


@pytest.mark.anyio
async def test_search_sources_combines_short_final_sentence_with_previous_sentence():
    service = WritingAssistantService()

    mock_provider = AsyncMock()
    mock_provider.simple_search.return_value = [
        {
            "title": "Test Source",
            "url": "https://example.com",
            "text": "Relevant information",
            "author": "Test Author",
            "publishedDate": "2026-01-01",
            "score": 0.9,
        }
    ]

    with patch(
        "services.blog_writer.research.exa_provider.ExaResearchProvider",
        return_value=mock_provider,
    ):
        await service._search_sources(
            "Python is widely used for backend development. AI."
        )

    mock_provider.simple_search.assert_awaited_once_with(
        query="Python is widely used for backend development. AI.",
        num_results=3,
        user_id=None,
    )