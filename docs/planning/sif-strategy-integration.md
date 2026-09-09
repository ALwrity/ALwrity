# SIF × Content Strategy Integration — Understanding & Design Plan

**Scope (as user asked):** Focus only on understanding the SIF and designing its integration with the activated content strategy. The auto-filled form will be indexed *only* at the same lifecycle stage as the activated strategy. No implementation yet — review, design, get it right.

---

## 1. What SIF is (verified against code)

- **Layer**: `backend/services/intelligence/` (20 files, 1,022 LoC core).
- **Engine**: `TxtaiIntelligenceService` (txtai_service.py, 968 LoC) — per-user FAISS index persisted to disk (`self.index_path`), wrapped behind `_ensure_initialized_async`. Public API: `index_content(items)` (line 450) takes `List[(id, text, metadata)]` and upserts via `self.embeddings.upsert(processed_items)`; `search(query, limit)` (line 609) returns scored hits.
- **Singleton**: `sif_singleton.py:get_singleton(user_id)` — per-user instance cache; auto-cleanup on user count pressure (`sif_singleton_cleanup.py`).
- **Integration service**: `SIFIntegrationService` (sif_integration.py, 32.9KB) — orchestrator over txtai + `SemanticCacheManager` + `SemanticHarvesterService` + SIF agent team; exposes `get_seo_dashboard_context`, `get_seo_context`, etc.
- **Idempotency model**: `SIFIndexingWatermark` (models/sif_indexing_watermark.py) — `(user_id, source_id)` with `source_hash`, `embedding_count`, `indexed_at`; helpers `is_fresh(session, user_id, source_id, source_hash)` and `get_indexed_source_ids`. This is the central dedupe gate.
- **Agents**: `SifGuardian` (ContentGuardianAgent re-exported) — used by `sif_release_readiness_checks.py` for `verify_originality`. Other agents live in `sif_agents.py` and `agents.py`.
- **VFS flat-file context**: `AgentContextVFS` and `AgentFlatContextStore` (agent_context_vfs.py, agent_flat_context.py — 35KB each) — per-user workspace filesystem with `write_context_file`, `write_shared_note`, `read_struct`, `search_context`. This is the "VFS flat file context in the onboarding" the user mentioned.
- **Content strategy ↔ SIF bridge that already exists**: `sif_integration.py:504` calls `self.strategy_agent.analyze_content_strategy(website_data)` — the "thin shim" for legacy code. New integration should follow the same pattern but for the *generated* strategy (not website_data).

## 2. The content strategy lifecycle (verified against code)

- **Created**: `strategy_crud.py:69` `create_enhanced_strategy` — returns DB row with `comprehensive_ai_analysis`, `ai_recommendations` (JSON).
- **Persisted**: `strategy_generator.py:913-919` saves `comprehensive_ai_analysis = comprehensive_strategy` to the DB row.
- **List/Read**: `strategy_wizard_endpoints.py:198 get_latest` returns `active_strategy_id` and `is_active`. `strategy_crud.py:131 get_enhanced_strategies` lists.
- **Activate (single source of truth)**: `strategy_wizard_endpoints.py:217 activate_strategy` — writes ONE row to `strategy_activation_status` (user_id, strategy_id, status='active', activation_date, last_updated). Idempotent. 404/403 ownership checks. Clear cache afterwards.
- **Lives at**: a) DB row in `enhanced_content_strategies` (with `comprehensive_ai_analysis` JSON), b) one activation_status row, c) in-memory `latest_db_strategy` cache.
- **"Active" means**: the strategy at `strategy_activation_status.activation_date` = MAX(activation_date for user) is the one the user "activated". Tied to `onboarding._has_active_strategy`.

## 3. Existing indexing sites (for pattern reuse)

