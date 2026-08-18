# Phase E — Brand Brain Persona Enrichment: Contract (E.0)

Status: **agreed, no code yet.** This is the spec that E.1 → E.4 implement against.

Goal: make `canonical_profile` (the Brand Brain) carry the **curated persona voice** instead of the raw website crawl, and fix the staleness bug that freezes the profile after first build.

---

## 1. Design principles (non-negotiable)

1. **`PersonaData` is the SSOT for persona/voice facts only** — `persona`, `brand_voice`, `platform_personas` (core_persona + platform_personas + quality_metrics). `canonical_profile` is a **synthesis** (a consumer, never a duplicate store) whose per-field sources-of-record are designated in §3. It is **not** a blanket SSOT for the whole Brand Brain.
2. **Structured only.** No prose is stored in the profile. Prose is rendered on-demand via `get_persona_context_for_generation` (pure, tested). Storing prose would create a second, staleable representation.
3. **Additive first.** Add `persona` + `brand_voice` blocks; keep legacy `writing_tone/voice/complexity/engagement` untouched until consumers migrate (E.3); retire them last (E.4).
4. **Provenance on every field** (extend the existing `sources` dict).
5. **Source-of-record per field — no precedence.** Each field of `canonical_profile` has exactly one designated source, chosen by design and recorded in `sources`. No read-time fallback chain (see §3). The only conditional is data-availability (persona vs. no-persona), which resolves to a single source, never a chain. The E.3 `writing_tone` fallback is a temporary migration shim, removed in E.4.

---

## 2. Target schema — additive blocks

### 2.1 `canonical_profile.persona` (structured, compact summary)

A **condensed** copy of `PersonaData` — only fields strategy/calendar actually consume. Provenance: `sources.persona = "persona_core"`.

```jsonc
"persona": {
  "identity": {
    "persona_name":            "string",
    "archetype":               "string",
    "core_belief":             "string",
    "brand_voice_description": "string"
  },
  "tonal_range": {
    "default_tone":      "string",
    "permissible_tones": ["string"],
    "forbidden_tones":   ["string"],
    "emotional_range":   "string"
  },
  "linguistic_fingerprint": {
    "go_to_phrases":     ["string"],   // lexical_features.go_to_phrases
    "go_to_words":       ["string"],   // lexical_features.go_to_words
    "avoid_words":       ["string"],   // lexical_features.avoid_words
    "vocabulary_level":  "string",     // lexical_features.vocabulary_level
    "storytelling_style":"string"      // rhetorical_devices.storytelling_style
  },
  "stylistic_constraints": {
    "punctuation": { "ellipses": "string", "em_dash": "string", "exclamation_points": "string" },
    "formatting":   { "paragraphs": "string", "lists": "string", "markdown": "string" }
  },
  "platform_personas": {
    // Verbatim mirror of PersonaData.platform_personas (E.2b). NO normalization:
    // survey confirmed no consumer reads a uniform platform slice from
    // canonical_profile (existing readers use raw `persona_data`). Lossless copy
    // preserves the SSOT exactly and carries zero derive-risk.
  },
  "quality_metrics": { "overall_score": "number" }   // PersonaData.quality_metrics
}
```

`evidence` / `what_was_missing` / `confidence` from the core persona are **excluded** (audit meta, not brand voice).

Naming note: `persona.platform_personas.<platform>.target_audience` (platform-specific; `PersonaData`-sourced) is a **different fact** from the top-level `canonical_profile.target_audience` / `business_info.target_audience` (business-level; `ResearchPreferences`-sourced per §3). Same key name in different namespaces, different sources-of-record — do not read one as the other.

### 2.2 `canonical_profile.brand_voice` — the SINGLE voice field (structured, NOT prose)

One voice field, sourced **persona-or-website** at build time. This is the "one voice field" fix — after E.4 there is **no** separate `writing_tone/voice`:

- persona user → `brand_voice` built from `PersonaData` (source `persona_core`).
- no-persona user → `brand_voice` built from `website_analysis.writing_style` (source `website_analysis`).

