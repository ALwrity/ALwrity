"""
Provider Detection Utility
Detects the actual provider (WaveSpeed, Google, HuggingFace, etc.) from model names and endpoints.
"""

from typing import Optional
from models.subscription_models import APIProvider
from loguru import logger

def detect_actual_provider(provider_enum: APIProvider, model_name: Optional[str] = None, endpoint: Optional[str] = None) -> str:
    """
    Detect the actual provider name from provider enum, model name, and endpoint.
    
    Args:
        provider_enum: The APIProvider enum value (e.g., APIProvider.VIDEO, APIProvider.GEMINI)
        model_name: The model name (e.g., "alibaba/wan-2.5/text-to-video", "gemini-2.5-flash")
        endpoint: The API endpoint (e.g., "/video-generation/wavespeed", "/image-generation/stability")
    
    Returns:
        Actual provider name: "wavespeed", "google", "huggingface", "stability", "openai", "anthropic", etc.
    """
    
    # For LLM providers, use the enum value directly
    if provider_enum in [APIProvider.GEMINI]:
        return "google"
    elif provider_enum == APIProvider.OPENAI:
        return "openai"
    elif provider_enum == APIProvider.ANTHROPIC:
        return "anthropic"
    elif provider_enum in (APIProvider.MISTRAL, APIProvider.HUGGINGFACE):
        return "huggingface"
    
    # For search APIs, use the enum value
    elif provider_enum in [APIProvider.TAVILY, APIProvider.SERPER, APIProvider.METAPHOR, APIProvider.FIRECRAWL, APIProvider.EXA]:
        return provider_enum.value
    
    # For media generation, detect from model name or endpoint
    elif provider_enum == APIProvider.VIDEO:
        # Check model name first
        if model_name:
            model_lower = model_name.lower()
            # WaveSpeed models
            if any(x in model_lower for x in ["wan-2.5", "seedance", "infinitetalk", "wavespeed", "alibaba"]):
                return "wavespeed"
            # HuggingFace models
            elif any(x in model_lower for x in ["huggingface", "hf", "tencent", "hunyuan"]):
                return "huggingface"
            # Google models (future)
            elif any(x in model_lower for x in ["veo", "gemini"]):
                return "google"
            # OpenAI models (future)
            elif any(x in model_lower for x in ["sora", "openai"]):
                return "openai"
        
        # Check endpoint
        if endpoint:
            endpoint_lower = endpoint.lower()
            if "wavespeed" in endpoint_lower:
                return "wavespeed"
            elif "huggingface" in endpoint_lower or "hf" in endpoint_lower:
                return "huggingface"
            elif "google" in endpoint_lower or "gemini" in endpoint_lower:
                return "google"
            elif "openai" in endpoint_lower:
                return "openai"
        
        # Default for video: WaveSpeed (most common)
        return "wavespeed"
    
    elif provider_enum == APIProvider.AUDIO:
        # Check model name first
        if model_name:
            model_lower = model_name.lower()
            # WaveSpeed models
            if any(x in model_lower for x in ["minimax", "speech-02", "wavespeed"]):
                return "wavespeed"
            # Google models
            elif any(x in model_lower for x in ["google", "gemini", "tts"]):
                return "google"
            # OpenAI models
            elif any(x in model_lower for x in ["openai", "tts-1"]):
                return "openai"
            # ElevenLabs (future)
            elif "elevenlabs" in model_lower:
                return "elevenlabs"
        
        # Check endpoint
        if endpoint:
            endpoint_lower = endpoint.lower()
            if "wavespeed" in endpoint_lower:
                return "wavespeed"
            elif "google" in endpoint_lower:
                return "google"
            elif "openai" in endpoint_lower:
                return "openai"
        
        # Default for audio: WaveSpeed (most common)
        return "wavespeed"
    
    elif provider_enum == APIProvider.STABILITY:
        # Check model name first
        if model_name:
            model_lower = model_name.lower()
            # WaveSpeed OSS models
            if any(x in model_lower for x in ["qwen", "ideogram", "flux", "wavespeed"]):
                return "wavespeed"
            # Stability AI models
            elif any(x in model_lower for x in ["stability", "stable-diffusion", "sd-"]):
                return "stability"
            # HuggingFace models
            elif any(x in model_lower for x in ["huggingface", "hf", "runway"]):
                return "huggingface"
        
        # Check endpoint
        if endpoint:
            endpoint_lower = endpoint.lower()
            if "wavespeed" in endpoint_lower:
                return "wavespeed"
            elif "stability" in endpoint_lower:
                return "stability"
            elif "huggingface" in endpoint_lower or "hf" in endpoint_lower:
                return "huggingface"
        
        # Default: check if it's actually WaveSpeed based on common OSS models
        if model_name and any(x in model_name.lower() for x in ["qwen", "ideogram", "flux"]):
            return "wavespeed"
        
        # Default for image generation: Stability (legacy)
        return "stability"
    
    elif provider_enum == APIProvider.IMAGE_EDIT:
        # Check model name first
        if model_name:
            model_lower = model_name.lower()
            # WaveSpeed OSS models
            if any(x in model_lower for x in ["qwen", "flux", "kontext", "wavespeed"]):
                return "wavespeed"
            # Stability AI models
            elif any(x in model_lower for x in ["stability", "stable-diffusion"]):
                return "stability"
        
        # Check endpoint
        if endpoint:
            endpoint_lower = endpoint.lower()
            if "wavespeed" in endpoint_lower:
                return "wavespeed"
            elif "stability" in endpoint_lower:
                return "stability"
        
        # Default for image editing: WaveSpeed (OSS-first strategy)
        return "wavespeed"
    
    # Fallback: use enum value
    logger.warning(f"Could not detect actual provider for {provider_enum.value}, using enum value")
    return provider_enum.value
