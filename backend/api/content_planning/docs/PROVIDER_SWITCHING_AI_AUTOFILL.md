# Provider Switching for AI Autofill

## Overview

This document clarifies that AI autofill **already supports provider switching** via the `GPT_PROVIDER` environment variable, similar to how blog writer and story writer handle provider selection.

## Current Architecture

### AI Autofill Flow

```
AIStructuredAutofillService.generate_autofill_fields()
  ↓
AIServiceManager.execute_structured_json_call()
  ↓
AIServiceManager._call_llm_with_checks()
  ↓
llm_text_gen() from main_text_generation.py
  ↓
Provider Selection (based on GPT_PROVIDER env var)
  ↓
gemini_provider OR huggingface_provider
```

### Provider Switching Pattern

**File**: `backend/services/ai_service_manager.py`

The `AIServiceManager.execute_structured_json_call()` method already uses `llm_text_gen()` from `main_text_generation.py`, which supports provider switching:

```python
def _call_llm_with_checks(self, prompt: str, schema: Dict[str, Any], user_id: str):
    """Call LLM through main_text_generation with subscription checks."""
    from services.llm_providers.main_text_generation import llm_text_gen
    
    # Call through main_text_generation for subscription checks
    result = llm_text_gen(
        prompt=prompt,
        json_struct=schema,
        user_id=user_id  # Pass user_id for subscription checks
    )
    return result
```

**File**: `backend/services/llm_providers/main_text_generation.py`

The `llm_text_gen()` function already supports provider switching via `GPT_PROVIDER` environment variable:

```python
def llm_text_gen(prompt: str, system_prompt: Optional[str] = None, json_struct: Optional[Dict[str, Any]] = None, user_id: str = None):
    # Check for GPT_PROVIDER environment variable
    env_provider = os.getenv('GPT_PROVIDER', '').lower()
    if env_provider in ['gemini', 'google']:
        gpt_provider = "google"
        model = "gemini-2.0-flash-001"
    elif env_provider in ['hf_response_api', 'huggingface', 'hf']:
        gpt_provider = "huggingface"
        model = "openai/gpt-oss-120b:groq"
    
    # Auto-detect based on available API keys if no env var
    if not env_provider:
        api_key_manager = APIKeyManager()
        if api_key_manager.get_api_key("gemini"):
            gpt_provider = "google"
        elif api_key_manager.get_api_key("hf_token"):
            gpt_provider = "huggingface"
    
    # Route to appropriate provider
    if gpt_provider == "google":
        if json_struct:
            response_text = gemini_structured_json_response(...)
        else:
            response_text = gemini_text_response(...)
    elif gpt_provider == "huggingface":
        if json_struct:
            response_text = huggingface_structured_json_response(...)
        else:
            response_text = huggingface_text_response(...)
```

## Comparison with Blog Writer and Story Writer

### Blog Writer Pattern

**File**: `backend/api/blog_writer/content/enhanced_content_generator.py`

```python
from services.llm_providers.main_text_generation import llm_text_gen

async def generate_section(self, section: Any, research: Any, mode: str = "polished"):
    # Provider-agnostic text generation (respect GPT_PROVIDER & circuit-breaker)
    ai_resp = llm_text_gen(
        prompt=prompt,
        json_struct=None,
        system_prompt=None,
    )
```

### Story Writer Pattern

Story writer follows the same pattern - uses `llm_text_gen()` from `main_text_generation.py` which respects `GPT_PROVIDER`.

### AI Autofill Pattern

**File**: `backend/api/content_planning/services/content_strategy/autofill/ai_structured_autofill.py`

```python
from services.ai_service_manager import AIServiceManager, AIServiceType

class AIStructuredAutofillService:
    def __init__(self):
        self.ai = AIServiceManager()  # Uses AIServiceManager, not direct provider
    
    async def generate_autofill_fields(self, user_id: int, context: Dict[str, Any]):
        result = await self.ai.execute_structured_json_call(
            service_type=AIServiceType.STRATEGIC_INTELLIGENCE,
            prompt=prompt,
            schema=schema
        )
        # AIServiceManager routes to llm_text_gen() which respects GPT_PROVIDER
```

## Supported Providers

### Google Gemini (Default)