Recorded in `sources.brand_voice` (dynamic). The shape is the persona shape; the website source is **mapped into it** (explicit mapping, not a guess):

| website `writing_style` | → `brand_voice` | note |
|---|---|---|
| `tone` | `default_tone` | direct |
| `voice` | `voice_description` | direct |
| `complexity` | `vocabulary_level` | lossy (closest equivalent) |
| `engagement_level` | *(dropped)* | **DECISION:** no persona equivalent — not carried into the unified field |

```jsonc
"brand_voice": {
  "default_tone":        "string",   // persona.tonal_range.default_tone  OR  website.writing_style.tone
  "voice_description":   "string",   // persona.identity.brand_voice_description  OR  website.writing_style.voice
  "go_to_phrases":       ["string"], // persona only (empty for no-persona)
  "avoid_words":         ["string"], // persona only (empty for no-persona)
  "vocabulary_level":    "string",   // persona.lexical_features.vocabulary_level  OR  website.writing_style.complexity
  "emotional_range":     "string"    // persona.tonal_range.emotional_range  (no website equivalent)
}
```

Prose is rendered from this unified `brand_voice` on-demand (see §7), **not** from raw `PersonaData` — so no-persona users still get prose.

---

## 3. Source-of-record per field

Two things used to be conflated under "precedence":

1. **Read-time fallback chain** — a consumer trying source A, then B, then C for the *same field*. This is the anti-pattern and must not exist: consumers read the **single stored** `canonical_profile` value.
2. **Build-time resolution of distinct facts** — for `industry` and `target_audience`, two *different* facts resolve into one downstream field: crawl-inferred vs user-stated (`WebsiteAnalysis` vs `ResearchPreferences`), and raw crawl vs curated persona (for voice). The builder picks the authoritative one (explicit > inferred; curated > raw) and records the winner in `sources`. This is **not** a fallback — it's the correct resolution of two distinct facts into one resolved value with provenance.

End-state: **one stored value per field (read time); distinct facts resolved into one value at build time, with precedence + provenance.** No read-time chain; no "fallback" — just "which distinct fact wins."

| Fact | Source-of-record | `sources` key |
|---|---|---|
| `persona` (identity/tonal/linguistic/stylistic) | `PersonaData` only — **absent** if no persona | `persona` |
| `brand_voice` | persona-or-website (see §2.2) | `brand_voice` |
| platform_personas | `PersonaData.platform_personas` only | `platform_preferences` |
| industry | primary `WebsiteAnalysis` (`industry_focus`); if absent `ResearchPreferences` | `industry` |
| content_types | `ResearchPreferences` | `content_types` |
| brand colors / values | `WebsiteAnalysis.brand_analysis` | `brand_identity` |
| target_audience | primary `ResearchPreferences`; if absent `WebsiteAnalysis` | `target_audience` |
| seo_profile / strategy_insights | `WebsiteAnalysis` | `seo_profile` / `strategy_insights` |
| research_depth / auto_research | `ResearchPreferences` | `research_preferences` |
| writing_tone/voice/complexity/engagement | *(legacy store — untouched until E.4, then deleted)* | `writing_tone` |

Notes:

- `brand_voice` is the **single** voice field (persona-or-website per §2.2). It is never a fallback *chain* — the source is chosen at build time and recorded.
- `industry` and `target_audience` resolve **two distinct facts** (crawl-inferred vs user-stated) into one field. `target_audience` → `ResearchPreferences` (explicit) wins over `WebsiteAnalysis` (inferred); `industry` → `WebsiteAnalysis` (crawl; the persona has no `industry` field) wins over `ResearchPreferences`. The winning source is recorded in `sources.*`; consumers never re-derive it.

### The `brand_voice` source rule (unified field)

`brand_voice` is the **single** voice field, present for **both** persona and no-persona users:

- persona user → `brand_voice` from `PersonaData`, `sources.brand_voice = persona_core`.
- no-persona user → `brand_voice` from `website_analysis.writing_style`, `sources.brand_voice = website_analysis` (mapped per §2.2).

