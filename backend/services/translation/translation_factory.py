"""
Translation Factory.

Factory pattern for getting translation providers based on quality tier.
"""

from typing import Dict, Optional

from utils.logger_utils import get_service_logger
from .base_translation import (
    BaseTranslationProvider,
    TranslationQuality,
    TranslationResult,
)
from .deepl_translator import DeepLTranslator

logger = get_service_logger("translation.factory")

_TRANSLATOR_CACHE: Dict[str, BaseTranslationProvider] = {}


def get_translator(
    quality: TranslationQuality = TranslationQuality.LOW,
    force_new: bool = False,
    **kwargs,
) -> BaseTranslationProvider:
    """
    Get a translation provider instance based on quality tier.
    
    Args:
        quality: The quality tier (LOW or HIGH)
        force_new: Force creation of new instance instead of cached
        **kwargs: Additional arguments for the provider
        
    Returns:
        Translation provider instance
        
    Raises:
        ValueError: If quality tier is not supported
    """
    global _TRANSLATOR_CACHE
    
    # Convert kwargs to a sorted string representation for stable caching
    kwargs_str = "_".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
    cache_key = f"{quality.value}_{kwargs_str}"
    
    if not force_new and cache_key in _TRANSLATOR_CACHE:
        return _TRANSLATOR_CACHE[cache_key]
    
    if quality == TranslationQuality.LOW:
        translator = DeepLTranslator(**kwargs)
        logger.info(f"Created DeepL translator (LOW quality)")
    elif quality == TranslationQuality.HIGH:
        from .wavespeed_translator import WaveSpeedTranslator
        translator = WaveSpeedTranslator(**kwargs)
        logger.info(f"Created WaveSpeed translator (HIGH quality)")
    else:
        raise ValueError(f"Unsupported translation quality: {quality}")
    
    _TRANSLATOR_CACHE[cache_key] = translator
    return translator


def translate_text(
    text: str,
    target_language: str,
    source_language: Optional[str] = None,
    quality: TranslationQuality = TranslationQuality.LOW,
) -> TranslationResult:
    """
    Convenience function to translate text with persistent caching.
    
    Args:
        text: Text to translate
        target_language: Target language code or name
        source_language: Source language (auto-detect if None)
        quality: Quality tier
        
    Returns:
        TranslationResult
    """
    from .translation_cache import get_cache
    cache = get_cache()
    cached = cache.get(text, target_language, quality.value)
    if cached:
        return TranslationResult(
            translated_text=cached["translated_text"],
            source_language=cached["source_language"],
            target_language=cached["target_language"],
            provider=cached["provider"],
            quality=TranslationQuality(cached["quality"]),
            metadata=cached["metadata"],
        )

    translator = get_translator(quality)
    result = translator.translate(text, target_language, source_language)
    
    cache.set(
        text=text,
        target_language=target_language,
        quality=quality.value,
        translated_text=result.translated_text,
        source_language=result.source_language,
        provider=result.provider,
        metadata=result.metadata,
    )
    return result


def translate_batch(
    texts: list[str],
    target_language: str,
    source_language: Optional[str] = None,
    quality: TranslationQuality = TranslationQuality.LOW,
) -> list[TranslationResult]:
    """
    Convenience function to translate multiple texts with persistent caching.
    
    Args:
        texts: List of texts to translate
        target_language: Target language code or name
        source_language: Source language (auto-detect if None)
        quality: Quality tier
        
    Returns:
        List of TranslationResults
    """
    from .translation_cache import get_cache
    cache = get_cache()
    
    results = [None] * len(texts)
    uncached_indices = []
    uncached_texts = []
    
    for i, text in enumerate(texts):
        cached = cache.get(text, target_language, quality.value)
        if cached:
            results[i] = TranslationResult(
                translated_text=cached["translated_text"],
                source_language=cached["source_language"],
                target_language=cached["target_language"],
                provider=cached["provider"],
                quality=TranslationQuality(cached["quality"]),
                metadata=cached["metadata"],
            )
        else:
            uncached_indices.append(i)
            uncached_texts.append(text)
            
    if uncached_texts:
        translator = get_translator(quality)
        batch_results = translator.translate_batch(uncached_texts, target_language, source_language)
        for idx, res in zip(uncached_indices, batch_results):
            results[idx] = res
            cache.set(
                text=texts[idx],
                target_language=target_language,
                quality=quality.value,
                translated_text=res.translated_text,
                source_language=res.source_language,
                provider=res.provider,
                metadata=res.metadata,
            )
            
    return results


def list_supported_languages(
    quality: Optional[TranslationQuality] = None,
) -> Dict[str, str]:
    """
    List supported languages.
    
    Args:
        quality: Optional quality filter. Returns all if None.
        
    Returns:
        Dictionary of language codes to names
    """
    if quality == TranslationQuality.LOW:
        return DeepLTranslator().get_supported_languages()
    elif quality == TranslationQuality.HIGH:
        from .wavespeed_translator import WaveSpeedTranslator
        return WaveSpeedTranslator().get_supported_languages()
    else:
        base_langs = DeepLTranslator.SUPPORTED_LANGUAGES
        try:
            from .wavespeed_translator import WaveSpeedTranslator
            wavespeed_langs = WaveSpeedTranslator.SUPPORTED_LANGUAGES
            all_langs = {**base_langs, **wavespeed_langs}
            return all_langs
        except (ImportError, Exception):
            return base_langs


def is_language_supported(
    language: str,
    quality: Optional[TranslationQuality] = None,
) -> bool:
    """
    Check if a language is supported.
    
    Args:
        language: Language code or name
        quality: Optional quality filter
        
    Returns:
        True if supported
    """
    if quality == TranslationQuality.LOW:
        return DeepLTranslator().is_language_supported(language)
    elif quality == TranslationQuality.HIGH:
        from .wavespeed_translator import WaveSpeedTranslator
        return WaveSpeedTranslator().is_language_supported(language)
    else:
        return (
            DeepLTranslator().is_language_supported(language) or
            _check_wavespeed_support(language)
        )


def _check_wavespeed_support(language: str) -> bool:
    try:
        from .wavespeed_translator import WaveSpeedTranslator
        return WaveSpeedTranslator().is_language_supported(language)
    except (ImportError, Exception):
        return False


def clear_translator_cache() -> None:
    """Clear the translator cache."""
    global _TRANSLATOR_CACHE
    _TRANSLATOR_CACHE.clear()
    logger.info("Translation provider cache cleared")
    try:
        from .translation_cache import get_cache
        get_cache().clear()
    except Exception as e:
        logger.warning(f"Failed to clear persistent translation cache: {e}")
