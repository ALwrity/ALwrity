# LinkedIn Studio — Post Format & Publish UX

## Implementation Plan (Phases 3–6)

**Status:** Phase 0–2 implemented; Phases 3–6 planned  
**Last updated:** 2026-07-16  
**Source of truth for “best practices” copy:** Knowledge Center → **LinkedIn Best Practices** modal (`BP_RULES.post` in `KnowledgeCenterModals.tsx`)  
**Related:** Image publish plan (`LINKEDIN_IMAGE_POST_PUBLISHING_IMPLEMENTATION_PLAN.md`); Phase 0–2 readiness helpers already shipped

---

## 1. Best Practices (product UI) vs Generation vs Publish

The Studio already teaches these **Post** rules:

| # | Best practice (modal) | Detail |
|---|----------------------|--------|
| 1 | Stay under **1,300** characters | “See more” truncation; hook in first **2 lines** |
| 2 | **3–5 hashtags** max | At the **end**, never inline |
| 3 | Start with a **bold hook** | First line earns “see more” (means *strong copy*, not markdown bold) |
| 4 | End with a clear **CTA** | Question / invite reaction |
| 5 | Post **Tue–Thu, 8–10 AM** | Timing tip only |
| 6 | **Line breaks** for readability | Short paragraphs (1–2 sentences) |

---

## 2. Verification — Generation flow & prompts (no code changes)

### 2.1 Flow today

```text
Prefs / HITL (max_length default ~2000)
  → linkedInWriterApi.generatePost
  → backend PostPromptBuilder.build_post_prompt
  → LLM returns content + hashtags[] + call_to_action
  → Frontend assembly (useLinkedInWriter / PostHITL / RegisterLinkedInActions*):
       fullContent = content + "\n\n" + hashtags + "\n\n" + cta
  → Draft (may include markdown / [Source N])
  → Publish: formatDraftForPublish → plain text (+ optional image)
```

### 2.2 Prompt (`post_prompts.py`) vs Best Practices

| Best practice | In generation prompt? | Notes |
|---------------|----------------------|--------|
| Hook | **Partial** | “Start with a compelling hook” — not “first 1–2 lines before see more” |
| CTA at end | **Yes** | “End with a thought-provoking question or clear call-to-action” |
| 3–5 hashtags | **Yes** | “Include 3–5 highly relevant… hashtags” |
| Hashtags **only at end** / never inline | **No** | Not specified; model may put tags inline |
| ≤ **1,300** see-more length | **No** | Uses `MAX LENGTH: {request.max_length}` (UI default **2000**) |
| Line breaks / short paras | **Yes** | “2–3 lines max” per paragraph; line breaks + emojis |
| No markdown (`**`, `#` headers) | **No** | Not forbidden; markdown can appear in draft |
| Posting schedule (Tue–Thu) | **No** | Education-only in Best Practices modal (OK for v1) |
| Citations `[Source N]` | **Yes (research)** | Intentional for Studio; stripped at publish |

### 2.3 Frontend assembly gaps

| Behavior | Status |
|----------|--------|
| Append hashtags after body | Done (`\n\n` + tags) |
| Append CTA after hashtags | Done |
| Skip append if body already has hashtags | **Not done** → risk of double blocks |
| Skip append if body already ends with CTA/question | **Not done** |
| Default `max_length` aligned to 1,300 | **Not done** (default **2000**) |

### 2.4 Publish / UX already shipped (Phase 0–2)

| Capability | Status |
|------------|--------|
| Shared constants (3000 hard / 1300 soft / 5 hashtags) | **Done** (`linkedInPostFormatConstants.ts`) |
| Readiness helpers + `getPublishChecklist()` | **Done** (`linkedInPublishReadiness.ts`) |
| Hard limit + empty gate on panel + modal | **Done** |
| Soft see-more warning | **Done** |
| “What LinkedIn will see” plain preview | **Done** (`LinkedInPublishPreviewPlain.tsx`) |
| Soft checklist **UI component** | **Not done** (helpers ready → Phase 3) |
| Editor/preview honesty (disclaimer + LinkedIn-style toggle) | **Not done** → Phase 4 |
| Prompt / assembly polish | **Not done** → Phase 5 |
| Backend sanitize safety net | **Not done** → Phase 6 |

### 2.5 Summary matrix

| Layer | Implemented | Gap |
|-------|-------------|-----|
| Best Practices **education** (modal) | Full 6 post rules | — |
| Generation **prompt** | Hook, CTA, 3–5 tags, line breaks | No 1300; no “tags only at end”; no “no markdown”; weak first-2-lines hook |
| Generation **assembly** | Append tags + CTA | No dedupe; default length 2000 |
| Publish **plain text** | Markdown/citations stripped | Backend mirror optional |
| Publish **UX** | Limits + see-more + plain preview | Soft checklist UI; editor honesty |

