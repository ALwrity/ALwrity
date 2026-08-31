"""Trend provider abstraction and shared models.

Future-proof interface so trend surfacing can switch providers (Tavily today,
Exa or another provider later) without touching consumers.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class TrendPlatform(str, Enum):
    """Platform/vertical for trend discovery (maps from the legacy pytrends ``gprop``)."""

    WEB = "web"
    YOUTUBE = "youtube"
    PODCAST = "podcast"
    NEWS = "news"
    IMAGES = "images"
    SHOPPING = "shopping"


@dataclass
class TrendItem:
    """A single surfaced trend/signal."""

    topic: str
    title: str = ""
    url: str = ""
    domain: str = ""
    published_date: Optional[str] = None
    score: float = 0.0
    snippet: str = ""
    platform: str = TrendPlatform.WEB.value
    source: str = "tavily"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TrendReport:
    """Aggregated trend results returned by a provider.

    Kept compatible-enough with the legacy ``analyze_trends`` envelope
    (``keywords``, ``timeframe``, ``geo``, ``timestamp``, ``cached``) so the
    ``market_trends`` SIF index and health checks keep working after the swap.
    """

    platform: str = TrendPlatform.WEB.value
    items: List[TrendItem] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    industry: str = ""
    timeframe: str = ""
    geo: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    cached: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "platform": self.platform,
            "items": [item.to_dict() for item in self.items],
            "keywords": self.keywords,
            "industry": self.industry,
            "timeframe": self.timeframe,
            "geo": self.geo,
            "timestamp": self.timestamp,
            "cached": self.cached,
        }


class TrendProvider(ABC):
    """Abstract trend source."""

    @abstractmethod
    async def fetch_trends(
        self,
        platform: TrendPlatform,
        industry: str = "",
        keywords: Optional[List[str]] = None,
        max_results: int = 10,
        user_id: Optional[str] = None,
    ) -> List[TrendItem]:
        """Return trend items for the given platform/context.

        Implementations must return an empty list (never raise) when the
        provider is unavailable so callers degrade gracefully.
        """
        raise NotImplementedError