The SIF already indexes several data sources. Mapping what the codebase does today:
- **Onboarding data**: `sif_integration.py` exposes `index_*` methods (e.g. `index_research_personalization`, `index_website_analysis`, `index_pillar_competitors`, `index_user_data`). These wrap the agent team and call `intelligence_service.index_content([...])`.
- **Content strategy** (`sif_integration.py:504`): legacy `analyze_content_strategy(website_data)` — operates on the *website data used to generate* a strategy, not the *generated strategy itself*. This is the closest existing pattern but writes to SIF the inputs, not the outputs.
- **Calendar events**: not SIF — calendar is a separate pipeline.

## 4. What's missing — the gap SIF x content strategy

Right now, the activated content strategy lives only in the database (`enhanced_content_strategies.comprehensive_ai_analysis`). The user has 30+ LLM-generated fields (insights, competitive analysis, performance predictions, implementation roadmap, risk assessment) that **never reach the SIF brand brain**. This is the gap.

Consequences today:
- Other ALwrity agents (LinkedIn, podcast, blog writer) have no semantic access to the user's active strategy. They get only the raw onboarding data and re-derive.
- Originality checks (`SifGuardian.verify_originality`) don't see what the user has already committed to.
- Calendar generation has no semantic anchor to the strategy (per QA audit).
- The user's mental model of "my strategy" is stuck in the strategy tab; it's not queryable.

## 5. Design — content strategy SIF integration

### 5.1 Lifecycle gates (when to index) — DECIDED

**Single gate: G2 only. G1 is removed.**

You confirmed: the auto-fill values are not SSOT until activation. Before activation the end user can edit, reject, regenerate. So we index the **whole snapshot** at the moment of activation:

| Lifecycle stage | Indexes what? | Why |
|---|---|---|
| **G2. Strategy activation** (user clicks Activate after reviewing) | ONE frozen snapshot: the 30-field form_data (auto-filled, edited, final) + the 6 AI component outputs (insights, competitive, performance, roadmap, risk) + activation metadata | The "approved" strategy is the contract. Other agents must consume the approved version, not the draft. The form and the outputs are indexed together as one atomic snapshot. |
| **NOT indexed**: any intermediate state (generating, polling, draft preview before activation) | — | Avoid indexing half-baked content; activation is the explicit user commitment. |
| **NOT indexed on auto-fill completion** | — | Auto-fill is editable; not yet SSOT. |

Implications:
- One index call per activation, not two.
- `strategy_id` is the snapshot key. If the user activates a different strategy later (re-activation with a new `strategy_id`), the old one is **out of scope** per Q2.
- `source_hash` = sha256(canonical json of {form_data, all 6 AI components, activation metadata}).

### 5.2 Source identity & dedupe — DECIDED (single active strategy only)

- `source_id` (the dedupe key in `SIFIndexingWatermark`) is simple, stable, namespaced:
  - **Form + outputs together**: `user:{user_id}:strategy_active:current` — the ONE active strategy snapshot (form_data + all 7 chunks: 6 AI components + form summary; all under this single parent source_id).
  - **VFS marker**: `user:{user_id}:strategy_vfs:current` — companion VFS path.
  - Both use `is_fresh(user_id, source_id, source_hash)` → skip the upsert if the content didn't change.
- **No multi-strategy indexing** (Q2). Per your decision: "the activated content strategy is SSOT; once cannot change their strategy everyday. Having multiple strategy is a headache and we should not confuse the downstream agents." So:
  - Only the currently active strategy is indexed.
  - When the user activates a new strategy, the previous one is "stale" — the watermark's `is_active` flag flips or the old items are soft-deleted from the SIF index.
  - `source_id` has no per-strategy suffix; one user → one strategy snapshot at a time.
- **Why this shape**: avoids "confusing downstream agents" (your words); one SSOT; one search result; one canonical answer to "what is the user's current strategy".

### 5.3 Indexing content shapes (the textual payload) — DECIDED (single snapshot)

For the one index call at activation, build `List[(source_id, text, metadata)]` for `index_content`. The SIF is the per-user brand brain: the activated strategy is the contract, and other agents query it semantically.