The legacy `writing_tone/voice` field is a **temporary** second copy that exists only during E.3 migration; E.4 deletes it, leaving `brand_voice` as the sole voice field.

---

## 4. Rebuild trigger (E.1 — implement first, independent of schema)

Current bug: `get_integrated_data_sync` (`data_integration.py:80-83`) returns the cached `canonical_profile` with **no TTL**; `refresh_integrated_data` (`:148`) calls that sync method, so it **re-caches the stale profile instead of rebuilding**.

Fix + hook points:

1. **Fix `refresh_integrated_data`** to rebuild fresh — route it to `process_onboarding_data` (or a new `_rebuild_and_store` that always calls `_build_canonical_profile`), never the cache-aware sync method.
2. **Add a TTL** to the sync cache path (mirror the 24h check already in `get_integrated_data` at `:1271`).
3. **Trigger fresh rebuild after persona changes**, in:
   - `step4_persona_routes._save_persona_data` (full sync + async generation, and `persona-save` edit endpoint).
   - `step4_persona_routes.generate_platform_persona` (on-demand "Generate Now"), after `save_platform_persona`.
   - `platform_persona_scheduler.generate_platform_persona_task` (background facebook/twitter/instagram/youtube/podcast), after `save_platform_persona`.

---

## 5. Consumers to migrate (E.3 — "read `canonical_profile` only")

Goal: every consumer routes through `canonical_profile` (structured → `brand_voice`/`persona` dict; prompt → prose rendered from the unified `brand_voice`, §7) — never reading a raw onboarding source directly. Three groups:

**A. Structured consumers — switch from legacy `writing_tone/voice` to `brand_voice` (dict):**
- `services/product_marketing/personalization_service.py`
- `services/product_marketing/brand_dna_sync.py`
- `services/research/research_persona_service.py`
- `api/story_writer/routes/story_setup.py`
- `api/content_planning/services/ai_analytics_service.py`
- `services/calendar_generation_datasource_framework/data_processing/comprehensive_user_data.py`
- `services/agent_framework.py` + `services/intelligence/agents/core_agent_framework.py`
- `services/strategy_copilot_service.py`
- ✅ `api/content_planning/services/content_strategy/core/strategy_service.py` (done — batch 1)

**B. Prompt consumers — render prose from unified `brand_voice`, not raw `PersonaData`:**
- `services/product_marketing/prompt_builder.py`
- `services/product_marketing/intelligent_prompt_builder.py`
- `services/campaign_creator/prompt_builder.py`

**C. Raw-source readers that bypass `canonical_profile` entirely (fold in — NOT in the original `writing_tone` list):**
- `services/product_marketing/brand_dna_sync.py` — reads raw `persona_data.get('platformPersonas')` (camelCase) → route via `canonical_profile.persona.platform_personas` (verbatim) + fix case.
- `services/campaign_creator/prompt_builder.py` — reads raw `persona_data.get('platformPersonas')`.
- `api/content_planning/services/content_strategy/autofill/persona_normalizer.py` — reads raw `persona_data` (`platform_personas`/`platformPersonas`).
- `api/content_planning/services/content_strategy/autofill/transparency.py` — reads raw `persona_data` (`platform_personas`).

(No change: `api/research_config.py` — `industry`/`target_audience` already routed via `canonical_profile`.)

---

## 6. Retire list (E.4 — the step that removes the fallback)

E.4 deletes the legacy voice store so there is **nothing left to fall back to** — this is what makes the read-time SSOT final. Order matters: `brand_voice` must already be the unified persona-or-website field (§2.2) **before** the legacy fields are deleted, or no-persona users lose their voice.

