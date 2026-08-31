"""
Trends Research Service

Provides trend data integration for the Research Engine (pytrends-backed
Google Trends today; Tavily-backed provider is the production path forward).
"""

from .google_trends_service import GoogleTrendsService
from .trend_provider import TrendItem, TrendPlatform, TrendProvider, TrendReport
from .tavily_trend_provider import TavilyTrendProvider
from .trend_synthesis import synthesize_trends

__all__ = [
    "GoogleTrendsService",
    "TrendItem",
    "TrendPlatform",
    "TrendProvider",
    "TrendReport",
    "TavilyTrendProvider",
    "synthesize_trends",
]
