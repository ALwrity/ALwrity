"""
Trends Research Service

Tavily-backed trend provider (production path) plus keyword normalization.
"""

from .trend_provider import TrendItem, TrendPlatform, TrendProvider, TrendReport
from .tavily_trend_provider import TavilyTrendProvider
from .trend_synthesis import synthesize_trends

__all__ = [
    "TrendItem",
    "TrendPlatform",
    "TrendProvider",
    "TrendReport",
    "TavilyTrendProvider",
    "synthesize_trends",
]
