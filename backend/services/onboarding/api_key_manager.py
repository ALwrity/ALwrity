"""
API Key Manager
Manages API keys for different providers (env-backed; BYOK retired).

The legacy ``OnboardingProgress`` 6-step state machine and its per-user DB API
key persistence were retired in C1/D1. This module now only provides the
env-backed ``APIKeyManager`` for the platform's own provider keys.
"""

import os
from typing import Dict, Optional
from loguru import logger


class APIKeyManager:
    """Manages API keys for different providers."""

    def __init__(self):
        self.api_keys = {}
        self._load_from_env()

    def load_api_keys(self):
        self.api_keys = {}
        self._load_from_env()
        return self.api_keys

    def _load_from_env(self):
        """Load API keys from environment variables."""
        providers = [
            'GEMINI_API_KEY',
            'HF_TOKEN',
            'TAVILY_API_KEY',
            'SERPER_API_KEY',
            'METAPHOR_API_KEY',
            'FIRECRAWL_API_KEY',
            'STABILITY_API_KEY',
            'WAVESPEED_API_KEY',
            'NOVAROUTE_API_KEY',
        ]

        for provider in providers:
            key = os.getenv(provider)
            if key:
                # Convert provider name to lowercase for consistency
                provider_name = provider.replace('_API_KEY', '').lower()
                self.api_keys[provider_name] = key
                logger.info(f"Loaded {provider_name} API key from environment")

    def get_api_key(self, provider: str) -> Optional[str]:
        """Get API key for a provider."""
        return self.api_keys.get(provider.lower())

    def save_api_key(self, provider: str, api_key: str):
        """Save API key to environment and memory."""
        provider_lower = provider.lower()
        self.api_keys[provider_lower] = api_key

        # Update environment variable
        env_var = f"{provider.upper()}_API_KEY"
        os.environ[env_var] = api_key

        logger.info(f"Saved {provider} API key")

    def has_api_key(self, provider: str) -> bool:
        """Check if API key exists for provider."""
        return provider.lower() in self.api_keys and bool(self.api_keys[provider.lower()])

    def get_all_keys(self) -> Dict[str, str]:
        """Get all API keys."""
        return self.api_keys.copy()

    def remove_api_key(self, provider: str):
        """Remove API key for provider."""
        provider_lower = provider.lower()
        if provider_lower in self.api_keys:
            del self.api_keys[provider_lower]

            # Remove from environment
            env_var = f"{provider.upper()}_API_KEY"
            if env_var in os.environ:
                del os.environ[env_var]

            logger.info(f"Removed {provider} API key")


def get_api_key_manager() -> APIKeyManager:
    """Get the global API key manager instance."""
    if not hasattr(get_api_key_manager, '_instance'):
        get_api_key_manager._instance = APIKeyManager()
    return get_api_key_manager._instance