**Conclusion:** Best Practices are **taught in Studio** and **partly reflected** in prompts. They are **not fully enforced** at generation time. Phase 0–2 closed the biggest publish-time gap (“what actually posts”). Phases 3–6 should **reuse Best Practices wording** and existing readiness helpers — not invent a parallel rules engine.

---

## 3. Principles (do not break)

1. Do not change Unipile publish / image attachment contract.  
2. Keep `formatDraftForPublish` + Phase 0 readiness as the single frontend source of truth.  
3. Soft Best Practices = warnings; only **empty** and **>3000** block publish.  
4. Reuse `BP_RULES.post` / Knowledge Center copy for labels/tooltips.  
5. New file if modifying a file already >500 lines.  
6. Additive UI only — keep Studio draft preview + research citations as today.

---

## Phase 3 — Soft pre-publish checklist (wire existing helpers)

**Objective:** Show Best Practices–aligned soft checks without blocking publish (except hard 3000 / empty).

### Reuse (do not reinvent)

- `getPublishChecklist(draft, hasMedia)` in `linkedInPublishReadiness.ts`  
- Constants in `linkedInPostFormatConstants.ts`  
- Wording aligned to `BP_RULES.post` in `KnowledgeCenterModals.tsx`

### New file

`frontend/src/components/LinkedInWriter/components/LinkedInPublishChecklist.tsx`

| Item | Soft / Hard | Source |
|------|-------------|--------|
| Content not empty | Hard | readiness |
| ≤ 3,000 characters | Hard | readiness |
| Hook in first 1–2 lines | Soft | readiness + BP “bold hook” |
| Under ~1,300 (see more) | Soft | readiness + BP rule 1 |
| ≤ 5 hashtags | Soft | readiness + BP rule 2 |
| Clear question/CTA | Soft | readiness + BP rule 4 |
| Image attached | Info | readiness |

### Wire into

| File | Change |
|------|--------|
| `PublishNowModal.tsx` | Replace overlapping ad-hoc preflight rows with checklist (keep connection + duplicate detection) |
| `PublishLinkedInPanel.tsx` | Optional: compact popover “Post tips” using same component |

### Tasks

- [ ] **P3.1** Checklist component (consumes `getPublishChecklist` only)  
- [ ] **P3.2** Soft vs hard styling (green / amber / red); tooltips from BP copy  
- [ ] **P3.3** Confirm / Publish enabled only when hard items pass (already partly true — unify)  
- [ ] **P3.4** Do not duplicate char/see-more logic outside readiness helpers  

**Risk:** Low.

---

## Phase 4 — Editor / preview honesty (additive)

**Objective:** Stop overpromising markdown formatting on LinkedIn without removing the toolbar.

### Modify

| File | Change |
|------|--------|
| `LinkedInEditorToolbar.tsx` | Caption: “Draft formatting — LinkedIn posts as plain text” |
| Preview header / `ContentEditor` | Badge or toggle: **Studio preview** (default) vs **LinkedIn-style (plain)** using `getPublishPlainText` / `LinkedInPublishPreviewPlain` |
| `LinkedInDraftPreview.tsx` | Only if toggle selects LinkedIn-style; **do not** remove citation HTML from Studio mode |

### Avoid in v1

- Removing bold/heading toolbar  
- Unicode “fake bold”  
- Changing research citation rendering in Studio preview  

### Tasks

- [ ] **P4.1** Toolbar disclaimer  
- [ ] **P4.2** Optional LinkedIn-style preview toggle (default = Studio)  
- [ ] **P4.3** Citations unchanged in Studio preview  

**Risk:** Low.

---

## Phase 5 — Generation polish (align prompt + assembly to Best Practices)

**Objective:** Generated posts need less cleanup and match what the Best Practices modal teaches.

### 5.1 Prompt (`post_prompts.py`) — additive instructions

Add (keep research/citation rules):

1. **No markdown** — do not use `**bold**`, `#` headers, or image markdown; LinkedIn is plain text.  
2. **Hook in the first 1–2 lines** — front-load before “see more”.  
3. **Prefer ≤ 1,300 characters** unless `max_length` is higher and the user asked for a long post; never exceed `max_length`.  
4. **Hashtags only at the end** (3–5), never inline mid-sentence.  
5. **CTA as last text block before hashtags** (or after body, before tags — pick one and document).  
6. Clarify “bold hook” = strong opening line, **not** markdown bold.

### 5.2 Assembly (frontend — small shared helper recommended)

Files that append tags/CTA today:

- `useLinkedInWriter.ts`  
- `PostHITL.tsx`  
- `RegisterLinkedInActions.tsx` / `RegisterLinkedInActionsEnhanced.tsx`  

**New helper** (if any of those files are large):  
`frontend/src/components/LinkedInWriter/utils/linkedInPostAssembly.ts`