- **Environment Variable**: `GPT_PROVIDER=gemini` or `GPT_PROVIDER=google`
- **Model**: `gemini-2.0-flash-001`
- **Structured JSON**: `gemini_structured_json_response()`
- **Text Generation**: `gemini_text_response()`

### HuggingFace

- **Environment Variable**: `GPT_PROVIDER=huggingface` or `GPT_PROVIDER=hf` or `GPT_PROVIDER=hf_response_api`
- **Model**: `openai/gpt-oss-120b:groq`
- **Structured JSON**: `huggingface_structured_json_response()`
- **Text Generation**: `huggingface_text_response()`

## Configuration

### Environment Variable

Set `GPT_PROVIDER` environment variable to control provider selection:

```bash
# Use Google Gemini
export GPT_PROVIDER=gemini

# Use HuggingFace
export GPT_PROVIDER=huggingface
```

### Auto-Detection

If `GPT_PROVIDER` is not set, the system auto-detects based on available API keys:

1. **Gemini**: If `GEMINI_API_KEY` is configured, uses Gemini
2. **HuggingFace**: If `HF_TOKEN` is configured and Gemini is not available, uses HuggingFace

### API Key Configuration

Ensure API keys are configured in the environment:

```bash
# For Gemini
export GEMINI_API_KEY=your_gemini_api_key

# For HuggingFace
export HF_TOKEN=your_huggingface_token
```

## Key Points

### ✅ Already Supported

1. **Provider Switching**: AI autofill already supports provider switching via `GPT_PROVIDER` env var
2. **Consistent Pattern**: Uses the same pattern as blog writer and story writer (`llm_text_gen()`)
3. **No Hardcoding**: Not hardcoded to `gemini_provider` - routes through `main_text_generation.py`
4. **HuggingFace Support**: Already supports HuggingFace provider

### Architecture Benefits

1. **Consistent Provider Selection**: All AI features use the same provider selection logic
2. **Subscription Checks**: All AI calls go through `llm_text_gen()` which includes subscription checks
3. **Usage Tracking**: All AI calls are tracked through the same usage tracking system
4. **Provider Abstraction**: AI autofill doesn't need to know about specific providers

## Migration Notes

### No Changes Required

The AI autofill code **does not need any changes** - it already uses the correct pattern:

- ✅ Uses `AIServiceManager.execute_structured_json_call()`
- ✅ Routes through `llm_text_gen()` from `main_text_generation.py`
- ✅ Respects `GPT_PROVIDER` environment variable
- ✅ Supports both Gemini and HuggingFace

### Verification

To verify provider switching works:

1. Set `GPT_PROVIDER=huggingface` in environment
2. Call AI autofill endpoint
3. Check logs for provider used (should show "huggingface")
4. Verify structured JSON response format

## Summary

**AI autofill already supports provider switching** - no code changes are required. The system uses the same provider selection pattern as blog writer and story writer, routing through `llm_text_gen()` from `main_text_generation.py`, which respects the `GPT_PROVIDER` environment variable and supports both Gemini and HuggingFace providers.

---

## Appendix: Data Flow Updates (2024)

*Added: February 2024*

### Critical Bug Fix
- Fixed `data_processors.py` - Changed `service.get_autofill(user_id)` (non-existent method) to `service.generate(user_id)`
- Commit: `eb30cd38`

### Expanded AI Context
- AI strategy generation now receives **all 13 onboarding data sources**:
  - website_analysis, research_preferences, onboarding_session
  - persona_data, competitor_analysis, deep_competitor_analysis
  - linkedin_profile, platform_integrations
  - gsc_analytics, bing_analytics
  - canonical_profile, data_quality

### Context Unwrapping
- `_build_context_summary()` now unwraps nested `context['onboarding_data']` for strategy generation
- Both autofill path and strategy generation path use the same data sources

### Quality Gates
- Enhanced quality gates with persona/competitor/analytics grounding validation:
  - `validate_persona_grounding()` - checks content reflects persona role/goals/pain_points
  - `validate_competitor_grounding()` - validates real competitors are referenced
  - `validate_analytics_consistency()` - ensures predictions match GSC/Bing data
  - `validate_strategy_grounding()` - comprehensive grounding check

### Fail-Fast Guard
- Strategy generation returns 409 Conflict when onboarding context is missing
- Validates website_url OR persona_data OR completed session exists before generation

### Observability
- Added data source coverage logging showing which sources are used
- Warning logged when data quality score < 0.5