**ONE composite source_id, SEVEN chunks (all share the same source_id `user:{user_id}:strategy_active:current`, distinguished by `kind` in metadata):**

- `kind=form_summary` — text: a single canonical string of the 30 form fields, formatted as `"{label}: {value}\n"` per line (so the embedding model has semantic structure, not a flat JSON blob). metadata `{kind: "form_summary", strategy_id, version, content_categories: [business_context, audience_intelligence, ...], onboarding_summary: {persona_role, industry, ...}}`
- `kind=strategic_insights` — text: the 5 insights serialized. metadata `{kind: "strategic_insights", strategy_id, generated_at, activation_date}`
- `kind=competitive_analysis` — same pattern
- `kind=performance_predictions`
- `kind=implementation_roadmap`
- `kind=risk_assessment`
- `kind=user_persona_digest` — canonical persona + voice (1-line per persona field, for fast retrieval by other agents)

**All 7 share the same source_hash** (computed from the union of form_data + all 6 AI outputs + activation metadata). So `is_fresh` on the parent source_id applies to the whole snapshot — re-activation with no change reuses the existing index (no re-embedding cost).

**Why 7 chunks, not 1 blob**: agents search by topic; splitting makes the FAISS index 7× richer semantically and lets `SifGuardian` originality checks compare component-by-component. Same parent source_id keeps dedup atomic.

### 5.4 Embedding & chunking policy

