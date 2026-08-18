"""Services package for ALwrity backend."""

from .onboarding.api_key_manager import APIKeyManager
from .validation import check_all_api_keys

from .translation import (
    translate_text,
    translate_batch,
    get_translator,
    list_supported_languages,
    is_language_supported,
    TranslationQuality,
    TranslationResult,
    DeepLTranslator,
)

from .dubbing import (
    AudioDubbingService,
    DubbingResult,
    VoiceCloneInfo,
)

__all__ = [
    # Onboarding
    'APIKeyManager',
    'check_all_api_keys',
    # Translation (common module)
    'translate_text',
    'translate_batch',
    'get_translator',
    'list_supported_languages',
    'is_language_supported',
    'TranslationQuality',
    'TranslationResult',
    'DeepLTranslator',
    # Dubbing
    'AudioDubbingService',
    'DubbingResult',
    'VoiceCloneInfo',
]