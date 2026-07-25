# LinkedIn Studio — Draft with ALwrity (Comment Assistant)

## Implementation Plan

**Status:** Planning  
**Last updated:** 2026-07-24  
**GitHub:** [#188](https://github.com/ALwrity/ALwrity-prod/issues/188) — Give "Draft with ALwrity" option in Comment Assistant  
**Builds on:** [#73 Comment Assistant inbox](COMMENT_ASSISTANT_INBOX_IMPLEMENTATION_PLAN.md) (Phases 1–5 complete)  
**Related endpoints today:** `POST /api/linkedin/generate-comment-response` (LinkedIn Writer — broken contract for Comment Assistant)

---

## 1. Goal

When a creator receives a comment on their LinkedIn post and is unsure how to reply, they should click **Draft with ALwrity** in Comment Assistant and get a context-aware reply draft (post + comment + their voice) prefilled in the inline reply composer — without leaving LinkedIn Studio or using external AI tools.

---

## 2. Current state audit

### 2.1 Already implemented (reuse — do not rebuild)

| Area | What exists | Location |
|------|-------------|----------|
| Comment Assistant UI | Inbox modal, priority tabs, post groups, inline reply composer | `CommentAssistantInboxModal.tsx`, `commentAssistantPostGroup.tsx`, `commentAssistantCommentRow.tsx` |
| Draft button (wrong label) | **"Draft with AI"** button on top-level comments; opens reply composer with prefilled text | `commentAssistantCopy.ts` → `COMMENT_ASSISTANT_ACTIONS.draftAi`; `useCommentAssistantInbox.ts` → `handleDraftAi` |
| Manual tab drafter | Paste comment + optional post → generate → copy / push to studio | `CommentAssistantManualPanel.tsx` |
| Inbox + actions API | Inbox, like, reply via Unipile v1 | `linkedin_comment_assistant_routes.py`, `commentAssistantApi.ts` |
| Inbox workspace cache | TTL snapshot, patch on like, clear on reply | `linkedin_comment_assistant_cache_service.py`, `linkedin_comment_assistant_inbox.py` |
| Generic comment-response API | Route + service + prompts + `llm_text_gen` | `routers/linkedin.py`, `linkedin_service.py`, `content_generator.py`, `comment_response_prompts.py` |
| LLM gateway | Subscription, routing, usage tracking | `services/llm_providers/main_text_generation.py` (`llm_text_gen`) |
| Persona pattern (reference) | Profile optimization uses persona + structured JSON + retry | `profile_optimization_service.py`, `profile_intelligence_llm.py` |

### 2.2 What "Draft with AI" does today

1. User clicks **Draft with AI** on a comment row.
2. Frontend calls `linkedInWriterApi.generateCommentResponse()` with:

   ```ts
   { original_post, comment, response_type: "professional", include_question: false }
   ```

3. On success, `draftText` is set on the comment and the reply composer opens.
4. On failure, a red banner shows: **"Could not draft a reply. Please try again."** (matches production screenshot).

### 2.3 Root causes of failure (must fix)

| # | Problem | Evidence | Impact |
|---|---------|----------|--------|
| 1 | **Request schema mismatch** | Backend `LinkedInCommentResponseRequest` requires `original_comment`, `post_context`, **`industry`** (all required, min length 10). Frontend sends `original_post`, `comment` — no `industry`. | FastAPI returns **422** before route handler runs |
| 2 | **Response key bug** | `generate_grounded_comment_response()` returns `{ content: ... }` but `generate_comment_response()` reads `content_result['response']` | **KeyError → 500** even if request passed validation |
| 3 | **No persona / voice** | Prompt uses generic industry expert template; Comment Assistant never passes user persona or onboarding industry | Drafts feel generic; not "in your voice" |
| 4 | **Wrong API client for AI** | `generateCommentResponse` uses `apiClient` (not `aiApiClient`); may miss AI-specific auth/headers used elsewhere | Possible auth/routing inconsistency |
| 5 | **Generic error handling** | `catch { setActionError("Could not draft...") }` — no `detail.message` parsing | Users cannot tell validation vs LLM vs subscription errors |
| 6 | **Branding** | Copy still says "Draft with AI" | Does not meet #188 product naming |
| 7 | **Nested replies** | `commentAssistantNestedReplyRow.tsx` has Like/Reply only — no draft button | Follow-up replies on threads cannot use ALwrity draft |
| 8 | **No draft-specific cache** | Every click re-hits LLM; no workspace persistence of drafts per comment | Wasted tokens; poor UX on accidental re-click |

### 2.4 Out of scope for #188

- [#122](https://github.com/ALwrity/ALwrity-prod/issues/122) outbound "comments I left" networking view  
- Auto-posting replies without user review (draft → user edits → Send)  
- Rebuilding Comment Assistant inbox aggregation  
- Unipile v2 migration  
- Mock/fallback draft text when LLM fails  

---

## 3. Product decisions (recommended)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Button label | **Draft with ALwrity** | Issue #188; loading state: **Drafting with ALwrity…** |
| UX flow | Draft prefills inline reply composer; user edits → **Send reply** | Keeps human-in-the-loop; matches existing Reply path |
| API shape | **New dedicated route** under Comment Assistant namespace | Avoid breaking LinkedIn Writer HITL / Manual tab; clear ownership |
| LLM | Reuse `llm_text_gen` with `flow_type="linkedin_comment_assistant_draft"` | Same subscription + routing as profile optimization / podcast |
| Persona | Load LinkedIn persona from existing persona cache (same as post generation) | "In your voice" without new onboarding |
| Industry default | Resolve from persona / onboarding profile; fallback `"General"` | Removes required frontend field |
| Research / grounding | **Off** for comment replies (MVP) | Comments need fast, conversational replies — not citations |
| Alternatives | Optional 1–2 alternative drafts in response (Manual tab already shows alternatives) | Nice-to-have in Phase 3; not blocking MVP |
| Nested replies | Add Draft with ALwrity on nested rows (reply-to-reply) | Same handler; pass parent comment context in prompt |
| Cache | Workspace DB draft cache per `(user_id, comment_id)` + optional session cache on frontend | Mirrors post-analytics / inbox cache patterns |

---

## 4. Target architecture

```mermaid
sequenceDiagram
  participant UI as CommentAssistant UI
  participant API as comment-assistant/draft-reply
  participant Svc as comment_assistant_draft_service
  participant Cache as draft_cache_service
  participant LLM as llm_text_gen
  participant Persona as persona_cache

  UI->>API: POST draft-reply { social_id, comment_id, post_text, comment_text }
  API->>Cache: get_fresh(user, comment_id)
  alt cache hit
    Cache-->>API: cached draft
  else cache miss
    API->>Persona: get LinkedIn persona + industry
    API->>Svc: build prompt + call LLM
    Svc->>LLM: llm_text_gen(flow_type=linkedin_comment_assistant_draft)
    LLM-->>Svc: reply text
    Svc->>Cache: store draft
  end
  API-->>UI: { reply, alternatives?, from_cache }
  UI->>UI: Prefill reply composer; user edits → Send reply
```

---

## 5. Implementation phases

### Phase 1 — Frontend UI function and components

**Goal:** Correct branding, UX states, and component hooks ready for a dedicated draft API — testable with mocked/stubbed responses.

**Modify (no new files unless a file exceeds 500 lines)**

| File | Change |
|------|--------|
| `commentAssistantCopy.ts` | Rename `draftAi` → **"Draft with ALwrity"**; `drafting` → **"Drafting with ALwrity…"**; update Manual tab intro to say ALwrity |
| `WorkflowActionModals.tsx` | Update Comment Assistant card description (remove generic "AI reply") |
| `commentAssistantCommentRow.tsx` | Ensure draft button disabled states, aria-label, composer auto-open on draft; optional subtle helper: "Review and edit before sending" |
| `commentAssistantNestedReplyRow.tsx` | Add **Draft with ALwrity** button + wire props (`onDraftAlwrity`, `draftBusy`, `draftText`) |
| `commentAssistantPostGroup.tsx` | Pass draft handler to nested rows |
| `commentAssistantTypes.ts` | Extend nested reply view type with `draftBusy`, `draftText` if needed |
| `commentAssistantApi.ts` | Add `draftReply()` client method stub targeting new route |
| `useCommentAssistantInbox.ts` | Rename `handleDraftAi` → `handleDraftAlwrity`; support nested reply ids; structured loading/error state per comment |

**UI exit criteria**

- [ ] All user-visible strings say **ALwrity**, not "AI"  
- [ ] Draft button on top-level comments and nested replies  
- [ ] Clicking draft shows loading on the button (not whole modal)  
- [ ] Success opens reply composer with prefilled text  
- [ ] Error area reserved for structured messages (Phase 3)  

---

### Phase 2 — Backend foundation

**Goal:** Production-grade draft service using `llm_text_gen`, persona, and a Comment Assistant–specific API — fix existing bugs in legacy path as a safety net.

**New files (preferred — keeps routes thin)**

| File | Responsibility |
|------|----------------|
| `backend/models/linkedin_comment_assistant_draft_models.py` | Request/response Pydantic models aligned with frontend |
| `backend/services/linkedin_comment_assistant_draft_service.py` | Business logic: validate inputs, load persona, build prompt, call LLM, parse response |
| `backend/prompts/linkedin/comment_assistant_draft_prompt.py` | System + user prompt templates (post, comment, persona voice, tone) |

**Modify**

| File | Change |
|------|--------|
| `backend/api/linkedin_comment_assistant_routes.py` | Add `POST /comment-assistant/draft-reply` |
| `backend/services/linkedin/content_generator.py` | **Fix legacy bug:** `content_result.get('response') or content_result.get('content')` so Manual tab / HITL stop 500-ing |
| `backend/models/linkedin_models.py` | Add field aliases (`original_post` → `post_context`, `comment` → `original_comment`); make `industry` optional with default — backward compatible fix for existing clients |
| `backend/routers/linkedin.py` | Log deprecation notice; optionally delegate to new service later |

**New API contract (draft-reply)**

```http
POST /api/linkedin/comment-assistant/draft-reply
```

Request:

```json
{
  "social_id": "urn:li:activity:…",
  "comment_id": "…",
  "post_text": "Your post body…",
  "comment_text": "Comment from audience…",
  "parent_comment_text": null,
  "tone": "friendly",
  "include_question": false,
  "refresh": false
}
```

Response:

```json
{
  "success": true,
  "reply": "Thanks for sharing…",
  "alternative_replies": [],
  "from_cache": false,
  "generation_metadata": { "model_used": "…", "flow_type": "linkedin_comment_assistant_draft" }
}
```

**Draft service requirements**

1. Validate non-empty `post_text` and `comment_text` (min length aligned with LinkedIn realities — e.g. 3 chars comment, 10 chars post).  
2. Load persona via existing persona cache helper (same path as `ContentGenerator._get_cached_persona_data`).  
3. Resolve `industry` from persona; default `"General"`.  
4. Call `llm_text_gen` with:
   - `flow_type="linkedin_comment_assistant_draft"`
   - `user_id` from Clerk
   - Structured JSON schema: `{ "reply": string, "alternative_replies": string[] }` (optional alternatives)
   - Temperature ~0.7, max_tokens ~500 (comments are short)
5. No research / Exa / grounding for MVP.  
6. Return plain-language errors (`validation`, `not_connected`, `subscription_limit`, `llm_error`).

**Backend exit criteria**

- [ ] New route returns valid draft for sample post + comment  
- [ ] Legacy `generate-comment-response` no longer 500s on happy path (key fix)  
- [ ] Persona influences tone/word choice in prompt  
- [ ] Unit test: draft service with mocked `llm_text_gen`  
- [ ] All new files under 500 lines  

---

### Phase 3 — Wire frontend and backend

**Goal:** End-to-end draft in Comment Assistant inbox and Manual tab.

**Modify**

| File | Change |
|------|--------|
| `commentAssistantApi.ts` | Implement `draftReply()` → `aiApiClient.post(...)` |
| `useCommentAssistantInbox.ts` | Replace `linkedInWriterApi.generateCommentResponse` with `commentAssistantApi.draftReply`; pass `social_id`, `comment_id`; map `reply` → `draftText` |
| `CommentAssistantManualPanel.tsx` | Switch to new API (or shared client helper); keep alternatives UI if returned |
| `CommentAssistantInboxModal.tsx` | Wire nested reply draft handler through post group |
| `postCommentsErrorUtils.ts` or new `commentAssistantDraftErrorUtils.ts` | Map backend `error_code` → user strings |

**Wiring exit criteria**

- [ ] Click **Draft with ALwrity** on Needs reply / Active tabs → draft appears in composer  
- [ ] User can edit draft and **Send reply** (existing Unipile path unchanged)  
- [ ] Manual tab still works via same backend service  
- [ ] Errors show specific messages (empty comment, subscription limit, try again)  
- [ ] No regression on Like / Reply / Sync inbox  

---

### Phase 4 — Cache storage (reuse existing architecture)

**Goal:** Avoid redundant LLM calls; align with post-analytics workspace cache + Comment Assistant inbox cache patterns.

**Inbox cache (already done — verify integration)**

- Reply posted → `LinkedInCommentAssistantCacheService.clear()` (already in routes) — keeps priority tabs accurate.  
- No change required unless draft storage is embedded in inbox blob (not recommended).

**New: draft reply cache**

| Piece | Pattern source | Design |
|-------|----------------|--------|
| DB model | `linkedin_comment_assistant_cache_model.py` | New table OR new `cache_key` prefix e.g. `draft:{comment_id}` in same table |
| Service | `linkedin_comment_assistant_cache_service.py` | `get_draft_fresh()`, `store_draft()`, `clear_draft(comment_id)` |
| TTL | Post analytics session 30m / inbox 5m | **24h** for drafts (user may come back same day); invalidate on successful reply |
| Frontend session cache | `usePostAnalytics.ts` sessionStorage pattern | Optional `commentAssistantDraftCache.ts` — instant re-open composer without network |
| Refresh flag | Inbox `refresh=true` pattern | Request body `refresh: true` bypasses draft cache (Regenerate) |

**UI addition (small)**

- After draft loads, show text action **Regenerate** (sets `refresh: true`) next to composer — optional but recommended.

**Cache exit criteria**

- [ ] Second click on same comment within TTL returns cached draft (`from_cache: true`)  
- [ ] Successful reply clears draft cache for that `comment_id`  
- [ ] Regenerate bypasses cache  
- [ ] Cache rows keyed per user; no cross-tenant leakage  

---

### Phase 5 — Exception handling and debugging logs

**Goal:** Production observability consistent with Comment Assistant inbox (Phase 5 of #73) and post analytics routes.

**Backend logging (Loguru, masked user id)**

| Event | Log prefix | Fields |
|-------|------------|--------|
| Draft request start | `[CommentAssistantDraft]` | user (masked), social_id suffix, comment_id suffix |
| Cache hit/miss | `[CommentAssistantDraftCache]` | hit/miss, ttl_age |
| Persona loaded | `[CommentAssistantDraft]` | has_persona, industry |
| LLM call | `[CommentAssistantDraft]` | flow_type, duration_ms (no prompt text) |
| Success | `[CommentAssistantDraft]` | reply_length, from_cache |
| Failure | `[CommentAssistantDraft]` | error_code, exception type (no PII) |

**Structured HTTP errors**

| Code | HTTP | User message |
|------|------|--------------|
| `validation_error` | 422 | "We need both your post and the comment to draft a reply." |
| `not_connected` | 403 | "Connect LinkedIn to use Comment Assistant." |
| `subscription_limit` | 429 | Use existing billing message from `llm_text_gen` |
| `llm_error` | 502 | "ALwrity couldn't draft a reply right now. Please try again." |
| `unexpected_error` | 500 | Generic safe message |

**Frontend**

- Parse `detail.error_code` + `detail.message` (never `[object Object]`).  
- Log client-side errors with `[CommentAssistantDraft]` prefix in dev console.  
- Distinguish draft errors from reply/like errors in `actionError` banner.

**Tests**

- Service unit tests: validation, cache hit, LLM failure, persona missing fallback.  
- Optional route integration test with mocked LLM.

**Phase 5 exit criteria**

- [ ] Every failure path logged with enough metadata to debug production  
- [ ] No secrets / full comment bodies in logs  
- [ ] UI errors are plain language and actionable  
- [ ] Legacy path fix covered by at least one regression test  

---

## 6. File change summary

| Action | Path |
|--------|------|
| **Create** | `docs/linkedin/plan.md` (this document) |
| **Create** | `backend/models/linkedin_comment_assistant_draft_models.py` |
| **Create** | `backend/services/linkedin_comment_assistant_draft_service.py` |
| **Create** | `backend/prompts/linkedin/comment_assistant_draft_prompt.py` |
| **Create** | `backend/services/linkedin_comment_assistant_draft_cache_service.py` (or extend existing cache service) |
| **Create** | `backend/models/linkedin_comment_assistant_draft_cache_model.py` (if separate table) |
| **Create** | `frontend/src/components/LinkedInWriter/components/dashboard/commentAssistantDraftErrorUtils.ts` (optional) |
| **Modify** | `commentAssistantCopy.ts`, `useCommentAssistantInbox.ts`, `commentAssistantApi.ts`, `commentAssistantCommentRow.tsx`, `commentAssistantNestedReplyRow.tsx`, `commentAssistantPostGroup.tsx`, `CommentAssistantManualPanel.tsx`, `linkedin_comment_assistant_routes.py`, `linkedin_models.py`, `content_generator.py` |

---

## 7. Acceptance criteria (#188)

- [ ] Button reads **Draft with ALwrity** everywhere in Comment Assistant (inbox + manual).  
- [ ] Clicking the button produces a context-aware reply draft using **post text + comment text**.  
- [ ] Draft uses **ALwrity LLM stack** (`llm_text_gen`), not ad-hoc provider calls.  
- [ ] Draft reflects user **persona / voice** when persona exists.  
- [ ] User reviews draft in inline composer and sends via existing Reply flow.  
- [ ] Errors are understandable; no silent failures.  
- [ ] Draft cache reduces duplicate LLM calls; invalidated after reply.  
- [ ] Production logging supports debugging without exposing secrets.  
- [ ] No mock/fallback fake replies.  

---

## 8. Suggested PR sequence

| PR | Phase | Scope |
|----|-------|-------|
| **PR A** | Phase 1 | UI rename + nested row button + API client stub |
| **PR B** | Phase 2 | Backend draft service + route + legacy bugfix |
| **PR C** | Phase 3 | Wire inbox + manual tab end-to-end |
| **PR D** | Phase 4 | Draft cache (DB + optional session + Regenerate) |
| **PR E** | Phase 5 | Logging, structured errors, tests |

PRs A+B can ship together if small; C depends on B.

---

## 9. QA test plan

1. **Happy path:** Needs reply tab → Draft with ALwrity → edit draft → Send reply → comment moves to Active / disappears from Needs reply.  
2. **Short comment:** Comment with < 10 chars still drafts (validation tuned for real LinkedIn comments).  
3. **Nested reply:** Reply to your own reply in a thread → Draft with ALwrity works.  
4. **Cache:** Draft same comment twice → second call fast / `from_cache`; Regenerate produces new text.  
5. **Failure:** Disconnect LinkedIn → clear error; exceed subscription → billing message.  
6. **Manual tab:** Paste flow still works.  
7. **Regression:** Like, Sync comments, inbox cache TTL unchanged.  

---

## 10. Phase order reminder

| Phase | Focus |
|-------|--------|
| **Phase 1** | Frontend UI — ALwrity branding, components, states |
| **Phase 2** | Backend — draft service, API, LLM, persona, legacy fix |
| **Phase 3** | Wiring — inbox + manual tab end-to-end |
| **Phase 4** | Cache — workspace draft cache + optional session cache |
| **Phase 5** | Logging — structured errors, observability, tests |

---

## 11. Open decisions (resolve in PR A)

1. **Separate DB table vs cache_key column for drafts?**  
   **Recommend:** Reuse `comment_assistant_inbox_cache` table with `cache_key = draft:{comment_id}` — same service patterns, fewer migrations.

2. **Show alternative replies in inbox composer?**  
   **Recommend:** Defer to Manual tab only for MVP; inbox shows primary draft only.

3. **Keep legacy `/generate-comment-response` for HITL?**  
   **Recommend:** Yes — fix bugs + aliases; migrate HITL later if desired.

4. **Include thread context (other replies) in prompt?**  
   **Recommend:** Phase 2 MVP uses post + target comment + optional `parent_comment_text`; full thread context as fast-follow if quality needs it.