- `TxtaiIntelligenceService.index_content` already handles chunking (txtai's native semantic segmentation). We will NOT pre-chunk further — pass a single text per (id, metadata). The txtai layer's chunker is the canonical chunker.
- **Token budget**: cap each `text` to ~8k chars (txtai handles the rest). If the form's 30 fields explode, pre-trim the lowest-signal fields (e.g. notes) before the index call.
- **Embedding counts**: each index call records `embedding_count` in the watermark via `index_content` (already wired). Operators can monitor "did this activation actually index?" via watermark count > 0.

### 5.5 Failure & retry semantics

- **Atomicity**: indexing must be best-effort, NEVER block activation. Activation writes the DB row first; indexing runs in `asyncio.create_task` after the commit (same pattern used in `ai_generation_endpoints.py:1076` for the AI generation task).
- **Idempotency**: re-activation is already idempotent in the activation code (`strategy_wizard_endpoints.py:267` else-branch). The SIF index path mirrors this: if `is_fresh(...)` is True, we skip.
- **Retry**: 3-attempt exponential backoff (1s/2s/4s). After 3 failures, log + continue (no Sentry alert for SIF indexing — it's a brand enhancement, not critical path).
- **Partial failure**: if 5/6 components indexed, that's fine; the watermark records 5. The 6th can be re-indexed on next activation.
- **Observability**: log to SIF events (`_record_sif_event` in txtai_service.py:166) with outcome=success/failure, embedding_count, user_id, source_id.

### 5.6 SIF vs VFS flat-file — DECIDED (SIF canonical, VFS is human-readable audit) — and why

You accepted "SIF canonical + VFS debug view" but asked for the reasoning. Here it is.

**The two layers answer different questions:**

| Question | SIF (FAISS) | VFS (flat file) |
|---|---|---|
| "What does the user's strategy say semantically about X?" | ✅ nearest-neighbor search across ALL their strategy text | ❌ would need to grep or read whole file |
| "What is the exact value of strategy.field Y right now?" | ❌ returns chunks, not structured fields | ✅ parsed YAML/Markdown; single read |
| "Did the user approve this strategy?" (authorship / activation_status) | ✅ metadata.is_active=True | ❌ must be in the file (we put activation_date in header) |
| "Has anything in the strategy changed since last query?" | ✅ source_hash vs current hash | ❌ must diff full file |
| "Is this strategy grounded vs generic?" (SifGuardian) | ✅ semantic comparison vs corpus | ❌ needs embedding model |
| "Can a non-SIF-aware code path (e.g. CLI, migration) read it?" | ❌ requires SIF client | ✅ any `cat`/`open()` works |
| "What did the strategy look like 3 months ago?" (history) | ❌ we don't keep history (Q2) | ❌ same — we overwrite |
| "Can the user open it in Notion / share with a colleague / diff two strategies?" | ❌ opaque embedding space | ✅ plain markdown |

**Canonical hierarchy (single source of truth):**
- **The DB row in `enhanced_content_strategies.comprehensive_ai_analysis` is THE strategy.** Period.
- **SIF is a semantic-search projection of that row.** Agents query SIF, find the right chunk, then read the canonical fields from the DB or the SIF chunk's text. SIF is the "discovery" layer.
- **VFS is a human-readable rendering of that row.** It's the "what does the strategy look like as a document" view — for the user to open, for support to inspect, for a non-SIF-aware migration to read.
- **When you change the strategy (re-activate), the DB row is the new truth. SIF is re-indexed. VFS is rewritten. All three converge.**

**Why both, then:**
- SIF alone = agents can find, but humans cannot inspect. Support tickets become "I have no idea what the strategy says."
- VFS alone = humans can read, but agents must grep/read-everything to search. SifGuardian originality check is impossible.
- DB alone = no semantic discovery for agents; humans can use the UI to view, not the same as a document.

**The trigger to write to both is the same: activation (G2).** The VFS write is sync (small markdown render), the SIF write is async (txtai index). Same atomic boundary. On activation failure of SIF, VFS still succeeded — VFS is the backup. On VFS failure, SIF still succeeded — SIF is the backup. Both = best-of-both.

**Path of the VFS file**: `~/.alwrity/vfs/{user_id}/strategy/active.md` — a markdown rendering of `comprehensive_ai_analysis` with a header comment carrying `strategy_id`, `activation_date`, `version`. `AgentContextVFS.write_context_file` (verified at `agent_context_vfs.py:695`) does the write. `read_struct` exposes the structured fields.

### 5.7 Search contract for downstream consumers

After this lands, agents that want the user's current strategy do:
```python
hits = await sif.search("user's content strategy pillars", limit=5)
# hits[0].text is the form/component chunk, hits[0].metadata['kind'] = one of the 7 kinds
# hits[0].metadata['strategy_id'] is the single active strategy
# hits[0].metadata['is_active'] is True (all 7 chunks for the active strategy carry this)
```
- **Filter by metadata.kind**: agents narrow `kind in ("form_summary", "strategic_insights", "competitive_analysis", "performance_predictions", "implementation_roadmap", "risk_assessment", "user_persona_digest")` to focus.
- **One active strategy at a time**: there is no `strategy_id` multiplicity. The active strategy is whatever has the max `activation_date` for the user.
- **Freshness**: `SifGuardian` and other consumers call `SIFIndexingWatermark.get_indexed_source_ids(user_id, ["user:{uid}:strategy_active:current"])` to know "is this strategy indexed?" before searching.

### 5.8 Source ID naming — the only contract surface

Final naming convention (all values are strings; case-sensitive):
- `user:{user_id}:strategy_active:current` — the ONE active strategy snapshot (form + 6 AI components + persona digest, all under this single source_id; distinguished by `metadata.kind`)
- `user:{user_id}:strategy_vfs:current` — companion VFS marker (points to the flat-file path)

This is a stable contract: any code in ALwrity can read these without knowing the SIF internals. No per-strategy suffix because there is only one active strategy per user.

## 6. Test plan (TDD-first)

Single-gate design (G2 only). Tests reflect the ONE activation-time index call.

Unit tests:
- `test_strategy_indexer.py::test_form_text_shape` — form is serialized as `"{label}: {value}\n"` lines
- `test_strategy_indexer.py::test_strategy_chunk_count` — activated strategy produces 7 chunks (6 components + 1 form_summary) sharing one source_id
- `test_strategy_indexer.py::test_source_id_stability` — re-activation reuses same source_ids (idempotent, no per-strategy suffix)
- `test_strategy_indexer.py::test_watermark_fresh` — `is_fresh` returns True on identical content (same source_hash), False on edit
- `test_strategy_indexer.py::test_vfs_companion_written` — VFS `active.md` exists with activation_date header
- `test_strategy_indexer.py::test_failure_does_not_block_activation` — SIF index error → activation still 200, watermark not updated, VFS still written
- `test_strategy_indexer.py::test_old_strategy_overwritten_on_new_activation` — when user activates a new strategy, the old one's watermark is_fresh becomes False
- `test_strategy_indexer.py::test_only_one_active_strategy_indexed` — at any time, only one source_id `user:{uid}:strategy_active:current` is fresh per user

Integration test:
- `test_strategy_to_sif_e2e.py` — full path: create → autofill → edit → activate → assert SIF has 7 items with one source_id, VFS file written, activation 200

Observability:
- `is_fresh` returns True on re-activation with identical content → confirms dedupe
- Re-activation with form edit → new embeddings count delta

## 7. Phased implementation plan (review only, no code yet)

Single-gate design (G2 only). Simpler than the previous 8-phase plan. All phases in the activation hot-path.

Phase **SIF-A — Source ID contract + canonical text** (P0, S)
1. Define `source_id` constants in a single module (`sif_strategy_source_ids.py`): `active_strategy_id(user_id) -> str` returns `f"user:{user_id}:strategy_active:current"`.
2. `to_canonical(obj) -> str` helper that produces a deterministic JSON string for `source_hash` (used by the watermark).
3. `build_form_text(form_data) -> str` — serializes the 30 fields as `"{label}: {value}\n"` lines.

Phase **SIF-B — Indexer service** (P0, M)
1. New `services/intelligence/strategy_indexer.py` with:
   - `build_strategy_chunks(strategy_row) -> List[(source_id, text, metadata)]` — emits 7 items (form_summary + 6 AI components), all sharing one `source_id` and one `source_hash`.
   - `index_active_strategy(user_id, strategy_row) -> int` (counts upserted). Sync: builds the chunks, computes `source_hash`, checks `SIFIndexingWatermark.is_fresh(user_id, source_id, source_hash)`; if fresh, returns 0 (skip); else calls `intelligence_service.index_content(items)`.
   - `index_active_strategy_async(user_id, strategy_row)` — `asyncio.create_task` wrapper. Non-blocking.

Phase **SIF-C — VFS companion** (P0, S)
1. On activation (sync, before SIF), write `~/.alwrity/vfs/{user_id}/strategy/active.md` via `AgentContextVFS.write_context_file` (verified at `agent_context_vfs.py:695`).
2. Markdown content: header with `strategy_id`, `activation_date`, `version`; body: human-readable rendering of `comprehensive_ai_analysis`.
3. On new activation (overwrite semantics): same path, same file — old strategy is gone. This is correct per Q2: only one active strategy at a time.

Phase **SIF-D — Activation hook** (P0, S)
1. In `strategy_wizard_endpoints.py:activate_strategy`, **after** `db.commit()` and the existing cache-clear:
   a. Call `index_vfs_companion(user_id, strategy_row)` — sync; if it fails, log but don't fail the activation (we already returned 200).
   b. Schedule `asyncio.create_task(index_active_strategy_async(user_id, strategy_row))` — async; SIF failures logged + recorded in `_record_sif_event` with `outcome=failure`.
2. Activation is the ONLY trigger. Nothing else indexes.

Phase **SIF-E — Tests** (P0, M, TDD-first)
1. Unit + integration suite per §6. RED-first TDD. Use the same minimal_onboarding fixture pattern as existing autofill tests.
2. Verify `_record_sif_event` fires with `outcome=success` for full-path success and `outcome=failure` after max retries.
3. Verify SIF index is skipped when `is_fresh` returns True (no re-embedding).
4. Verify VFS file is written even when SIF fails (best-of-both per §5.6).
5. Verify old strategy is overwritten on new activation (Q2 semantics).

Phase **SIF-F — Observability** (P1, S)
1. Add a metric counter `sif_strategy_index_total{outcome, kind}` — Prometheus or log-based. Increments on each index call.
2. Document the watermark inspection query so operators can verify "did this activation index?" via `SELECT * FROM sif_indexing_watermark WHERE user_id = ?`.

Phase **SIF-G — Search surface + downstream consumers** (P1, M)
1. `services/intelligence/strategy_indexer.py::search_active_strategy(user_id, query) -> List[Hit]` — pre-filters to `source_artifact=True` (or our new `kind` values), scopes to current active.
2. Update 1-2 downstream consumers (e.g. LinkedIn writer) to call this; document the contract; verify the original review's gap-1 (context loss) is closed.

Phase **SIF-H — Rollout** (P0, S)
1. Add a feature flag `STRATEGY_SIF_INDEXING_ENABLED=true` (default) so we can disable in prod without redeploy.
2. Monitor `sif_strategy_index_total{outcome="failure"}` rate; alert if > 5% over 1h.

## 8. Critical review questions — ALL ANSWERED

1. **Q1 — Auto-fill indexing timing**: ANSWERED. Indexing happens at **strategy activation only**, not at auto-fill completion. Rationale you gave: before activation the user can edit/reject/regenerate; at activation the auto-fill values are final/SSOT. G1 (auto-fill-completion index) is removed. G2 (activation) is the single gate.
2. **Q2 — Multi-strategy**: ANSWERED. **Single active strategy per user.** No historical strategies are indexed. When the user activates a new strategy, the old one's `is_fresh` becomes False (overwrite semantics). Rationale you gave: "the activated content strategy is SSOT; once cannot change their strategy everyday. Having multiple strategy is a headache and we should not confuse the downstream agents."
3. **Q3 — SIF vs VFS canonical**: ANSWERED. **SIF canonical + VFS is human-readable audit view.** Full reasoning in §5.6: the two layers answer different questions (semantic search vs human inspect); both are projections of the DB row (which is THE strategy). The trigger to write to both is the same single event (activation); each layer can succeed without the other. DB is the absolute source of truth, SIF is the discovery layer for agents, VFS is the document view for humans.

## 9. What's NOT in scope (document for later)

- **SIF across the calendar pipeline** (per QA-6 in the previous audit). Different lifecycle; separate change.
- **SIF across LinkedIn/blog writers** — same source_id prefix scheme can extend, but writer-specific semantic search is a different problem.
- **AgentContextVFS.write_context_file is sync; making it async is out of scope** — it blocks the activation today, but for a markdown render it should be fast.
- **Multi-region SIF replication** — single-tenant today.
- **Prompt-level use of the new indexed items** — once searchable, the next step is to feed the active strategy into the strategy generation prompt. That's a separate plan (touches prompt_builder.py).
- **VFS file versioning** — `active.md` is the latest. If user wants history, `active-{date}.md` is a separate change.

## 10. Summary of what to do next

All 3 design questions are answered. The design is now simpler and cleaner:

1. **Single gate**: index on activation only. G1 (auto-fill-completion) is removed.
2. **Single active strategy per user**: no history, no per-version source_ids. Overwrite semantics on re-activation.
3. **SIF canonical + VFS audit view**: two layers, one trigger, best-of-both failure modes.

Implementation order (P0 work first):
1. SIF-A (source ID contract + canonical text) — small, defines the surface
2. SIF-B (indexer service) — core logic
3. SIF-C (VFS companion) — small, renders the markdown
4. SIF-D (activation hook) — wires the trigger; needs the activation body to be async-safe
5. SIF-E (tests) — TDD-first, 8 unit tests + 1 integration test
6. SIF-F (observability) — counters + watermark query docs
7. SIF-G (search surface + downstream consumers) — close the original review's gap-1
8. SIF-H (rollout flag) — safe production deployment

Estimated effort: ~2 days for one engineer with TDD. The hardest piece is getting the VFS write atomic with the SIF async dispatch (both must not break activation on failure).
