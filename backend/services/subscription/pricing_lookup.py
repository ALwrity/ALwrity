"""
Shared Pricing Lookup Utility — Single Source of Truth (SSOT).
Reads from pricing.yaml via PricingConfigLoader with in-memory caching.
"""

from __future__ import annotations

from typing import Optional, Dict, Any, Tuple
from loguru import logger

from services.subscription.pricing_config import PricingConfigLoader, ModelPricingEntry
from models.subscription_models import APIProvider


class PricingLookup:
    """Fast, in-memory pricing lookup reading from pricing.yaml as SSOT."""

    _loader: Optional[PricingConfigLoader] = None
    _lookup_cache: Dict[Tuple[str, str], ModelPricingEntry] = {}
    _model_name_cache: Dict[str, ModelPricingEntry] = {}
    _initialized: bool = False

    @classmethod
    def _ensure_loaded(cls, force_reload: bool = False) -> None:
        """Load and index pricing.yaml into fast in-memory lookup tables."""
        if cls._initialized and not force_reload:
            return

        if cls._loader is None or force_reload:
            cls._loader = PricingConfigLoader()

        config = cls._loader.load() if force_reload else cls._loader.get_config()
        cls._lookup_cache.clear()
        cls._model_name_cache.clear()

        for entry in config.model_pricing:
            prov_str = entry.provider.value.lower()
            model_key = entry.model_name.lower()

            cls._lookup_cache[(prov_str, model_key)] = entry

            # Also index by plain model name (first one wins or more specific wins)
            if model_key not in cls._model_name_cache:
                cls._model_name_cache[model_key] = entry

            # If model name contains slashes (e.g. wavespeed-ai/qwen-image), also index the short name
            if "/" in model_key:
                short_name = model_key.split("/")[-1]
                if short_name not in cls._model_name_cache:
                    cls._model_name_cache[short_name] = entry

        cls._initialized = True
        logger.debug(f"[PricingLookup] Indexed {len(config.model_pricing)} pricing entries from pricing.yaml")

    @classmethod
    def get_entry(
        cls,
        model_name: str,
        provider: Optional[str | APIProvider] = None,
    ) -> Optional[ModelPricingEntry]:
        """Find the pricing entry for a model name and optional provider."""
        cls._ensure_loaded()
        if not model_name:
            return None

        clean_model = model_name.strip().lower()

        # 1. Try exact (provider, model_name) match
        if provider:
            prov_key = provider.value.lower() if isinstance(provider, APIProvider) else str(provider).lower()
            entry = cls._lookup_cache.get((prov_key, clean_model))
            if entry:
                return entry

        # 2. Try exact model_name match across all providers
        if clean_model in cls._model_name_cache:
            return cls._model_name_cache[clean_model]

        # 3. Try short model name (strip prefix org/repo/)
        short_name = clean_model.split("/")[-1]
        if short_name in cls._model_name_cache:
            return cls._model_name_cache[short_name]

        # 4. Try fuzzy prefix match for common models (e.g. ideogram-character in model name)
        for key, entry in cls._model_name_cache.items():
            if key in clean_model or clean_model in key:
                return entry

        return None

    @classmethod
    def get_all_pricing_entries(cls) -> list[ModelPricingEntry]:
        """Get all raw pricing entries loaded from pricing.yaml."""
        cls._ensure_loaded()
        config = cls._loader.get_config()
        return list(config.model_pricing)

    @classmethod
    def get_pricing_dict_list(cls, provider: Optional[str] = None) -> list[dict[str, Any]]:
        """Get formatted list of pricing dictionaries from pricing.yaml."""
        entries = cls.get_all_pricing_entries()
        results = []
        prov_filter = provider.lower().strip() if provider else None
        for entry in entries:
            p_val = entry.provider.value if hasattr(entry.provider, "value") else str(entry.provider)
            if prov_filter and p_val.lower() != prov_filter:
                continue
            results.append({
                "provider": p_val,
                "model_name": entry.model_name,
                "cost_per_input_token": entry.cost_per_input_token,
                "cost_per_output_token": entry.cost_per_output_token,
                "cost_per_request": entry.cost_per_request,
                "cost_per_search": entry.cost_per_search,
                "cost_per_image": entry.cost_per_image,
                "cost_per_page": entry.cost_per_page,
                "description": entry.description or f"{entry.model_name} pricing",
            })
        return results

    @classmethod
    def get_image_cost(cls, model_name: str, default: float = 0.04) -> float:
        """Get per-image generation cost from pricing.yaml."""
        entry = cls.get_entry(model_name, provider="stability") or cls.get_entry(model_name)
        if entry:
            cost = entry.cost_per_image or entry.cost_per_request
            if cost > 0:
                return cost
        return default

    @classmethod
    def get_image_edit_cost(
        cls,
        model_name: str,
        resolution: Optional[str] = None,
        default: float = 0.02,
    ) -> float:
        """Get per-image edit cost from pricing.yaml."""
        # Special resolution handling for Nano Banana Pro Edit Ultra 8K
        if resolution and resolution.lower() == "8k" and "nano-banana" in model_name.lower():
            return 0.18

        entry = cls.get_entry(model_name, provider="image_edit") or cls.get_entry(model_name)
        if entry:
            cost = entry.cost_per_request or entry.cost_per_image
            if cost > 0:
                return cost
        return default

    @classmethod
    def get_face_swap_cost(cls, model_name: str, default: float = 0.025) -> float:
        """Get per-face swap cost from pricing.yaml."""
        entry = cls.get_entry(model_name, provider="image_edit") or cls.get_entry(model_name)
        if entry:
            cost = entry.cost_per_request or entry.cost_per_image
            if cost > 0:
                return cost
        return default

    @classmethod
    def get_video_model_cost(
        cls,
        model_name: str,
        duration_sec: Optional[float] = None,
        resolution: Optional[str] = None,
        default: float = 0.25,
    ) -> float:
        """
        Get video generation cost from pricing.yaml with duration and resolution awareness.

        Handles:
        1. InfiniteTalk (duration-aware billing):
           - 720p (default): $0.30 per 5 seconds ($0.06/sec)
           - 480p: $0.15 per 5 seconds ($0.03/sec)
           - Minimum billed duration: 3.0s, Maximum duration cap: 600.0s (10 min)
        2. Hunyuan Avatar:
           - 480p: $0.15 per 5s block
           - 720p: $0.30 per 5s block
        3. Kling v2.5 Turbo Std:
           - 5s: $0.21, 10s: $0.42
        4. Standard models (wan-2.5, seedance-1.5-pro, etc.):
           - Direct lookup from pricing.yaml per_request
        """
        clean_name = (model_name or "").lower().strip()

        # 1. InfiniteTalk duration-aware calculation
        if "infinitetalk" in clean_name:
            res = (resolution or "720p").lower()
            base_rate_5s = 0.15 if res == "480p" else 0.30
            entry = cls.get_entry("wavespeed-ai/infinitetalk", provider="video") or cls.get_entry("infinitetalk", provider="video")
            if entry and entry.cost_per_request > 0:
                if res == "480p":
                    base_rate_5s = entry.cost_per_request / 2.0
                else:
                    base_rate_5s = entry.cost_per_request

            if duration_sec is not None and duration_sec > 0:
                effective_duration = max(3.0, min(600.0, float(duration_sec)))
                return round((effective_duration / 5.0) * base_rate_5s, 4)
            return base_rate_5s

        # 2. Hunyuan Avatar block-based calculation
        if "hunyuan-avatar" in clean_name or "hunyuan_avatar" in clean_name:
            res = "480p" if "480p" in clean_name or (resolution and "480p" in resolution) else "720p"
            model_key = f"hunyuan-avatar-{res}"
            entry = cls.get_entry(model_key, provider="video") or cls.get_entry("hunyuan-avatar-720p" if res == "720p" else "hunyuan-avatar-480p", provider="video")
            cost_per_5s = entry.cost_per_request if entry and entry.cost_per_request > 0 else (0.15 if res == "480p" else 0.30)

            if duration_sec is not None and duration_sec > 0:
                actual_duration = max(5.0, min(120.0, float(duration_sec)))
                blocks = (int(actual_duration) + 4) // 5
                return round(cost_per_5s * blocks, 4)
            return cost_per_5s

        # 3. Kling v2.5 Turbo Std duration check
        if "kling" in clean_name:
            if duration_sec is not None and duration_sec > 5:
                entry_10s = cls.get_entry("kling-v2.5-turbo-std-10s", provider="video")
                if entry_10s and entry_10s.cost_per_request > 0:
                    return entry_10s.cost_per_request
            entry = cls.get_entry(clean_name, provider="video") or cls.get_entry("kling-v2.5-turbo-std-5s", provider="video") or cls.get_entry("kling-v2.5-turbo-std", provider="video")
            if entry and entry.cost_per_request > 0:
                return entry.cost_per_request
            return 0.42 if (duration_sec and duration_sec > 5) else 0.21

        # 4. Standard models lookup
        entry = cls.get_entry(model_name, provider="video") or cls.get_entry(model_name)
        if entry and entry.cost_per_request > 0:
            return entry.cost_per_request

        return default

    @classmethod
    def get_video_cost(
        cls,
        model_name: str,
        duration_sec: Optional[float] = None,
        resolution: Optional[str] = None,
        default: float = 0.25,
    ) -> float:
        """Alias for get_video_model_cost."""
        return cls.get_video_model_cost(model_name, duration_sec=duration_sec, resolution=resolution, default=default)

    @classmethod
    def get_audio_cost_per_token(cls, model_name: str, default: float = 5e-05) -> float:
        """Get per-token/char audio cost from pricing.yaml."""
        entry = cls.get_entry(model_name, provider="audio") or cls.get_entry(model_name)
        if entry and entry.cost_per_input_token > 0:
            return entry.cost_per_input_token
        return default

    @classmethod
    def get_audio_tts_cost(
        cls,
        model_name: str = "minimax/speech-02-hd",
        text_length: int = 1000,
        default_per_char: float = 5e-05,
    ) -> float:
        """Calculate total TTS generation cost based on character length."""
        per_char_cost = cls.get_audio_cost_per_token(model_name, default=default_per_char)
        return float(text_length) * per_char_cost

    @classmethod
    def get_voice_clone_cost(
        cls,
        model_name: str = "minimax/voice-clone",
        char_count: int = 0,
        default_per_request: float = 0.50,
    ) -> float:
        """Get voice clone cost from pricing.yaml (fixed per_request or character-scaled)."""
        clean_model = model_name.strip().lower()

        # Check for lightweight OSS voice clone models (Qwen3, CosyVoice)
        if "qwen" in clean_model or "cosy" in clean_model:
            entry = cls.get_entry(model_name, provider="audio") or cls.get_entry(model_name)
            base_req = entry.cost_per_request if entry and entry.cost_per_request > 0 else 0.005
            if char_count > 0:
                return max(base_req, base_req * (char_count / 100.0))
            return base_req

        # Standard MiniMax or provider voice clone (per run pricing)
        entry = cls.get_entry(model_name, provider="audio") or cls.get_entry(model_name)
        if entry:
            if entry.cost_per_request > 0:
                return entry.cost_per_request
            if entry.cost_per_input_token > 0 and char_count > 0:
                return float(char_count) * entry.cost_per_input_token
        return default_per_request


# Convenient module-level functions
get_model_pricing_entry = PricingLookup.get_entry
get_image_model_cost = PricingLookup.get_image_cost
get_image_edit_model_cost = PricingLookup.get_image_edit_cost
get_face_swap_model_cost = PricingLookup.get_face_swap_cost
get_video_model_cost = PricingLookup.get_video_model_cost
get_video_cost = PricingLookup.get_video_cost
get_audio_cost_per_token = PricingLookup.get_audio_cost_per_token
get_audio_tts_cost = PricingLookup.get_audio_tts_cost
get_voice_clone_cost = PricingLookup.get_voice_clone_cost
