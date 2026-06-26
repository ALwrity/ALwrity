"""Main Text Generation Service for ALwrity Backend.

This service provides the main LLM text generation functionality,
migrated from the legacy lib/gpt_providers/text_generation/main_text_generation.py
"""

import os
import json
import time
from typing import Optional, Dict, Any, List
from datetime import datetime
from loguru import logger
from fastapi import HTTPException
from ..onboarding.api_key_manager import APIKeyManager

from .gemini_provider import gemini_text_response, gemini_structured_json_response
from .huggingface_provider import huggingface_text_response, huggingface_structured_json_response
from .tenant_provider_config import tenant_provider_config_resolver
from .litellm_provider import litellm_text_response, litellm_structured_json_response


HF_MODEL_MAPPING = {
    "gpt-oss": "openai/gpt-oss-120b:cerebras",
    "gpt-oss-120b": "openai/gpt-oss-120b:cerebras",
    "gpt-oss-20b": "openai/gpt-oss-20b:cerebras",
    "mistral": "mistralai/Mistral-7B-Instruct-v0.3:cerebras",
    "mistral-7b": "mistralai/Mistral-7B-Instruct-v0.3:cerebras",
    "llama": "meta-llama/Llama-3.1-8B-Instruct:cerebras",
    "llama-8b": "meta-llama/Llama-3.1-8B-Instruct:cerebras",
    "llama-70b": "meta-llama/Llama-3.1-70B-Instruct:cerebras",
}

HF_FALLBACK_MODELS = [
    "openai/gpt-oss-120b:cerebras",
    "moonshotai/Kimi-K2-Instruct-0905:cerebras",
    "meta-llama/Llama-3.1-8B-Instruct:cerebras",
    "mistralai/Mistral-7B-Instruct-v0.3:cerebras",
]


