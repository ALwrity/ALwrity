"""Resolve the curated persona context for content generation (Phase C.1).

Turns a user's onboarding persona (PersonaData table, or the flat-context
snapshot) into a compact, platform-scoped brand-voice block that content
generation can inject as a system-prompt style layer — so the user never has
to re-enter tone/audience/platform, and the brand voice stays consistent.

Data sources (in order): PersonaData table (DB) → flat context
(``step4_persona_data.json``). SIF semantic retrieval is a later phase.

This function never raises — it returns ``""`` on any lookup failure so
callers can safely fall back to their existing persona path.

=============================================================================
DESIGN INTENT (why this whole persona/SIF effort exists)
=============================================================================
Onboarding is a one-time, multi-step process that captures the user's brand
voice (tone, audience, go-to phrases, platform conventions). Content
generation happens every day. The goal: make ALwrity hyper-personalized and
contextual for non-technical content creators / digital marketers.

  * Abstract prompting — the user types only their topic + keywords; the
    platform auto-injects tone/audience/platform from the onboarding persona,
    so they never re-enter those fields and never prompt-engineer.
  * Brand consistency — the persona constrains HOW the brand writes (style),
    never WHAT it writes (topic). Topic/keywords stay user-driven.

The system-prompt / user-prompt split preserves per-topic creativity:
  * system (style layer): brand voice — tone, phrases, sentence style.
  * user  (content layer): topic, keywords, audience-for-this-piece.
We inject the persona ONLY into the style layer, never the topic.

=============================================================================
PHASE 0 — CONTRACT (the single source of truth)
=============================================================================
PersonaData is the ONLY persona store. get_persona_context_for_generation is
the shared synthesis. Precedence when merging sources: persona (curated) >
website_analysis (raw crawl) > research_preferences (user-selected), with
provenance tracked. The legacy WritingPersona / "canonical profile" brand_voice
are NOT authoritative and are scheduled for retirement (see PHASE MAP).

=============================================================================
PHASE MAP
=============================================================================
0   Contract (this note)                                             (agreed)
A   SIF persona indexing            services/intelligence/sif/_sync.py            (done)
A2  SIF trigger after persona gen   onboarding_task_scheduler._sync_persona_to_sif
                                   + platform_persona_scheduler + step_management
                                   service._save_persona_data                    (done)
B   Curated extractor             services/persona/persona_context.py           (done)
C.1 Resolver                      this module                                   (done)
C.2 LinkedIn post injection       linkedin/.../post_prompts.py +
                                  linkedin/content_generator.py                 (done)
C.3 Blog content injection        blog_writer/content/medium_blog_generator.py  (done)
C.2/3 follow-ups (LinkedIn article/carousel/video builders; blog
     outline/research/SEO) — NOT wired. grep "PHASE C FOLLOW-UP" for the
     exact points + instructions.
D   Agent-facing semantic retrieval — NOT wired. grep "PHASE D FOLLOW-UP"
     (services/intelligence/sif/_context.py get_step4_persona_context query).
E   Brand Brain enrichment (canonical_profile.persona + brand_voice):
      E.1  rebuild trigger + TTL                                      (done)
      E.2  structured persona + brand_voice blocks + verbatim
           platform_personas (E.2b)                                   (done)
      E.3  batch 1 (strategy_service)                                 (done)
      E.3  rest + E.4 (delete legacy writing_tone/voice + WritingPersona)
                                                                      (deferred)
      Authoritative spec: docs/Content strategy/phase-e-brand-brain-persona-contract.md
      Per-consumer markers: grep "# E.3 (deferred)".
      NOTE: brand_voice is now the SINGLE voice field (persona-or-website, §2.2);
      "precedence" was retired in favor of "distinct facts resolved, with provenance."
============================================================================
"""

from typing import Dict, Optional

from loguru import logger

from services.persona.persona_context import get_persona_context_for_generation


def resolve_persona_context(user_id: str, platform: Optional[str] = None) -> str:
    """Return the curated brand-voice block for user+platform, or '' if none."""
    try:
        persona = _load_persona_data(user_id)
    except Exception as e:  # defensive: never break generation
        logger.warning(f"resolve_persona_context failed for {user_id}: {e}")
        return ""
    if not persona:
        return ""
    return get_persona_context_for_generation(persona, platform)


def _load_persona_data(user_id: str) -> Optional[Dict]:
    # 1. PersonaData table (source of truth)
    try:
        from services.persona_data_service import PersonaDataService
        persona = PersonaDataService().get_user_persona_data(user_id)
        if persona and persona.get("core_persona"):
            return persona
    except Exception as e:
        logger.warning(f"Persona DB lookup failed for {user_id}: {e}")

    # 2. Flat context (snapshot, no DB round-trip)
    try:
        from services.intelligence.agent_flat_context import AgentFlatContextStore
        persona = AgentFlatContextStore(user_id).load_step4_persona_data()
        if persona and persona.get("core_persona"):
            return persona
    except Exception as e:
        logger.warning(f"Persona flat-context lookup failed for {user_id}: {e}")

    return None