1. `canonical_profile.writing_tone/voice/complexity/engagement` — deleted **only after** `brand_voice` is unified (persona-or-website, §2.2).
2. `WritingPersona` / `PlatformPersona` / `EnhancedWritingPersona` models (`models/persona_models.py`, `models/enhanced_persona_models.py`). Deleting `EnhancedWritingPersona` requires first deleting the legacy half of `persona_quality_improver.py` (object methods `assess_persona_quality` / `improve_persona_from_feedback` / `learn_from_content_performance` + their `_assess_*`/`_apply_*` helpers query it; keep the migrated `_comprehensive`/`_dict` half).
3. `PersonaAnalysisService` (deprecated; `services/persona_analysis_service.py`).
4. `_generate_persona_from_onboarding` (`onboarding_completion_service.py:392-435`).
5. Legacy consumers (all `get_persona_for_platform` / `get_user_personas` / legacy-model readers — 8 backend files + frontend):
   - `services/persona_replication_engine.py` (2 sites)
   - `services/linkedin/content_generator.py` (delete legacy fetch; keep C.2 prose path)
   - `services/linkedin_comment_assistant_draft_service.py` (+ fix `_resolve_industry` → read `canonical_profile.industry`, not `core_persona.industry`)
   - `api/facebook_writer/services/base_service.py`
   - `api/persona_routes.py` (via replication engine)
   - `api/persona.py` (producer + `get_user_personas` + 4 injected endpoints)
   - `alwrity_utils/health_checker.py` (`session.query(WritingPersona).first()`)
   - `services/persona/persona_quality_improver.py` (legacy half)
   - frontend `PlatformPersonaProvider.tsx`

---

## 7. Sequencing + status

```
E.1  rebuild trigger + TTL                              ✅ done
E.2  persona + brand_voice blocks (structured mapper)   ✅ done (incl. verbatim platform_personas)
E.3  route consumers through canonical_profile only     ⏸ batch 1 done (strategy_service); batches 2–4 deferred
E.4  delete legacy voice store (removes the shim)       🔨 in progress — Phases 1–6 done, 7 (E2E gate) pending
```

`E.2`'s structured mapper is **independent of `persona_context.py`** (the prose renderer); both derive from the same `PersonaData`.

### E.4 status — Phases 1–6 done (uncommitted on `main`)

| Phase | Scope | Status |
|---|---|---|
| 1 | Migrate 5 `get_persona_for_platform` consumers → `PersonaDataService` | ✅ done |
| 2 | `api/persona.py`: retire producer + legacy endpoints + `PersonaAnalysisService` dep | ✅ done |
| 3 | Remove `_generate_persona_from_onboarding` producer (`onboarding_completion_service.py`) | ✅ done |
| 4 | `health_checker.py` + `persona_quality_improver.py` legacy half | ✅ done |
| 5 | Frontend `PlatformPersonaProvider.tsx` | ✅ done |
| 6 | Delete `models/persona_models.py`, `models/enhanced_persona_models.py`, `services/persona_analysis_service.py` | ✅ done |
| 7 | E2E gate (LinkedIn write, Facebook write, comment industry, replication, health check) | ⏳ pending |

**Phase 1 regressions caught + fixed before Phase 2:**
- Article path (`generate_grounded_article_content`) was silently losing its persona after `_get_cached_persona_data` returned `None`; wired it to C.2 `persona_context` (mirrors the post path), so `ArticlePromptBuilder.build_article_prompt` now prefers the curated brand-voice block.
- `linkedin_comment_assistant_draft_service._load_persona` was coercing `user_id` to `int` before `PersonaDataService.get_platform_persona` (which queries a String `OnboardingSession.user_id` column); now passes the string `user_id` verbatim.

**Phase 2 detail:** removed `generate_persona` (legacy producer), `validate_persona_generation_readiness`, `generate_persona_preview`, the `get_persona_service` dependency, the unused `PersonaAnalysisService` injection on the 4 validate/optimize endpoints, and the now-dead `PersonaManagementService` class. The wrapper chain itself (`onboarding_endpoints.py` → `endpoints_config_data.py`) is still live — only its **4 legacy persona re-exports** (`check_persona_generation_readiness`, `generate_persona_preview`, `generate_writing_persona`, `get_user_writing_personas`) were dropped, since none were routed (frontend uses the `/step4/*` flow). `api/persona.py` no longer imports `PersonaAnalysisService`.

