---
title: SIF and AI Tools model LLM choices
updated: 2026-03-11
---

# SIF and AI Tools model LLM choices

This document captures the intended LLM/provider split between:

- **Premium AI tools** (podcast, story writer, blog writer, etc.)
- **SIF / agents** (local-first intelligence workflows)

It also records recent fixes, root causes, and consolidation next steps.

---

## 1) Design Intent (Target Behavior)

### A) Premium AI Tools

Use remote premium API path by default.

- Primary provider route: **Hugging Face router**
- Preferred premium model: **`openai/gpt-oss-120b:groq`**
- `GPT_PROVIDER` values that should map to this premium remote text route:
  - `huggingface`
  - `hf`
  - `hf_response_api`
  - `wavespeed` (alias mapping for premium remote route)
- **OrcaRouter**: `GPT_PROVIDER=orcarouter` routes text generation through the [OrcaRouter](https://www.orcarouter.ai) OpenAI-compatible gateway (`https://api.orcarouter.ai/v1`, default model `orcarouter/auto`). It is a first-class named provider implemented in [orcarouter_provider.py](../backend/services/llm_providers/orcarouter_provider.py) and is treated as an OpenAI-compatible route.

Fallback policy for premium tools:

- Keep fallback **minimal and explicit**.
- Do **not** accidentally inherit SIF low-cost fallback chains.
- If provider is explicitly pinned per call (`preferred_provider`), avoid cross-provider switching to reduce noisy retries and cost/time waste.

### B) SIF / Agents

Use local-first strategy.

- Primary: local models (where SIF pipeline supports them)
- Fallback: smaller remote models (HF + environment-guided provider logic)
- Explicit low-cost model lists should be passed by SIF wrappers (e.g., `preferred_hf_models`) to keep these flows distinct from premium tools.

---

## 2) Current Routing Contract in `llm_text_gen`

`llm_text_gen(...)` now supports explicit context signals:

- `preferred_provider`: pin provider intent for tool-specific flows
- `preferred_hf_models`: low-cost model list for SIF/agent fallback usage
- `flow_type`: diagnostic tag (`premium_tool` vs `sif_agent`)

### Flow separation rule

- If `preferred_hf_models` is used (SIF path), that list drives HF model selection/fallback.
- Premium tool calls should **not** pass SIF low-cost lists.

### Diagnostics

Logs include:

- `[llm_text_gen][flow_type=premium_tool] ...`
- `[llm_text_gen][flow_type=sif_agent] ...`

This makes mixed routing issues visible immediately.

---

## 3) Key Issues Found and Fixes Applied

### Issue A: Premium/SIF behavior got mixed

Symptoms:

- premium calls iterating through low-cost fallback chains
- noisy model-not-found logs
- wasted latency and confusion over routing

Fix:

- made fallback model chain caller-controlled
- kept SIF-specific fallback models passed only from SIF wrappers
- kept premium calls separate and explicitly tagged

### Issue B: Podcast bible generation error (`NoneType` callable)

Symptoms:

- `services.podcast_bible_service:generate_bible -> 'NoneType' object is not callable`

Root cause:

- personalization session acquisition/payload handling edge cases

Fix:

- safe DB session retrieval via user-scoped session function
- non-dict guardrails for integrated payload/canonical profile
- fallback to defaults instead of crashing

### Issue C: Premium default model drift

Symptoms:

- premium default shifted to smaller model in recent patches

Fix:

- restored premium default model to:
  - `openai/gpt-oss-120b:groq`
- kept `wavespeed` env alias mapped to premium remote text route logic

---

## 4) Provider Notes

### Hugging Face provider

- Accepts explicit `fallback_models` list.
- If `fallback_models=[]`, no broad fallback chain is injected beyond direct model variant handling.

### Wavespeed

- Wavespeed services exist in codebase and are used for dedicated workloads.
- In text routing context (`llm_text_gen`), `GPT_PROVIDER=wavespeed` is treated as an alias to premium remote text route (HF provider path), preserving current behavior without introducing a second text-provider implementation in this function.

---

## 5) Operational Validation Checklist

When testing `/api/podcast/idea/enhance`:

1. Verify request log and auth token attachment in frontend.
2. Verify backend log shows:
   - `[llm_text_gen][flow_type=premium_tool] Using provider=huggingface, model=openai/gpt-oss-120b:groq`
3. Verify no SIF-specific low-cost model list is being used in this flow.
4. Verify no repeated broad fallback cascades unless explicitly configured.
5. Verify podcast bible generation does not crash and gracefully falls back to defaults if onboarding payload is malformed.

---

## 6) Consolidation Next Steps

1. **Centralize routing policy constants**
   - define premium defaults and SIF defaults in one module
   - avoid drift from scattered hardcoded model strings

2. **Add explicit `route_intent` enum (optional)**
   - `premium_tool`, `sif_local_first`, `sif_remote_fallback`
   - reduce ambiguity vs inferred behavior

3. **Add unit tests for routing matrix**
   - test combinations of:
     - `GPT_PROVIDER`
     - `preferred_provider`
     - `preferred_hf_models`
     - key presence/absence

4. **Add structured log fields**
   - `route_intent`, `provider_selected`, `model_selected`, `fallback_count`
   - easier production RCA

5. **Document model availability assumptions**
   - account-level HF router model availability differs across keys/orgs
   - include fallback policy per environment (dev/staging/prod)

---

## 7) Practical Rule of Thumb

- If the caller is a **premium AI tool**: call with premium provider intent and avoid SIF low-cost list.
- If the caller is **SIF/agent**: local-first, then explicitly pass low-cost remote fallback list.
- Keep these paths separate in code and logs.
