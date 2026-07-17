# LinkedIn Studio — Comment Assistant Inbox (Issue #73)

## Implementation Plan

**Status:** Phase 1–3 complete (UI + backend + frontend wiring); Phases 4–5 pending  
**Last updated:** 2026-07-18  
**GitHub:** [#73](https://github.com/ALwrity/ALwrity-prod/issues/73) — Centralized Comment & Reply Dashboard  
**Related (separate, not in this plan):** [#122](https://github.com/ALwrity/ALwrity-prod/issues/122) — comments I left on others’ posts (networking)  
**Unipile version:** **v1 only** (no v2)

---

## 1. Goal (simple)

Stop the “open post → read comments → reply → close → next post” loop.

Give non-tech creators **one Comment Assistant screen** that shows comments **on their posts**, grouped by post, with **Reply**, **Like**, and optional **Draft with AI** — without leaving the dashboard.

---

## 2. Product decisions (locked)

| Decision | Choice |
|----------|--------|
| Product home | Engagement → **Comment Assistant** (evolve current modal) |
| Data source for inbox | **List comments on a post** (`GET /api/v1/posts/{social_id}/comments`) — already used in Studio |
| Out of scope for #73 | Unipile user “list all comments” (outbound) → tracked in **#122** |
| Unipile API | **v1 only** |
| Manual paste AI drafter | Keep as **Manual** tab / fallback |
| Engagement Trends | Unchanged product; may **reuse** comment services/patterns only |
| Compact UI | ~half viewport size; keep all sections (per AJay on #73) |

### Priority UI (no time wasting)

| Priority | Tab / filter | What user sees |
|----------|----------------|----------------|
| **P0 (default)** | **Needs reply** | Newest unanswered comments on your posts |
| **P1** | **Active** | Threads where you already replied (possible follow-ups) |
| **P2** | **Older / Done** | Answered or older than N days — behind “Show older” |

Default open = **Needs reply only**. Older comments are one click away, not in the first viewport.

---

## 3. Unipile v1 reactions — do your endpoints work for **comments**?

### Short answer

**Yes — with the right parameters.** The same v1 routes cover both post reactions and comment reactions.

Official description for add reaction: *“React to either a post or a post comment.”*  
([Add a reaction to a post](https://developer.unipile.com/reference/postscontroller_addpostreaction))

Migration note (v1 → v2) confirms v1 used **`comment_id`** on these routes; v2 splits comment reactions to a separate path. We stay on **v1** and keep using `comment_id`.  
([Posts API migration](https://developer.unipile.com/v2.0/docs/migration-social-api))

### List reactions

| | Post reactions | Comment reactions |
|--|----------------|-------------------|
| Method | `GET /api/v1/posts/{post_id}/reactions` | Same URL |
| Required | `account_id` (+ auth header) | `account_id` + query **`comment_id`** |
| `post_id` | Use LinkedIn **`social_id`** | Same |

Your sample response (`comment_id` on each item) matches Unipile’s v1 `PostReaction` shape.  
Without `comment_id` in the **request**, you list reactions on the **post**, not on a comment.

### Add reaction

| | Like a post | Like a comment |
|--|-------------|----------------|
| Method | `POST /api/v1/posts/reaction` | Same URL |
| Body | `account_id`, `post_id` (`social_id`), optional `reaction_type` | Same + **`comment_id`** |
| Default reaction | `like` if omitted | Same |

Your bare POST example (no JSON body) is incomplete. Production call needs at least:

```json
{
  "account_id": "<unipile_account_id>",
  "post_id": "<post_social_id>",
  "comment_id": "<comment_id>",
  "reaction_type": "like"
}
```

### Important LinkedIn rule

Always use post **`social_id`** for comments/reactions — URL post id is unreliable.  
([Posts and Comments](https://developer.unipile.com/docs/posts-and-comments))

### Plan stance for #73 Like button

- **MVP:** `POST /api/v1/posts/reaction` with `comment_id` + `reaction_type: "like"`.  
- **Optional:** `GET .../reactions?comment_id=` to confirm “you liked” / refresh counts.  
- **Defer:** remove reaction, celebrate/love/etc. (can add later with same endpoint).

---

## 4. Safe aggregation (many posts → many Unipile calls)

Best/safest approach for production:

| Guardrail | Rule |
|-----------|------|
| Post cap | Last **10–15** of *your* posts with `comments > 0` |
| Depth cap | First page per post (**10–20** comments); “Load more” per post |
| Concurrency | Fetch **2–3 posts at a time**, not all in parallel |
| Cache (Phase 4) | Workspace DB + TTL (e.g. **3–5 min**), patterned after post analytics |
| Sync | Explicit **“Sync comments”**; don’t refetch Unipile on every open if cache warm |
| Progressive UI | Show post headers first → stream comments as each post returns |
| Fail soft | One post fails → keep others + “Retry this post” |
| Cooldown | Reuse sync-cooldown idea (~5 min) so users don’t hammer Unipile |

Mental model for users: **Sync once → work from the list.**

---

## 5. What exists today (reuse)

| Capability | Where |
|------------|--------|
| Comment Assistant entry + paste AI UI | `EngagementWedgeModals.tsx` → `CommentAssistantModal` |
| AI draft reply | `POST /api/linkedin/generate-comment-response` |
| List posts / analytics cache | `linkedin_post_analytics_*`, `GET /api/linkedin/post-analytics` |
| List post comments + reply | `UnipilePostCommentsClient`, `linkedin_post_comments_*`, `postCommentsApi` |
| Per-post UI patterns | Trends `PostCommentsModal` / cards (copy patterns; don’t couple Trends) |
| Workspace multi-tenant DB | `get_db` / per-user SQLite |

**Missing today:** cross-post inbox UI, aggregator API, comment Like (reactions client), inbox cache tables, priority tabs.

---

## 6. Dependencies (`requirements.txt` / npm)

**Expected:** no new Python or npm packages.

- Unipile via existing `httpx` client  
- SQLAlchemy / FastAPI / Loguru already present  
- Frontend: existing React + Studio modal patterns  

**Plan action:** confirm in Phase 2/4; only add a dependency if a real gap appears (unlikely). Document any add in the PR.

---

## 7. Phase plan

### Phase 1 — Frontend UI components

**Goal:** Compact Comment Assistant shell with inbox layout, priority tabs, and Manual fallback — reviewable without new API fields (use empty/loading states; optional local placeholders **only for layout review**, never fake LinkedIn data in production paths).

**Do**

1. Restructure Comment Assistant into tabs: **Needs reply** | **Active** | **Older** | **Manual**.  
2. Compact modal (~half size): post snippet header → comment rows.  
3. Per comment: author, text, time, **Like**, **Reply**, **Draft with AI**.  
4. Inline reply composer + loading / empty / not-connected copy (plain language).  
5. Progressive skeleton: post groups appear first, comments fill in.  
6. Sync comments button + cooldown message (client timer OK until Phase 3/4).  
7. Split new UI into new files if `EngagementWedgeModals.tsx` would exceed ~500 lines.

**Likely new / touched frontend files**

| File | Action |
|------|--------|
| `EngagementWedgeModals.tsx` | Entry; extract modal if oversized |
| `CommentAssistantInboxModal.tsx` (new) or split modules | Inbox shell |
| `commentAssistantPostGroup.tsx` (new) | Post snippet + children |
| `commentAssistantCommentRow.tsx` (new) | Like / Reply / AI actions |
| `commentAssistantPriorityTabs.tsx` (new) | Needs reply / Active / Older |
| `commentAssistantCopy.ts` (new) | Plain-language strings |
| Keep Manual paste flow | Existing generate-reply form as Manual tab |

**Phase 1 exit criteria**

- [x] Compact UI with priority tabs visible from Engagement → Comment Assistant.  
- [x] Manual tab still works (paste → Generate Reply).  
- [x] Empty / loading / not-connected states are clear for non-tech users.

---

### Phase 2 — Backend foundation

**Goal:** Inbox aggregation + comment Like on **Unipile v1**, reusing post-comments + posts.

**Do**

1. Extend `UnipilePostCommentsClient` (or small sibling client under 500 lines) with:  
   - `GET /api/v1/posts/{social_id}/reactions?account_id=&comment_id=`  
   - `POST /api/v1/posts/reaction` body: `account_id`, `post_id`, `comment_id`, `reaction_type`  
2. New service: build inbox payload — select capped posts with comments → list comments (limited concurrency) → classify Needs reply / Active / Older.  
3. New routes (thin):  
   - `GET /api/linkedin/comment-assistant/inbox` (filters: priority, refresh)  
   - `POST /api/linkedin/comment-assistant/comments/{id}/like` (or reuse a shared reactions route)  
   - Keep existing list/reply comment routes for send/load-more  
4. Models: inbox response (post groups + comments + flags: `needs_reply`, `user_reacted`, etc.).  
5. Soft errors per post; never fail entire inbox if one Unipile call fails.  
6. Confirm **no new** `requirements.txt` deps.

**Classification heuristic (v1 MVP)**

- **Needs reply:** comment not authored by me; no reply from me in thread (best-effort from returned replies / author ids).  
- **Active:** I already replied.  
- **Older:** outside time window (e.g. > 14 days) or marked done later.

**Phase 2 exit criteria**

- [x] Inbox endpoint returns posts grouped with comments under caps.  
- [x] Like comment works via v1 `POST /posts/reaction` + `comment_id`.  
- [x] Reply still uses existing comment reply API.  
- [x] Invalid/missing connection returns structured error (no mocks).

**Phase 2 delivered**

| Piece | Location |
|-------|----------|
| Reactions client | `UnipilePostCommentsClient.list_post_reactions` / `add_post_reaction` |
| Inbox service | `linkedin_comment_assistant_service.py` |
| Models | `linkedin_comment_assistant_models.py` |
| Routes | `GET /api/linkedin/comment-assistant/inbox`, `POST .../comments/{id}/like` |
| Registry | `CORE_ROUTER_REGISTRY` → `linkedin_comment_assistant` |

---

### Phase 3 — Wire frontend ↔ backend

**Goal:** Real LinkedIn data on the Phase 1 UI.

**Do**

1. API client methods for inbox + like + load-more.  
2. Needs reply / Active / Older bind to API filters or client split of inbox payload.  
3. Reply → existing reply endpoint; refresh that post group.  
4. Like → new reaction endpoint; optimistic UI then confirm.  
5. Draft with AI → existing generate-comment-response with prefilled comment + post text; user sends via Reply.  
6. Sync Comments → `refresh=true` inbox; respect cooldown.  
7. Manual QA on personal LinkedIn: multi-post comments, reply, like, AI draft, empty account.

**Phase 3 exit criteria**

- [x] Changing priority tab shows the right set.  
- [x] Reply and Like work without leaving Comment Assistant.  
- [x] AI draft prefills from real comment + post.  
- [x] Failed post shows retry; rest of inbox still usable.

**Phase 3 delivered**

| Piece | Location |
|-------|----------|
| API client | `frontend/src/services/commentAssistantApi.ts` |
| Inbox hook | `useCommentAssistantInbox.ts` |
| Mappers | `commentAssistantMappers.ts` |
| Wired UI | `CommentAssistantInboxModal` + post group / comment row |
| Reply | existing `postCommentsApi.replyToComment` |
| Load more | existing `postCommentsApi.fetchPostComments` + cursor |
| AI draft | existing `linkedInWriterApi.generateCommentResponse` |

---

### Phase 4 — Cache storage (reuse post-analytics pattern)

**Goal:** Persist inbox snapshots in the **per-user workspace DB** (same multi-tenant idea as post analytics), so reopen is fast and Sync is controlled.

**Do**

1. New tables (or lean JSON blob table) e.g. `comment_assistant_inbox_cache` / per-post comment snapshots:  
   - `user_id`, `post_social_id`, comment payloads, `fetched_at`, optional `priority`  
2. Serve inbox from DB when fresh (TTL 3–5 min); Unipile only on Sync or stale.  
3. Invalidate / patch cache after successful Reply or Like.  
4. Mirror analytics patterns: `last_synced_at`, clear messaging “Last updated X ago”.  
5. Still enforce post/depth caps when refreshing from Unipile.  
6. No new deps unless SQLite helpers already cover it.

**Phase 4 exit criteria**

- [ ] Second open within TTL does not re-hit Unipile for every post.  
- [ ] Sync refreshes cache; UI shows last updated.  
- [ ] Reply/Like update cached row so UI stays consistent.  
- [ ] Cache is per-user workspace only (privacy).

---

### Phase 5 — Exception handling & debugging logs

**Goal:** Production-ready observability (same spirit as Engagement Trends logging work).

**Do**

1. Log inbox build: post cap, per-post success/fail, counts by priority (masked user id).  
2. Log Unipile list/reply/like: status metadata only — no tokens, no full comment PII dumps.  
3. Structured API errors (`error_code` + `message`).  
4. Frontend: parse `detail.message`; never show `[object Object]`.  
5. Soft-fail aggregator; soft-fail Today/digest if it ever consumes inbox.  
6. Keep files under 500 lines; split if needed.

**Phase 5 exit criteria**

- [ ] Logs distinguish: not connected / cache hit / Unipile fail per post / like fail / reply fail.  
- [ ] UI errors are plain language.  
- [ ] One bad post cannot crash Comment Assistant.

---

## 8. Out of scope

- [#122](https://github.com/ALwrity/ALwrity-prod/issues/122) outbound “comments I left” networking view  
- Unipile **v2** APIs  
- Rebuilding Engagement Trends or Growth Engine  
- Company-page / org comment-as (unless already supported elsewhere)  
- Mock/fake LinkedIn comments in production

---

## 9. Acceptance criteria (#73)

- [ ] Centralized Comment Assistant inbox grouped by post snippet.  
- [ ] Default **Needs reply**; Older available without cluttering the first view.  
- [ ] Inline **Reply** and **Like** (v1 reaction with `comment_id`).  
- [ ] Optional AI draft → then send via Reply.  
- [ ] Manual paste flow preserved.  
- [ ] Safe Unipile usage (caps, concurrency, cache, Sync).  
- [ ] Compact UI; plain-language empty/error states.  
- [ ] Logging/exception handling production-ready.  
- [ ] No unnecessary dependency changes.

---

## 10. Suggested PR sequence

1. **PR A — Phase 1 UI**  
2. **PR B — Phase 2 API + Unipile v1 reactions**  
3. **PR C — Phase 3 wiring + QA**  
4. **PR D — Phase 4 cache**  
5. **PR E — Phase 5 logging** (can merge with D if small)

---

## 11. Open decisions (resolve in first implementation PR)

1. Exact “Needs reply” heuristic if Unipile omits full reply graph on first page? (**Recommend:** treat top-level comments without my reply in loaded page as needs-reply; refine later.)  
2. Older window: 7 vs 14 days? (**Recommend: 14 days.**)  
3. Like only `like`, or also celebrate/love in v1? (**Recommend: like only for MVP.**)

---

## 12. Phase order reminder

| Phase | Focus |
|-------|--------|
| **1** | Frontend UI components |
| **2** | Backend foundation (inbox + v1 Like) |
| **3** | Wire UI ↔ API |
| **4** | Workspace cache (post-analytics style) |
| **5** | Exception handling & logs |

No application code is changed by this document alone — implement when starting Phase 1.
