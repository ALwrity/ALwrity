# ALwrity LLM Gateway – Architecture Overview

ALwrity’s LLM Gateway lives under [llm_providers](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers) and provides a consistent, production‑oriented interface for text, image, audio, and video generation across multiple model providers. It encapsulates provider differences, applies subscription enforcement, and centralizes observability and reliability patterns.

## Goals
- Unified surface for LLM operations across providers
- Strong subscription enforcement and cost awareness
- Resilient calls with retries and structured error handling
- Extensible provider architecture with clear contracts
- Transparent metrics, usage logging, and pricing integration

## High‑Level Flow
1. Entry points route requests to the appropriate capability:
   - Text generation via [main_text_generation.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/main_text_generation.py)
   - Image generation and editing via [image_generation](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/image_generation)
   - Video generation via [video_generation](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/video_generation)
   - Audio/STT via [audio_to_text_generation](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/audio_to_text_generation)
2. Subscription enforcement integrates before provider calls:
   - Uses PricingService and UsageTrackingService to validate tokens/operations
   - Blocks requests that exceed limits with actionable error payloads
3. Provider module performs the call with provider‑specific SDKs/APIs
4. Results are normalized to ALwrity types and returned upstream

## Core Components
- **Text Generation Entry**: [main_text_generation.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/main_text_generation.py)
  - Detects available providers via APIKeyManager
  - Applies strict subscription checks using PricingService and UsageTrackingService
  - Routes to Gemini or Hugging Face implementations
- **Image Generation Contracts**: [base.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/image_generation/base.py)
  - Options and Result dataclasses
  - Protocols for generation, edit, and face‑swap providers
- **Video Generation Contracts**: [base.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/video_generation/base.py)
  - Options and Result dataclasses
  - Async protocol with progress callbacks
- **Provider Implementations**:
  - Gemini text: [gemini_provider.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/gemini_provider.py)
  - Hugging Face text: [huggingface_provider.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/huggingface_provider.py)
  - OrcaRouter text: [orcarouter_provider.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/orcarouter_provider.py)
  - Hugging Face image: [hf_provider.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/image_generation/hf_provider.py)
  - WaveSpeed video: [wavespeed_provider.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/video_generation/wavespeed_provider.py)

## Provider Abstraction
- Image providers conform to:
  - ImageGenerationProvider.generate(options) -> ImageGenerationResult
  - ImageEditProvider.edit(options) -> ImageGenerationResult
  - FaceSwapProvider.swap_face(options) -> ImageGenerationResult
- Video providers conform to:
  - VideoGenerationProvider.generate_video(options, progress_cb) -> VideoGenerationResult

These contracts ensure consistent options/result types so downstream UI and logging remain stable regardless of provider.

## Subscription Enforcement
- Performed in the text pipeline entry point before any provider call:
  - See enforcement and usage checks in [main_text_generation.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/main_text_generation.py#L117-L166)
- Preflight operations endpoint also validates multi‑operation cost/limits:
  - See [preflight.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/api/subscription/routes/preflight.py)
- Image/video modules typically rely on the calling route to validate limits first, then perform provider calls.

## Configuration and Secrets
- Gemini: GEMINI_API_KEY
  - Loaded and validated in [gemini_provider.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/gemini_provider.py#L101-L116)
- Hugging Face: HF_TOKEN
  - Loaded and validated in [huggingface_provider.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/huggingface_provider.py#L90-L105)
- OrcaRouter: ORCAROUTER_API_KEY
  - Loaded and validated in [orcarouter_provider.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/orcarouter_provider.py#L80-L95)
- Hugging Face image defaults: HF_IMAGE_MODEL
  - Used in [image_generation/hf_provider.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/image_generation/hf_provider.py#L17-L21)
- Provider clients must never log secrets; logs are provider‑scoped via get_service_logger.

## Reliability and Error Handling
- Exponential backoff retries using tenacity:
  - Gemini text: [gemini_text_response](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/gemini_provider.py#L117)
  - Hugging Face text: [huggingface_text_response](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/huggingface_provider.py#L106)
- Structured exceptions surface HTTP 429 for limit breaches with usage info
- Provider modules return normalized results; callers handle downstream persistence and telemetry

## Pricing and Cost Awareness
- Preflight cost estimation computes operation costs per provider/model:
  - See multi‑operation handling in [preflight.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/api/subscription/routes/preflight.py#L100-L144)
- Video cost calculation is provider/model aware:
  - See WaveSpeed services and `calculate_cost` in [video_generation/wavespeed_provider.py](file:///C:/Users/diksha%20rawat/Desktop/ALwrity/backend/services/llm_providers/video_generation/wavespeed_provider.py#L44-L56)

## Observability
- Service‑scoped loggers for each provider/module
- Central usage logs recorded via subscription services on the calling routes
- Provider metadata normalized in result objects for consistent analytics

## Extensibility Guidelines
- Implement the appropriate Protocol interface in a new provider module
- Normalize options and results to the gateway dataclasses
- Keep environment/key validation local to the provider module
- Add cost mapping in PricingService and preflight for new operations/models
- Wire subscription validation in the calling route before invoking provider

## Request Lifecycle (Text)
1. Client submits prompt to text endpoint
2. Entry point determines provider (env or APIKeyManager) and validates subscription limits
3. Provider‑specific function executes with retries and returns normalized text
4. Caller logs usage and returns response to client

## Request Lifecycle (Media)
1. Client submits generation/edit/face‑swap request
2. Route validates plan limits (tokens, requests, or per‑operation limits)
3. Provider service executes call and produces normalized binary payload and metadata
4. Caller logs usage and returns media/links to client

This architecture isolates provider variability while standardizing contracts, enabling safe expansion to new models and modalities without destabilizing upstream consumers.
