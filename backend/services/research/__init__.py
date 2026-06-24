"""
Research Services Module for ALwrity

This module provides research and grounding capabilities for content generation,
replacing mock research with real-time industry information.

Available Services:
- GoogleSearchService: Real-time industry research using Google Custom Search API
- ExaService: Competitor discovery and analysis using Exa API
- ExaContentResearchProvider: Shared content research provider for LinkedIn/Blog
- TavilyService: AI-powered web search with real-time information
- Source ranking and credibility assessment
- Content extraction and insight generation

Core Module (v2.0):
- ResearchEngine: Standalone AI research engine for any content tool
- ResearchContext: Unified input schema for research requests
- ParameterOptimizer: AI-driven parameter optimization

Author: ALwrity Team
Version: 2.1
Last Updated: June 2026
"""

from .google_search_service import GoogleSearchService
from .exa_service import ExaService
from .exa_content_research import ExaContentResearchProvider, get_exa_content_provider
from .exa_monitors import ExaMonitorClient, get_exa_monitor_client
from .tavily_service import TavilyService

# Core Research Engine (v2.0)
from .core import (
    ResearchEngine,
    ResearchContext,
    ResearchPersonalizationContext,
    ContentType,
    ResearchGoal,
    ResearchDepth,
    ProviderPreference,
    ParameterOptimizer,
)

__all__ = [
    # Legacy services (still used by blog writer)
    "GoogleSearchService",
    "ExaService",
    "TavilyService",
    
    # Shared content research provider
    "ExaContentResearchProvider",
    "get_exa_content_provider",
    
    # Exa Monitors API client (scheduled recurring searches)
    "ExaMonitorClient",
    "get_exa_monitor_client",
    
    # Core Research Engine (v2.0)
    "ResearchEngine",
    "ResearchContext",
    "ResearchPersonalizationContext",
    "ContentType",
    "ResearchGoal",
    "ResearchDepth",
    "ProviderPreference",
    "ParameterOptimizer",
]
