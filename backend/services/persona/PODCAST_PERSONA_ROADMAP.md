# Podcast Persona — Roadmap (deferred Phase 4)

## Status

Podcast is **enabled + scheduled** in the persona platform registry, and its
persona is currently generated via the **generic** platform-adaptation path
(`CorePersonaService._generate_single_platform_persona` → `PersonaPromptBuilder.build_platform_adaptation_prompt`).
Constraints already live in `platform_registry.PLATFORM_CONSTRAINTS["podcast"]`
(episode structure, host tone, pacing, audio/video optimization, thumbnail/
title/description rules, CTA).

## Why a dedicated service is deferred (and why it may be needed later)

Podcast is **audio/video-oriented, not text**. The generic `build_platform_adaptation_prompt`
produces a *writing* persona and does not capture show-format, pacing, host
voice, segment structure, or audio/visual production rules well. The current
generic output is a stopgap until quality is validated.

## Existing podcast-related code (research notes)

- `api/podcast/presenter_personas.py` — hardcoded **presenter personas** (avatar
  styling presets: `global_corporate`, `india_corporate`, etc.). These are for
  avatar *image* generation only, NOT a brand-aligned writing/show persona.
  Left as-is.
- `models/podcast_bible_models.py` — the "podcast bible" (show concept doc) has a
  "host persona" section, but is not derived from the onboarding core persona.

## Planned work (dedicated `PodcastPersonaService`)

Mirror `LinkedInPersonaService` / `FacebookPersonaService`:

- `backend/services/persona/podcast/podcast_persona_service.py`
- `podcast_persona_prompts.py` (or `_schemas.py`) — a podcast-specific prompt +
  JSON schema capturing: show format, episode structure (hook/intro/segments/
  outro/CTA), host tone + pacing, audio optimization (intro music, sound design),
  video optimization (presenter framing, b-roll, on-screen text), title/
  description/thumbnail rules.
- Wire `CorePersonaService._generate_single_platform_persona` to short-circuit
  `"podcast"` → `PodcastPersonaService` (like linkedin/facebook).

## Acceptance criteria

- Podcast persona output includes audio/video/show-format fields (not just prose
  writing-style fields).
- Generated + persisted via the same `PersonaDataService.save_platform_persona`
  path used by the generic scheduler / on-demand endpoint.
