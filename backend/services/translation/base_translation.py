"""
Base Translation Provider abstract class.

Defines the interface for all translation providers in ALwrity.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any


class TranslationQuality(str, Enum):
    LOW = "low"
    HIGH = "high"


@dataclass
class TranslationResult:
    translated_text: str
    source_language: str
    target_language: str
    provider: str
    quality: TranslationQuality
    confidence: float = 1.0
    alternative_translations: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "translated_text": self.translated_text,
            "source_language": self.source_language,
            "target_language": self.target_language,
            "provider": self.provider,
            "quality": self.quality.value,
            "confidence": self.confidence,
            "alternative_translations": self.alternative_translations,
            "metadata": self.metadata,
        }


class BaseTranslationProvider(ABC):
    
    SUPPORTED_LANGUAGES: Dict[str, str] = {
        "en": "English",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
        "nl": "Dutch",
        "pl": "Polish",
        "ru": "Russian",
        "ja": "Japanese",
        "zh": "Chinese",
        "ko": "Korean",
        "ar": "Arabic",
        "hi": "Hindi",
        "tr": "Turkish",
        "vi": "Vietnamese",
        "th": "Thai",
        "id": "Indonesian",
        "ms": "Malay",
        "fil": "Filipino",
        "he": "Hebrew",
        "cs": "Czech",
        "da": "Danish",
        "fi": "Finnish",
        "el": "Greek",
        "hu": "Hungarian",
        "nb": "Norwegian",
        "ro": "Romanian",
        "sk": "Slovak",
        "sv": "Swedish",
        "uk": "Ukrainian",
        "bg": "Bulgarian",
        "hr": "Croatian",
        "lt": "Lithuanian",
        "lv": "Latvian",
        "et": "Estonian",
        "sl": "Slovenian",
    }
    
    LANGUAGE_CODE_MAPPING: Dict[str, str] = {}
    
    def __init__(self):
        self.LANGUAGE_CODE_MAPPING = {}
        self._build_language_mapping()
    
    def _build_language_mapping(self) -> None:
        for code, name in self.SUPPORTED_LANGUAGES.items():
            self.LANGUAGE_CODE_MAPPING[code.lower()] = code
            self.LANGUAGE_CODE_MAPPING[name.lower()] = code
            self.LANGUAGE_CODE_MAPPING[name.upper()] = code
    
    def normalize_language_code(self, language: str) -> str:
        normalized = language.strip().lower()
        if normalized in self.LANGUAGE_CODE_MAPPING:
            return self.LANGUAGE_CODE_MAPPING[normalized]
        if len(normalized) == 2:
            return normalized.upper()
        for code, name in self.SUPPORTED_LANGUAGES.items():
            if name.lower() == normalized or code.lower() == normalized:
                return code
        return normalized.upper()
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the name of the translation provider."""
        pass
    
    @property
    @abstractmethod
    def quality(self) -> TranslationQuality:
        """Return the quality tier of this provider."""
        pass
    
    @abstractmethod
    def translate(
        self,
        text: str,
        target_language: str,
        source_language: Optional[str] = None,
    ) -> TranslationResult:
        """
        Translate text to target language.
        
        Args:
            text: The text to translate
            target_language: Target language code or name
            source_language: Source language code or name (auto-detect if None)
            
        Returns:
            TranslationResult with translated text and metadata
        """
        pass
    
    @abstractmethod
    def translate_batch(
        self,
        texts: List[str],
        target_language: str,
        source_language: Optional[str] = None,
    ) -> List[TranslationResult]:
        """
        Translate multiple texts in batch.
        
        Args:
            texts: List of texts to translate
            target_language: Target language code or name
            source_language: Source language code or name (auto-detect if None)
            
        Returns:
            List of TranslationResults
        """
        pass
    
    @abstractmethod
    def get_supported_languages(self) -> Dict[str, str]:
        """Return dictionary of supported language codes and names."""
        pass
    
    @abstractmethod
    def is_language_supported(self, language: str) -> bool:
        """Check if a language is supported."""
        pass
    
    @abstractmethod
    def calculate_cost(self, text_length: int, char_count: int = 0) -> float:
        """
        Calculate the cost for translation.
        
        Args:
            text_length: Number of characters to translate
            char_count: Optional explicit character count
            
        Returns:
            Estimated cost in USD
        """
        pass
    
    def validate_text(self, text: str) -> bool:
        """Validate that text is suitable for translation."""
        if not text or not text.strip():
            return False
        if len(text) > 50000:
            raise ValueError(f"Text too long: {len(text)} chars. Maximum is 50000.")
        return True
    
    def split_long_text(self, text: str, max_chars: int = 5000) -> List[str]:
        """Split long text into manageable chunks."""
        if len(text) <= max_chars:
            return [text]
        
        chunks = []
        sentences = text.replace("! ", ".\n").replace("? ", ".\n").replace("。", "。\n").split("\n")
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) <= max_chars:
                current_chunk += sentence + " "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + " "
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