**Phase 3 detail:** removed `_generate_persona_from_onboarding` (the last live `PersonaAnalysisService` importer) from `onboarding_completion_service.py`. `complete_onboarding` now derives `persona_generated` from `PersonaDataService().get_user_persona_data(user_id) is not None` (the SSOT `PersonaData` store) instead of firing the legacy `WritingPersona` producer — persona is already generated at Step 4, so completion just reports it. `PersonaAnalysisService` now has **zero live importers** (only its own definition + harmless comments/docstrings/logger config remain for Phase 6). Note: `regression_onboarding_completion_service.py` is a stale standalone harness (not in `tests/`; `pytest.ini` sets `testpaths = tests`) whose deep-competitor assertion tests behavior that moved to `onboarding_task_scheduler.py`, and it fails in isolation due to global `sys.modules` clobbering — both pre-existing, out of E.4 scope.

**Phase 4 detail:** `alwrity_utils/health_checker.py` `database_health_check` now verifies the SSOT `OnboardingSession` + `PersonaData` tables (from `models.onboarding`) instead of the legacy `WritingPersona`/`PlatformPersona`/`PersonaAnalysisResult`/`PersonaValidationResult` tables. `services/persona/persona_quality_improver.py` had its legacy object-method half deleted (`assess_persona_quality`, `improve_persona_from_feedback`, `learn_from_content_performance` + their `_assess_*`/`_apply_*`/`_save_*` helpers that queried `EnhancedWritingPersona`/`PersonaQualityMetrics`/`PersonaLearningData`), leaving only the migrated dict-based `_comprehensive`/`_dict` methods (`assess_persona_quality_comprehensive`, `improve_persona_quality`) that `step4_persona_routes` and `linkedin_strategy` already use. The `models.enhanced_persona_models` import was removed. After Phase 4, the only live importers of the legacy model files are `services/persona_analysis_service.py`, `services/database/init_db.py`, and `alembic_migrations/env.py` — all removed/updated in Phase 6.

**Phase 5 detail (frontend):** `PlatformPersonaProvider.tsx` already read the SSOT API (`getUserPersonas`/`getPlatformPersona` → `PersonaData` format); the remaining "legacy" was the `WritingPersona`/`PlatformAdaptation` TS type modeling (mirroring the DB models deleted in Phase 6). Retired those types in `types/PlatformPersonaTypes.ts`, replacing them with SSOT-aligned `CorePersona`/`PlatformPersona` (same flattened consumer-facing fields, legacy-only fields dropped), and updated the provider + the two type importers (`PersonaContext/index.ts`, `CopilotKit/PlatformPersonaChat.tsx`). Also removed the dead `api/persona.ts` functions `checkPersonaReadiness`/`generatePersonaPreview`/`generateWritingPersona` (hit nonexistent/removed endpoints) and the orphaned `OnboardingWizard/PersonaGenerationStep.tsx` (the live Step 4 flow is `OnboardingWizard/PersonaStep/`). Verified with `npx tsc --noEmit` (exit 0).

**Phase 6 detail (delete):** deleted `services/persona_analysis_service.py`, `models/persona_models.py` (`WritingPersona`/`PlatformPersona`/`PersonaAnalysisResult`/`PersonaValidationResult`), and `models/enhanced_persona_models.py` (`EnhancedWritingPersona`/`EnhancedPlatformPersona`/`PersonaQualityMetrics`/`PersonaLearningData`). Removed the bare `import models.persona_models` / `import models.enhanced_persona_models` lines from `services/database/init_db.py` and `alembic_migrations/env.py` (so `Base.metadata` no longer registers the retired tables — `create_all` only ever adds, never drops, so existing DBs keep their old tables). Cleaned `logging_config.py` (dropped `persona_analysis_service` logger) and `app.py` (stale comment). Verified zero live references to any legacy model class and 143 persona/blog_writer/onboarding tests pass. The `regression_onboarding_completion_service.py` mock was already swapped to `persona_data_service` in Phase 3, so no `PersonaAnalysisService` text remained there.

