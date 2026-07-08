"""
Persistent file-based translation cache for ALwrity.

Caches translation results to a JSON file to avoid duplicate API calls and reduce costs.
"""

import os
import json
import hashlib
from typing import Dict, Optional, Any
from utils.logger_utils import get_service_logger

logger = get_service_logger("translation.cache")

class PersistentTranslationCache:
    def __init__(self, cache_file_path: Optional[str] = None):
        if cache_file_path is None:
            # Default to backend/cache/translation_cache.json
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            cache_dir = os.path.join(base_dir, "cache")
            os.makedirs(cache_dir, exist_ok=True)
            cache_file_path = os.path.join(cache_dir, "translation_cache.json")
            
        self.cache_file_path = cache_file_path
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.load_cache()

    def _generate_key(self, text: str, target_language: str, quality: str) -> str:
        """Generate a unique SHA-256 hash for the translation parameters."""
        normalized_text = text.strip()
        normalized_lang = target_language.strip().lower()
        key_raw = f"{normalized_text}_{normalized_lang}_{quality}"
        return hashlib.sha256(key_raw.encode("utf-8")).hexdigest()

    def load_cache(self) -> None:
        """Load cache from the JSON file."""
        if not os.path.exists(self.cache_file_path):
            self._cache = {}
            return
            
        try:
            with open(self.cache_file_path, "r", encoding="utf-8") as f:
                self._cache = json.load(f)
            logger.info(f"Loaded {len(self._cache)} cached translations from {self.cache_file_path}")
        except Exception as e:
            logger.warning(f"Failed to load translation cache: {e}. Starting fresh.")
            self._cache = {}

    def save_cache(self) -> None:
        """Save cache to the JSON file."""
        try:
            with open(self.cache_file_path, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save translation cache: {e}")

    def get(self, text: str, target_language: str, quality: str) -> Optional[Dict[str, Any]]:
        """
        Get translation result from cache.
        
        Returns:
            Dict containing translated_text, source_language, provider, quality, and metadata, or None.
        """
        key = self._generate_key(text, target_language, quality)
        result = self._cache.get(key)
        if result:
            logger.debug("Cache hit for translation")
            return result
        return None

    def set(
        self,
        text: str,
        target_language: str,
        quality: str,
        translated_text: str,
        source_language: str,
        provider: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Store translation result in cache."""
        key = self._generate_key(text, target_language, quality)
        self._cache[key] = {
            "translated_text": translated_text,
            "source_language": source_language,
            "target_language": target_language,
            "provider": provider,
            "quality": quality,
            "metadata": metadata or {},
        }
        self.save_cache()
        logger.debug("Saved translation to cache")

    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()
        self.save_cache()
        logger.info("Translation cache cleared")

# Global singleton cache instance
_global_cache = PersistentTranslationCache()

def get_cache() -> PersistentTranslationCache:
    return _global_cache