def llm_text_gen(
    prompt: str,
    system_prompt: Optional[str] = None,
    json_struct: Optional[Dict[str, Any]] = None,
    user_id: str = None,
    preferred_hf_models: Optional[List[str]] = None,
    preferred_provider: Optional[str] = None,
    flow_type: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> str:
    """
    Generate text using Language Model (LLM) based on the provided prompt.
    
    Args:
        prompt (str): The prompt to generate text from.
        system_prompt (str, optional): Custom system prompt to use instead of the default one.
        json_struct (dict, optional): JSON schema structure for structured responses.
        user_id (str): Clerk user ID for subscription checking (required).
        preferred_hf_models (list, optional): Preferred HuggingFace models.
        preferred_provider (str, optional): Preferred provider (google, huggingface).
        flow_type (str, optional): Flow type for logging (e.g., 'sif_agent', 'premium_tool').
        max_tokens (int, optional): Max tokens for response. If None, provider default is used.
        temperature (float, optional): Temperature for generation (0.0-1.0). If None, defaults to 0.7.
        
    Returns:
        str: Generated text based on the prompt.
        
    Raises:
        RuntimeError: If subscription limits are exceeded or user_id is missing.
    """
    try:
        resolved_flow_type = flow_type or ("sif_agent" if preferred_hf_models else "premium_tool")
        flow_tag = f"flow_type={resolved_flow_type}"
        
        logger.warning(f"[llm_text_gen][{flow_tag}] Starting text generation")
        logger.debug(f"[llm_text_gen] Prompt length: {len(prompt)} characters")
        
        # Set default values for LLM parameters
        gpt_provider = "google"  # Default to Google Gemini
        model = "gemini-2.0-flash-001"
        if temperature is None:
            temperature = 0.7
        top_p = 0.9
        n = 1
        fp = 16
        frequency_penalty = 0.0
        presence_penalty = 0.0
        
        # Check for GPT_PROVIDER environment variable
        env_provider = os.getenv('GPT_PROVIDER', '').lower()
        provider_list = [p.strip() for p in env_provider.split(',') if p.strip()]
        
        # Check for TEXTGEN_AI_MODELS environment variable
        textgen_models_env = os.getenv('TEXTGEN_AI_MODELS', '').strip()
        model_list = [m.strip() for m in textgen_models_env.split(',') if m.strip()] if textgen_models_env else []
        
        # Determine provider based on env vars or tenant config
        if provider_list:
            primary_provider = provider_list[0]
            if primary_provider in ['wavespeed', 'wave']:
                gpt_provider = "wavespeed"
                model = os.getenv('WAVESPEED_TEXT_MODEL', 'openai/gpt-oss-120b')
            elif primary_provider in ['gemini', 'google']:
                gpt_provider = "google"
                model = "gemini-2.0-flash-001"
            elif primary_provider in ['hf_response_api', 'huggingface', 'hf']:
                gpt_provider = "huggingface"
                model = "openai/gpt-oss-120b:cerebras"
            elif primary_provider in ['openai', 'gpt']:
                gpt_provider = "openai"
                model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
            elif primary_provider == 'litellm':
                gpt_provider = "litellm"
                model = os.getenv('LITELLM_MODEL', 'openai/gpt-4o')
            else:
                logger.warning(f"[llm_text_gen] Unknown GPT_PROVIDER: {primary_provider}, using auto-select")
                gpt_provider = None
                model = None
        elif preferred_provider:
            if preferred_provider in ['wavespeed', 'wave']:
                gpt_provider = "wavespeed"
                model = os.getenv('WAVESPEED_TEXT_MODEL', 'openai/gpt-oss-120b')
            elif preferred_provider in ['openai', 'gpt']:
                gpt_provider = "openai"
                model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
            elif preferred_provider in ['gemini', 'google']:
                gpt_provider = "google"
                model = "gemini-2.0-flash-001"
            elif preferred_provider in ['hf_response_api', 'huggingface', 'hf']:
                gpt_provider = "huggingface"
                model = "openai/gpt-oss-120b:cerebras"
            elif preferred_provider == 'litellm':
                gpt_provider = "litellm"
                model = os.getenv('LITELLM_MODEL', 'openai/gpt-4o')
            else:
                gpt_provider = None
                model = None
        else:
            # Fall back to tenant config
            provider_cfg = tenant_provider_config_resolver.resolve(
                modality="text",
                user_id=user_id,
            )
            selected_provider = (provider_cfg.selected_providers or [None])[0]
            if selected_provider in ["gemini", "google"]:
                gpt_provider = "google"
                model = provider_cfg.model_policy.get("default_model") or "gemini-2.0-flash-001"
            elif selected_provider == "huggingface":
                gpt_provider = "huggingface"
                model = provider_cfg.model_policy.get("default_model") or "openai/gpt-oss-120b:cerebras"
        
        # Map short model names to full paths for HF
        if model_list and gpt_provider == "huggingface":
            if "/" in model_list[0]:
                model = model_list[0]
            else:
                model = HF_MODEL_MAPPING.get(model_list[0], model_list[0])
        
        # Default blog characteristics
        blog_tone = "Professional"
        blog_demographic = "Professional"
        blog_type = "Informational"
        blog_language = "English"
        blog_output_format = "markdown"
        blog_length = 2000
        
        # Check which providers have API keys available using APIKeyManager
        api_key_manager = APIKeyManager()
        available_providers = []
        
        # Get strict provider mode from environment
        strict_provider_mode = os.getenv("STRICT_PROVIDER_MODE", "false").lower() in {"1", "true", "yes", "on"}
        if api_key_manager.get_api_key("gemini"):
            available_providers.append("google")
        if api_key_manager.get_api_key("hf_token"):
            available_providers.append("huggingface")
        if api_key_manager.get_api_key("wavespeed"):
            available_providers.append("wavespeed")
        if os.getenv("LITELLM_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY"):
            available_providers.append("litellm")
        
        logger.warning(
            f"[llm_text_gen][{flow_tag}] Provider preflight: env_provider='{env_provider or 'auto'}', "
            f"provider_list={provider_list}, strict_provider_mode={strict_provider_mode}, "
            f"available_providers={available_providers}, preferred_provider={preferred_provider or 'none'}, "
            f"gpt_provider={gpt_provider}, model={model}"
        )

        if gpt_provider not in available_providers:
            logger.warning(f"[llm_text_gen] Provider {gpt_provider} unavailable for user {user_id}, falling back.")
            if "huggingface" in available_providers:
                gpt_provider = "huggingface"
                model = "openai/gpt-oss-120b:cerebras"
            elif "google" in available_providers:
                gpt_provider = "google"
                model = "gemini-2.0-flash-001"
            else:
                logger.error("[llm_text_gen] No API keys found for supported providers.")
                raise RuntimeError("No LLM API keys configured for tenant or environment defaults.")

        # Ensure downstream provider clients (currently env-based) receive resolved key
        resolved_key = get_api_key(gpt_provider, user_id=user_id)
        if gpt_provider == "google" and resolved_key:
            os.environ["GEMINI_API_KEY"] = resolved_key
            os.environ.setdefault("GOOGLE_API_KEY", resolved_key)
        elif gpt_provider == "huggingface" and resolved_key:
            os.environ["HF_TOKEN"] = resolved_key

        if gpt_provider == "huggingface" and preferred_hf_models:
            model = preferred_hf_models[0]
            logger.info(f"[llm_text_gen][{flow_tag}] Using preferred HF model: {model}")
            
        logger.debug(f"[llm_text_gen] Using provider: {gpt_provider}, model: {model}")

        # Map provider name to APIProvider enum (define at function scope for usage tracking)
        from models.subscription_models import APIProvider
        provider_enum = None
        # Store actual provider name for logging (e.g., "huggingface", "gemini")
        actual_provider_name = None
        if gpt_provider == "google":
            provider_enum = APIProvider.GEMINI
            actual_provider_name = "gemini"  # Use "gemini" for consistency in logs
        elif gpt_provider == "huggingface":
            provider_enum = APIProvider.MISTRAL  # HuggingFace maps to Mistral enum for usage tracking
            actual_provider_name = "huggingface"  # Keep actual provider name for logs
        elif gpt_provider == "wavespeed":
            provider_enum = APIProvider.WAVESPEED
            actual_provider_name = "wavespeed"
        elif gpt_provider == "openai":
            provider_enum = APIProvider.OPENAI
            actual_provider_name = "openai"
        elif gpt_provider == "litellm":
            provider_enum = APIProvider.OPENAI
            actual_provider_name = "litellm"

        if not provider_enum:
            # For unknown providers, try to proceed without subscription tracking
            logger.warning(f"[llm_text_gen] Unknown provider {gpt_provider}, proceeding without subscription check")

        # SUBSCRIPTION CHECK - Required and strict enforcement
        if not user_id:
            raise RuntimeError("user_id is required for subscription checking. Please provide Clerk user ID.")
        
        sub_check_start = time.time()
        logger.warning(f"[llm_text_gen][{flow_tag}] Subscription check START for user {user_id}")
        try:
            from services.database import get_session_for_user
            from services.subscription import UsageTrackingService, PricingService
            from models.subscription_models import UsageSummary
            
            db = get_session_for_user(user_id)
            if not db:
                 logger.error(f"[llm_text_gen] Could not get database session for user {user_id}")
                 raise RuntimeError("Database connection failed")
            try:
                
                usage_service = UsageTrackingService(db)
                pricing_service = PricingService(db)
                
                # Estimate tokens from prompt (input tokens)
                # CRITICAL: Use worst-case scenario (input + max_tokens) for validation to prevent abuse
                # This ensures we block requests that would exceed limits even if response is longer than expected
                input_tokens = int(len(prompt.split()) * 1.3)
                # Worst-case estimate: assume maximum possible output tokens (max_tokens if specified)
                # This prevents abuse where actual response tokens exceed the estimate
                if max_tokens:
                    estimated_output_tokens = max_tokens  # Use maximum allowed output tokens
                else:
                    # If max_tokens not specified, use conservative estimate (input * 1.5)
                    estimated_output_tokens = int(input_tokens * 1.5)
                estimated_total_tokens = input_tokens + estimated_output_tokens
                
                # Check limits using sync method from pricing service (strict enforcement)
                can_proceed, message, usage_info = pricing_service.check_usage_limits(
                    user_id=user_id,
                    provider=provider_enum,
                    tokens_requested=estimated_total_tokens,
                    actual_provider_name=actual_provider_name  # Pass actual provider name for correct error messages
                )
                
                if not can_proceed:
                    logger.warning(f"[llm_text_gen] Subscription limit exceeded for user {user_id}: {message}")
                    # Raise HTTPException(429) with usage info so frontend can display subscription modal
                    error_detail = {
                        'error': message,
                        'message': message,
                        'provider': actual_provider_name or provider_enum.value,
                        'usage_info': usage_info if usage_info else {}
                    }
                    raise HTTPException(status_code=429, detail=error_detail)
                
                # Get current usage for limit checking only
                current_period = pricing_service.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")
                usage = db.query(UsageSummary).filter(
                    UsageSummary.user_id == user_id,
                    UsageSummary.billing_period == current_period
                ).first()
                
                # Log subscription details before making the API call
                if usage:
                    total_llm_calls = (usage.gemini_calls or 0) + (usage.openai_calls or 0) + (usage.anthropic_calls or 0) + (usage.mistral_calls or 0) + (usage.wavespeed_calls or 0)
                    logger.info(f"[llm_text_gen] Subscription check passed for user {user_id}: provider={actual_provider_name or gpt_provider}, tokens_requested={estimated_total_tokens}, current_usage=${usage.total_cost or 0:.4f}, calls_used={total_llm_calls}")
                else:
                    logger.info(f"[llm_text_gen] Subscription check passed for user {user_id}: provider={actual_provider_name or gpt_provider}, tokens_requested={estimated_total_tokens}, new_user_no_usage_record")
                
            finally:
                sub_check_ms = (time.time() - sub_check_start) * 1000
                logger.warning(f"[llm_text_gen][{flow_tag}] Subscription check took {sub_check_ms:.0f}ms for user {user_id}")
                db.close()
        except HTTPException:
            # Re-raise HTTPExceptions (e.g., 429 subscription limit) - preserve error details
            raise
        except RuntimeError:
            # Re-raise subscription limit errors
            raise
        except Exception as sub_error:
            # STRICT: Fail on subscription check errors
            sub_check_ms = (time.time() - sub_check_start) * 1000
            logger.error(f"[llm_text_gen][{flow_tag}] Subscription check FAILED after {sub_check_ms:.0f}ms for user {user_id}: {sub_error}")
            raise RuntimeError(f"Subscription check failed: {str(sub_error)}")

        # Construct the system prompt if not provided
        if system_prompt is None:
            system_instructions = f"""You are a highly skilled content writer with a knack for creating engaging and informative content. 
                Your expertise spans various writing styles and formats.

                Writing Style Guidelines:
                - Tone: {blog_tone}
                - Target Audience: {blog_demographic}
                - Content Type: {blog_type}
                - Language: {blog_language}
                - Output Format: {blog_output_format}
                - Target Length: {blog_length} words

                Please provide responses that are:
                - Well-structured and easy to read
                - Engaging and informative
                - Tailored to the specified tone and audience
                - Professional yet accessible
                - Optimized for the target content type
            """
        else:
            system_instructions = system_prompt

        # Generate response based on provider
        response_text = None
        actual_provider_used = gpt_provider
        try:
            if gpt_provider == "google":
                if json_struct:
                    response_text = gemini_structured_json_response(
                        prompt=prompt,
                        schema=json_struct,
                        temperature=temperature,
                        top_p=top_p,
                        top_k=n,
                        max_tokens=max_tokens,
                        system_prompt=system_instructions
                    )
                else:
                    response_text = gemini_text_response(
                        prompt=prompt,
                        temperature=temperature,
                        top_p=top_p,
                        n=n,
                        max_tokens=max_tokens,
                        system_prompt=system_instructions
                    )
            elif gpt_provider == "huggingface":
                if json_struct:
                    response_text = huggingface_structured_json_response(
                        prompt=prompt,
                        schema=json_struct,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        system_prompt=system_instructions
                    )
                else:
                    response_text = huggingface_text_response(
                        prompt=prompt,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        top_p=top_p,
                        system_prompt=system_instructions
                    )
            elif gpt_provider == "wavespeed":
                t0 = time.time()
                logger.warning(f"[llm_text_gen][{flow_tag}] wavespeed: Starting provider init for user {user_id}")
                if json_struct:
                    logger.warning(f"[llm_text_gen][{flow_tag}] wavespeed: Importing wavespeed_provider module (lazy import) for user {user_id}")
                    from services.llm_providers.wavespeed_provider import wavespeed_structured_json_response
                    logger.warning(f"[llm_text_gen][{flow_tag}] wavespeed: Import done, making API call for user {user_id}, import_took={(time.time()-t0)*1000:.0f}ms")
                    t1 = time.time()
                    response_text = wavespeed_structured_json_response(
                        prompt=prompt,
                        schema=json_struct,
                        model=model or "openai/gpt-oss-120b",
                        temperature=temperature,
                        max_tokens=max_tokens,
                        system_prompt=system_instructions
                    )
                else:
                    logger.warning(f"[llm_text_gen][{flow_tag}] wavespeed: Importing wavespeed_provider module (lazy import) for user {user_id}")
                    from services.llm_providers.wavespeed_provider import wavespeed_text_response
                    logger.warning(f"[llm_text_gen][{flow_tag}] wavespeed: Import done, making API call for user {user_id}, import_took={(time.time()-t0)*1000:.0f}ms")
                    t1 = time.time()
                    response_text = wavespeed_text_response(
                        prompt=prompt,
                        model=model or "openai/gpt-oss-120b",
                        temperature=temperature,
                        max_tokens=max_tokens,
                        top_p=top_p,
                        system_prompt=system_instructions
                    )
                api_took_ms = (time.time() - t1) * 1000
                total_ms = (time.time() - t0) * 1000
                logger.warning(f"[llm_text_gen][{flow_tag}] wavespeed: user={user_id} import_took={(t1-t0)*1000:.0f}ms api_took={api_took_ms:.0f}ms total={total_ms:.0f}ms")
            elif gpt_provider == "litellm":
                if json_struct:
                    response_text = litellm_structured_json_response(
                        prompt=prompt,
                        schema=json_struct,
                        model=model or "openai/gpt-4o",
                        temperature=temperature,
                        max_tokens=max_tokens,
                        system_prompt=system_instructions
                    )
                else:
                    response_text = litellm_text_response(
                        prompt=prompt,
                        model=model or "openai/gpt-4o",
                        temperature=temperature,
                        max_tokens=max_tokens,
                        system_prompt=system_instructions
                    )
            else:
                logger.error(f"[llm_text_gen] Unknown provider: {gpt_provider}")
                raise RuntimeError(f"Unknown LLM provider: {gpt_provider}. Supported providers: google, huggingface, wavespeed, litellm")
            
            # TRACK USAGE after successful API call
            if response_text:
                logger.info(f"[llm_text_gen] ✅ API call successful, tracking usage for user {user_id}, provider {provider_enum.value}")
                try:
                    from services.intelligence.agents.agent_usage_tracking import track_agent_usage_sync
                    
                    # Estimate tokens
                    tokens_input = int(len(prompt.split()) * 1.3)
                    
                    # Calculate duration (mocking it since we didn't track start time explicitly in this function)
                    # Ideally we should track start_time at beginning of function
                    duration = 0.5 
                    
                    track_agent_usage_sync(
                        user_id=user_id,
                        model_name=model,
                        prompt=prompt,
                        response_text=response_text,
                        duration=duration
                    )
                    
                except Exception as usage_error:
                    # Non-blocking: log error but don't fail the request
                    logger.error(f"[llm_text_gen] ❌ Failed to track usage: {usage_error}", exc_info=True)
            
            return response_text
        except Exception as provider_error:
            logger.error(f"[llm_text_gen] Provider {gpt_provider} failed: {str(provider_error)}")
            
            # Surface balance/quota errors immediately without fallback
            error_str = str(provider_error).lower()
            if "insufficient_balance" in error_str or "balance_not_enough" in error_str or ("403" in error_str and "balance" in error_str):
                logger.error(f"[llm_text_gen] Balance/quota error from {gpt_provider}, not attempting fallback")
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "insufficient_balance",
                        "message": f"Your {gpt_provider.capitalize()} API balance is insufficient. Please top up your account or switch providers.",
                        "usage_info": {
                            "error_type": "insufficient_balance",
                            "provider": gpt_provider,
                            "suggestion": f"Set GPT_PROVIDER=google in your environment to use Gemini instead, or add credits to your {gpt_provider.capitalize()} account."
                        }
                    }
                )
            
            # CIRCUIT BREAKER: Only try ONE fallback to prevent expensive API calls
            fallback_providers = ["google", "huggingface"]
            fallback_providers = [p for p in fallback_providers if p in available_providers and p != gpt_provider]
            
            if fallback_providers:
                fallback_provider = fallback_providers[0]  # Only try the first available
                try:
                    logger.info(f"[llm_text_gen] Trying SINGLE fallback provider: {fallback_provider}")
                    actual_provider_used = fallback_provider
                    
                    # Update provider enum for fallback
                    if fallback_provider == "google":
                        provider_enum = APIProvider.GEMINI
                        actual_provider_name = "gemini"
                        fallback_model = "gemini-2.0-flash-lite"
                    elif fallback_provider == "huggingface":
                        provider_enum = APIProvider.MISTRAL
                        actual_provider_name = "huggingface"
                        fallback_model = HF_FALLBACK_MODELS[0]
                    
                    if fallback_provider == "google":
                        if json_struct:
                            response_text = gemini_structured_json_response(
                                prompt=prompt,
                                schema=json_struct,
                                temperature=temperature,
                                top_p=top_p,
                                top_k=n,
                                max_tokens=max_tokens,
                                system_prompt=system_instructions
                            )
                        else:
                            response_text = gemini_text_response(
                                prompt=prompt,
                                temperature=temperature,
                                top_p=top_p,
                                n=n,
                                max_tokens=max_tokens,
                                system_prompt=system_instructions
                            )
                    elif fallback_provider == "huggingface":
                        if json_struct:
                            response_text = huggingface_structured_json_response(
                                prompt=prompt,
                                schema=json_struct,
                                model="mistralai/Mistral-7B-Instruct-v0.3:groq",
                                temperature=temperature,
                                max_tokens=max_tokens,
                                system_prompt=system_instructions
                            )
                        else:
                            response_text = huggingface_text_response(
                                prompt=prompt,
                                model="mistralai/Mistral-7B-Instruct-v0.3:groq",
                                temperature=temperature,
                                max_tokens=max_tokens,
                                top_p=top_p,
                                system_prompt=system_instructions
                            )
                    
                    # TRACK USAGE after successful fallback call
                    if response_text:
                        logger.info(f"[llm_text_gen] ✅ Fallback API call successful, tracking usage for user {user_id}, provider {provider_enum.value}")
                        try:
                            from services.intelligence.agents.agent_usage_tracking import track_agent_usage_sync
                            
                            # Estimate tokens
                            tokens_input = int(len(prompt.split()) * 1.3)
                            
                            track_agent_usage_sync(
                                user_id=user_id,
                                model_name=fallback_model,
                                prompt=prompt,
                                response_text=response_text,
                                duration=0.5 # Approximate duration
                            )
                        except Exception as usage_error:
                            logger.error(f"[llm_text_gen] ❌ Failed to track fallback usage: {usage_error}", exc_info=True)
                    
                    return response_text
                except Exception as fallback_error:
                    logger.error(f"[llm_text_gen] Fallback provider {fallback_provider} also failed: {str(fallback_error)}")
            
            # CIRCUIT BREAKER: Stop immediately to prevent expensive API calls
            logger.error("[llm_text_gen] CIRCUIT BREAKER: All providers failed.")
            
            # Provide more helpful error message based on available providers
            if not available_providers:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "No LLM providers configured",
                        "message": "No LLM API keys found. Please configure at least one provider (GPT_PROVIDER, GOOGLE_API_KEY, HF_TOKEN, or WAVESPEED_API_KEY).",
                        "usage_info": {
                            "error_type": "no_providers_configured",
                            "operation_type": "text-generation",
                            "limit": 0,
                            "current_tokens": 0,
                            "suggestion": "Set GPT_PROVIDER=wavespeed in environment or configure API keys in the dashboard."
                        }
                    }
                )
            
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "All LLM providers failed",
                    "message": "All configured LLM providers failed to generate a response. Please check API keys and try again.",
                    "usage_info": {
                        "error_type": "all_providers_failed",
                        "operation_type": "text-generation",
                        "available_providers": available_providers,
                        "requested_provider": gpt_provider,
                        "limit": 0,
                        "current_tokens": 0,
                        "suggestion": f"Provider {gpt_provider} failed. Available: {', '.join(available_providers)}. Try setting GPT_PROVIDER to one of: {', '.join(available_providers)}"
                    }
                }
            )

    except HTTPException:
        # Re-raise HTTPExceptions (e.g., 429 subscription limit) - preserve error details
        raise
    except Exception as e:
        logger.error(f"[llm_text_gen] Error during text generation: {str(e)}")
        raise

def check_gpt_provider(gpt_provider: str) -> bool:
    """Check if the specified GPT provider is supported."""
    supported_providers = ["google", "huggingface"]
    return gpt_provider in supported_providers

def get_api_key(gpt_provider: str, user_id: Optional[str] = None) -> Optional[str]:
    """Get API key for the specified provider."""
    try:
        provider_mapping = {
            "google": "gemini",
            "huggingface": "huggingface"
        }
        mapped_provider = provider_mapping.get(gpt_provider, gpt_provider)
        key, _source = tenant_provider_config_resolver.resolve_provider_key(mapped_provider, user_id=user_id)
        return key
    except Exception as e:
        logger.error(f"[get_api_key] Error getting API key for {gpt_provider}: {str(e)}")
        return None 