### E.3 status — paused after batch 1 (test before proceeding)

`strategy_service.py` (batch 1) is migrated. Its "fall back to `extract_brand_voice_from_guidelines`" is the **migration shim**, not the end-state — it dies at E.4, after which consumers read `canonical_profile.brand_voice` only.

**Remaining consumers are `# E.3 (deferred)`-marked in code** (full list in §5). Corrected framing:

| Class | Migrate to |
|---|---|
| **Structured** (map to model fields) | read `canonical_profile.brand_voice` (dict) only |
| **Prompt** (inject prose) | render prose from the **unified `brand_voice`** (§2.2), not raw `PersonaData` |
| **Raw readers** (bypass canonical_profile) | route via `canonical_profile.persona.platform_personas` (verbatim) |

**Prose renderer consequence (refinement #2):** the prose path must also become persona-or-website. Today `resolve_persona_context` / `get_persona_context_for_generation` read raw `PersonaData`, which is absent for no-persona users — so after E.4 they'd have no prose source. The renderer must accept the unified `brand_voice` (or gain a no-persona branch). This is a **known E.4 consequence**, not a surprise.

**OPEN DECISION (resolve before batch 2):** for the *prompt* class, render prose from the unified `brand_voice` via the on-demand renderer (Option A, recommended) vs an inline render of the flat `brand_voice` dict (Option B).

Rules to honor when resuming:
1. Block-level switch (whole block, never per-field).
2. Website→`brand_voice` mapping + `engagement_level` drop are locked in §2.2.
3. Persona/voice lands in the style/system layer, never the topic/user layer.
4. Route through `canonical_profile` only — no raw-source reads (the "fall back to own source" is the migration shim, removed at E.4).
5. Fold `brand_dna_sync.py` `platformPersonas`→`platform_personas` as a separate labeled commit.

---

## 8. Known gaps / follow-ups (written down, not chat-only)

1. **LinkedIn-onboarding industry is not wired.** `_build_canonical_profile`'s `industry` value derivation reads only `website_analysis.target_audience.industry_focus` → `research_preferences.target_audience.industry_focus`. It never reads `linkedin_profile.industry` (the profile's industry), even though the old `sources` dict had a dead `linkedin_profile` branch. For LinkedIn onboarding (no website), `industry` will be `None`. Fix: wire `linkedin_profile.industry` into the value derivation, with `sources.industry = 'linkedin_profile'`. Separate ticket, out of E-scope.

2. **`PersonaData.to_dict()` vs camelCase readers.** Some legacy consumers read `persona_data.get('platformPersonas')` (camelCase) while `PersonaData.to_dict()` emits `platform_personas` (snake_case) — see `brand_dna_sync.py:98` vs `:199`. This is a pre-existing case-mismatch that silently yields `{}`. Verify and align during E.3 when those consumers are migrated.

3. **Onboarding FinalStep summary reads legacy `core_persona` field names (post-E.4 follow-up).** `onboarding_summary_service.py:_get_personalization_settings` (`:126-129`) read `core_persona.writing_style` / `.target_audience` / `.brand_voice` / `.tone`, none of which the SSOT `PersonaData.core_persona` (`identity.{archetype, brand_voice_description}`, `tonal_range`, `linguistic_fingerprint`, `stylistic_constraints`) produces — so `personalization_settings` silently fell back to defaults. **FIXED**: the method now reads `identity.brand_voice_description` + `tonal_range.default_tone` and pulls `writing_style`/`target_audience`/`content_focus` from `research_preferences` (the correct source). Also fixed `persona_quality_improver._assess_platform_consistency` to a tone-based check instead of the retired `brand_voice.keywords` overlap (which always scored 0). Tests: `tests/services/test_persona_schema_migration.py`. Remaining legacy-schema reader (out of scope, already `# E.3 (deferred)`-marked in code): `content_strategy/autofill/normalizers/persona_normalizer.py` reads many legacy `core_persona` field names (`archetype`, `tone`, `demographics`, …) and needs the full E.3 canonical-profile route-through, not a one-liner.