| Rule | Behavior |
|------|----------|
| Hashtags | Append only if body has **fewer than** soft max and request asked for tags |
| CTA | Append only if body has no `?` / CTA-like ending |
| Order | `body` → blank line → `cta` (if needed) → blank line → `hashtags` (if needed) |

### 5.3 Defaults

| Pref | Today | Proposed |
|------|-------|----------|
| Post `max_length` default | 2000 | **1500** or **1300** soft default; hard max remains 3000 |
| User override | HITL / prefs | Keep — longer posts still allowed |

### Do not

- Change research / citation pipeline  
- Change Quality Check scoring in v1  
- Enforce posting schedule in generation  

### Tasks

- [ ] **P5.1** Prompt updates (no markdown / tags at end / see-more / first-2-line hook)  
- [ ] **P5.2** Dedupe hashtag + CTA assembly helper; wire all generate-post entry points  
- [ ] **P5.3** Safer default `max_length` (document in prefs HITL)  
- [ ] **P5.4** Manual A/B: generate 3 posts before/after; confirm no double CTA/tags  

**Risk:** Medium-low (prompt + assembly only).

---

## Phase 6 — Backend sanitize safety net (optional)

**Objective:** Even if a client skips frontend sanitize, LinkedIn never gets markdown/citations.

### New file

`backend/services/integrations/linkedin/linkedin_publish_text_sanitize.py`

Mirror frontend rules:

- Strip `[Source N]` / citation groups  
- Strip image markdown / `/api/linkedin/images/...`  
- Strip `**` / headers / leftover markdown  
- Enforce max **3000**; 400 if empty after sanitize  

### Wire into

`execute_linkedin_publish()` — sanitize once before provider; log `original_len` / `sanitized_len` only (never full post body if sensitive).

### Tasks

- [ ] **P6.1** Sanitize module + unit tests  
- [ ] **P6.2** Call from publish service only  
- [ ] **P6.3** 400 if empty after sanitize  

**Risk:** Low if idempotent with `formatDraftForPublish`.

---

## 4. Recommended rollout

| Order | Phase | Depends on | User value |
|-------|-------|------------|------------|
| Done | 0–2 | — | Limits + see-more + plain preview |
| Next | **3** | Phase 0 helpers | Soft checklist matching Best Practices |
| Then | **5** | — | Better AI drafts (biggest quality win) |
| Then | **4** | Phase 2 preview component | Honest editor/preview |
| Last | **6** | Phase 0 rules | Production hardening |

**Suggested ship next:** Phase **3** then **5** (checklist UX + generation alignment). Phase 4 can ship in parallel with 5. Phase 6 when hardening for production API clients.

---

## 5. Manual test checklist (future phases)

### Phase 3
- [ ] Soft rows amber when over 1300 / >5 tags / weak hook — Confirm still enabled  
- [ ] Hard fail empty / >3000 — Confirm disabled  
- [ ] Copy matches Best Practices modal language  

### Phase 5
- [ ] Generated post has no `**` / `#` headers in draft body  
- [ ] Hashtags only at end; count 3–5 when enabled  
- [ ] No double CTA/hashtag block  
- [ ] Default-length post usually ≤ ~1500 (or configured soft default)  

### Phase 4
- [ ] Studio preview still shows citations  
- [ ] LinkedIn-style toggle shows plain text only  

### Phase 6
- [ ] API publish with markdown body → sanitized plain text on LinkedIn  

### Regression
- [ ] Text-only + text+image publish still work  
- [ ] Research grounding / Quality Check unchanged  

---

## 6. Files summary (Phases 3–6)

| Action | Path |
|--------|------|
| **Create** | `LinkedInPublishChecklist.tsx` |
| **Create** | `linkedInPostAssembly.ts` (recommended) |
| **Create** | `linkedin_publish_text_sanitize.py` (Phase 6) |
| **Modify** | `PublishNowModal.tsx`, `PublishLinkedInPanel.tsx` |
| **Modify** | `LinkedInEditorToolbar.tsx`, preview header / `ContentEditor` |
| **Modify** | `post_prompts.py` |
| **Modify** | `useLinkedInWriter.ts`, `PostHITL.tsx`, RegisterLinkedInActions* |
| **Modify** | `linkedin_publish_service.py` (Phase 6 wire-up) |
| **Reuse** | `linkedInPublishReadiness.ts`, `linkedInPostFormatConstants.ts`, `LinkedInPublishPreviewPlain.tsx`, `BP_RULES.post` |

---

## 7. Out of scope

- Posting-time scheduler / calendar enforcement (Best Practices tip #5 stays educational)  
- Unicode mathematical bold for “LinkedIn bold”  
- Changing article / carousel / video Best Practices or generators in this plan  
- Replacing Quality Check with readiness scores (future optional)  
