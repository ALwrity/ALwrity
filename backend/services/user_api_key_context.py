"""
User API Key Context Manager
Provides API keys to backend services.

Platform-env only (BYOK retired): every user uses the platform's provider
keys from environment variables. Per-user DB keys were removed (D1/D2).
"""

import os
from typing import Optional, Dict
from loguru import logger
from contextlib import contextmanager

class UserAPIKeyContext:
    """
    Context manager for user-specific API keys.
    
    Usage:
        with UserAPIKeyContext(user_id) as api_keys:
            gemini_key = api_keys.get('gemini')
            exa_key = api_keys.get('exa')
            # Use keys for this specific user
    """
    
    def __init__(self, user_id: Optional[str] = None):
        """
        Initialize with optional user_id.
        
        Args:
            user_id: User ID to fetch keys for. If None, uses .env keys (local mode)
        """
        self.user_id = user_id
        self.keys: Dict[str, str] = {}
        self._is_local = os.getenv('DEPLOY_ENV', 'local') == 'local'
    
    def __enter__(self):
        """Load platform API keys from environment (BYOK retired — D1).

        The platform now supplies all provider keys via environment variables
        for every user (subscription model). Per-user DB keys are dead; the
        ``_load_from_database`` path is removed in D2.
        """
        self.keys = self._load_from_env()
        return self.keys
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Clean up when exiting context."""
        self.keys.clear()
        return False  # Don't suppress exceptions
    
    def _load_from_env(self) -> Dict[str, str]:
        """Load API keys from environment variables (.env file)."""
        return {
            'gemini': os.getenv('GEMINI_API_KEY', ''),
            'exa': os.getenv('EXA_API_KEY', ''),
            'copilotkit': os.getenv('COPILOTKIT_API_KEY', ''),
            'openai': os.getenv('OPENAI_API_KEY', ''),
            'anthropic': os.getenv('ANTHROPIC_API_KEY', ''),
            'tavily': os.getenv('TAVILY_API_KEY', ''),
            'serper': os.getenv('SERPER_API_KEY', ''),
            'firecrawl': os.getenv('FIRECRAWL_API_KEY', ''),
        }
    
    @staticmethod
    def get_user_key(user_id: Optional[str], provider: str) -> Optional[str]:
        """
        Convenience method to get a single API key for a user.
        
        Args:
            user_id: User ID (None for development mode)
            provider: Provider name (e.g., 'gemini', 'exa')
            
        Returns:
            API key string or None
        """
        with UserAPIKeyContext(user_id) as keys:
            return keys.get(provider)


@contextmanager
def user_api_keys(user_id: Optional[str] = None):
    """
    Context manager function for easier usage.
    
    Usage:
        from services.user_api_key_context import user_api_keys
        
        with user_api_keys(user_id) as keys:
            gemini_key = keys.get('gemini')
    """
    context = UserAPIKeyContext(user_id)
    try:
        yield context.__enter__()
    finally:
        context.__exit__(None, None, None)


# Convenience function for FastAPI dependency injection
def get_user_api_keys(user_id: str) -> Dict[str, str]:
    """
    Get user-specific API keys for use in FastAPI endpoints.
    
    Args:
        user_id: User ID from current_user
        
    Returns:
        Dictionary of API keys for this user
    """
    with UserAPIKeyContext(user_id) as keys:
        return keys


def get_gemini_key(user_id: Optional[str] = None) -> Optional[str]:
    """Get Gemini API key for user."""
    return UserAPIKeyContext.get_user_key(user_id, 'gemini')


def get_exa_key(user_id: Optional[str] = None) -> Optional[str]:
    """Get Exa API key for user."""
    return UserAPIKeyContext.get_user_key(user_id, 'exa')


def get_tavily_key(user_id: Optional[str] = None) -> Optional[str]:
    """Get Tavily API key for user."""
    return UserAPIKeyContext.get_user_key(user_id, 'tavily')


def get_copilotkit_key(user_id: Optional[str] = None) -> Optional[str]:
    """Get CopilotKit API key for user."""
    return UserAPIKeyContext.get_user_key(user_id, 'copilotkit')
