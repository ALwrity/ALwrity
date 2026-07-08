import os
import tempfile
from services.translation.base_translation import BaseTranslationProvider, TranslationQuality, TranslationResult
from services.translation.translation_cache import PersistentTranslationCache
from services.translation.translation_factory import translate_text, clear_translator_cache, get_translator

# Mock subclasses to test mapping isolation
class MockProviderA(BaseTranslationProvider):
    SUPPORTED_LANGUAGES = {"en": "English", "es": "Spanish"}
    
    @property
    def provider_name(self) -> str:
        return "provider_a"
        
    @property
    def quality(self) -> TranslationQuality:
        return TranslationQuality.LOW
        
    def translate(self, text, target_language, source_language=None):
        return TranslationResult(
            translated_text=f"A:{text}",
            source_language=source_language or "en",
            target_language=target_language,
            provider=self.provider_name,
            quality=self.quality
        )
        
    def translate_batch(self, texts, target_language, source_language=None):
        return [self.translate(t, target_language, source_language) for t in texts]
        
    def get_supported_languages(self):
        return self.SUPPORTED_LANGUAGES
        
    def is_language_supported(self, language):
        return language in self.SUPPORTED_LANGUAGES
        
    def calculate_cost(self, text_length, char_count=0):
        return 0.0

class MockProviderB(BaseTranslationProvider):
    SUPPORTED_LANGUAGES = {"fr": "French", "de": "German"}
    
    @property
    def provider_name(self) -> str:
        return "provider_b"
        
    @property
    def quality(self) -> TranslationQuality:
        return TranslationQuality.HIGH
        
    def translate(self, text, target_language, source_language=None):
        return TranslationResult(
            translated_text=f"B:{text}",
            source_language=source_language or "en",
            target_language=target_language,
            provider=self.provider_name,
            quality=self.quality
        )
        
    def translate_batch(self, texts, target_language, source_language=None):
        return [self.translate(t, target_language, source_language) for t in texts]
        
    def get_supported_languages(self):
        return self.SUPPORTED_LANGUAGES
        
    def is_language_supported(self, language):
        return language in self.SUPPORTED_LANGUAGES
        
    def calculate_cost(self, text_length, char_count=0):
        return 0.0


def test_language_code_mapping_isolation():
    # Verify that different provider instances have separate, isolated LANGUAGE_CODE_MAPPING
    p_a = MockProviderA()
    p_b = MockProviderB()
    
    # Provider A mapping should have English/Spanish mapping, NOT French/German
    assert "en" in p_a.LANGUAGE_CODE_MAPPING
    assert "fr" not in p_a.LANGUAGE_CODE_MAPPING
    
    # Provider B mapping should have French/German mapping, NOT English/Spanish
    assert "fr" in p_b.LANGUAGE_CODE_MAPPING
    assert "en" not in p_b.LANGUAGE_CODE_MAPPING


def test_persistent_translation_cache():
    # Create cache in a temporary file to keep tests clean
    fd, temp_path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    
    try:
        cache = PersistentTranslationCache(cache_file_path=temp_path)
        
        # Initially cache should be empty
        assert cache.get("Hello", "es", "low") is None
        
        # Set cache entry
        cache.set("Hello", "es", "low", "Hola", "en", "deepl")
        
        # Verify cache get returns correct dictionary
        cached = cache.get("Hello", "es", "low")
        assert cached is not None
        assert cached["translated_text"] == "Hola"
        assert cached["source_language"] == "en"
        assert cached["provider"] == "deepl"
        
        # Create a new cache instance pointing to same file
        # to verify persistence load
        new_cache_instance = PersistentTranslationCache(cache_file_path=temp_path)
        cached_persisted = new_cache_instance.get("Hello", "es", "low")
        assert cached_persisted is not None
        assert cached_persisted["translated_text"] == "Hola"
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
