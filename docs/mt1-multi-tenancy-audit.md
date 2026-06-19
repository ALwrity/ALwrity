# Multi-Tenancy Audit and Migration Plan

This document is the design output of `mt/phase-1` (audit + plan only,
no code changes). It catalogues every tenant-isolation gap raised in the
MT-1 analysis issues and proposes a phased migration path that does not
disrupt existing call sites in one step.

The companion implementation work is broken into subsequent phases:
- `mt/phase-1.1` — the `os.environ` -> `contextvars.ContextVar` migration
- `mt/phase-1.2` — DISABLE_AUTH isolation + per-user keys in dev mode
- `mt/phase-1.3` — singleton dictionaries with bounded eviction
- `mt/phase-1.4` — semantic cache isolation, decorator routing, per-user quota
- `mt/phase-1.5` — per-tenant rate limiting
- `mt/phase-1.6` — workspace cleanup hooks, logout cache invalidation, user_id in URL

Each phase is one PR. Order is by blast radius (smallest first) and by
the priority order in the analysis issues.

---

## 1. Audit: API key call sites

A `git grep`-style audit of `os.getenv` / `os.environ` reads and writes
that touch API-key environment variables finds **66 read references
across 23 production files**, plus another **6 write sites in 5
production files** that mutate `os.environ[...]` for API keys.

The full environment-variable matrix:

| Env var | Reads (file:line) |
|---|---|
| `GEMINI_API_KEY` | `services/llm_providers/gemini_provider.py:99`, `services/llm_providers/gemini_grounded_provider.py:42`, `services/hallucination_detector.py:85`, `start_linkedin_service.py:60`, `services/user_api_key_context.py:60` (the snapshot in `user_api_keys()`), `api/onboarding_utils/onboarding_completion_service.py:266,335` |
| `EXA_API_KEY` | `services/research/exa_service.py:43,65`, `services/research/exa_content_research.py:26`, `services/blog_writer/research/exa_provider.py:23`, `services/seo_tools/competitor_content_service.py:37`, `services/research/core/research_engine.py:78`, `services/research/core/parameter_optimizer.py:86`, `api/onboarding_utils/onboarding_completion_service.py:265,334`, `api/podcast/handlers/tavily_category_research.py:208`, `api/podcast/handlers/analysis.py:587`, `services/user_api_key_context.py:61` |
| `OPENAI_API_KEY` | `services/hallucination_detector.py:93`, `api/onboarding_utils/onboarding_completion_service.py:267,331`, `services/user_api_key_context.py:63` |
| `ANTHROPIC_API_KEY` | `api/onboarding_utils/onboarding_completion_service.py:268,332`, `services/user_api_key_context.py:64` |
| `WAVESPEED_API_KEY` | `services/llm_providers/wavespeed_provider.py:173`, `services/llm_providers/image_generation/wavespeed_provider.py:53`, `services/llm_providers/image_generation/wavespeed_edit_provider.py:136`, `services/llm_providers/main_image_editing.py:48,58`, `api/linkedin_image_generation.py:337`, `services/hallucination_detector.py:89` |
| `TAVILY_API_KEY` | `services/research/tavily_service.py:44,57`, `services/blog_writer/research/tavily_provider.py:18`, `services/research/core/research_engine.py:79`, `services/research/core/parameter_optimizer.py:87`, `services/user_api_key_context.py:65` |
| `STABILITY_API_KEY` | `services/stability_service.py:22`, `config/stability_config.py:384`, `services/llm_providers/image_generation/stability_provider.py:28` |
| `DEEPL_API_KEY` | `services/translation/deepl_translator.py:109` |
| `GOOGLE_API_KEY` | `services/llm_providers/image_generation/gemini_provider.py:25`, `api/onboarding_utils/onboarding_completion_service.py:269,333` |
| `GOOGLE_SEARCH_API_KEY` | `services/research/google_search_service.py:43` |
| `GOOGLE_PAGESPEED_API_KEY` | `services/seo_tools/pagespeed_service.py:25` |
| `WIX_API_KEY` | `main.py:594`, `app.py:829`, `services/integrations/wix/auth_utils.py:91` |
| `HF_TOKEN` | `api/linkedin_image_generation.py:337` |
| `COPILOTKIT_API_KEY` | `services/user_api_key_context.py:62` |
| `SERPER_API_KEY` | `services/user_api_key_context.py:66` |
| `FIRECRAWL_API_KEY` | `services/user_api_key_context.py:67` |

The full set of writes (mutations of `os.environ[...]` for API keys)
is even more concerning: **any code that resolves a key and writes it
to `os.environ` is the actual race-condition trigger**, not just the
readers. The six write sites in five files are:

- `services/llm_providers/main_text_generation.py:196` (`GEMINI_API_KEY`),
  and `:199` (`HF_TOKEN`)
- `services/llm_providers/main_image_generation.py:49` (`GEMINI_API_KEY`)
- `services/llm_providers/textgen_utils/llm_text_generator.py:136`
  (`GEMINI_API_KEY`), and `:139` (`HF_TOKEN`)
- `services/onboarding/api_key_manager.py:599` (per-provider write;
  driven by user API key save flow)
- `api/onboarding_utils/step4_persona_routes.py:594` (per-provider
  write; restore at `:691`)
- `middleware/api_key_injection_middleware.py:147` (the main culprit)

The reader migration alone is not enough. The writers must also be
migrated, otherwise the race is preserved under a different name.

---

## 2. Why `contextvars.ContextVar` and not a thread-local

`threading.local()` is the obvious alternative, but it is wrong for
this codebase:

1. `FastAPI` runs request handlers in an `asyncio` event loop. Each
   request is a coroutine, not a thread. `threading.local` is shared
   across coroutines on the same thread, so it would suffer the same
   race as `os.environ`.
2. `ContextVar` was added to the standard library specifically to
   solve this problem. It is task-coroutine aware, propagates through
   `asyncio.create_task`, and is the documented pattern for per-request
   state in modern asyncio Python.
3. A FastAPI middleware that does `ctx_var.set(...)` before `await
   call_next(request)` and `ctx_var.reset(token)` in `finally` gives
   us a request-scoped lookup with zero global mutation.

The single-line summary: `os.environ` is a global dict; `ContextVar` is
a per-async-task dict. The latter is correct for this code path.

---

## 3. Design: the `tenant_context` module

The migration introduces a new module
`backend/services/tenant_context.py` with the following surface:

```python
# pseudo-API, see implementation in mt/phase-1.1
from contextvars import ContextVar, Token
from typing import Optional

_TENANT_KEYS: ContextVar[dict[str, str]] = ContextVar(
    "alwrity_tenant_keys", default={}
)


def set_tenant_keys(keys: dict[str, str]) -> Token:
    """Middleware entry point. Returns a token for reset."""


def reset_tenant_keys(token: Token) -> None:
    """Middleware cleanup."""


def get_tenant_key(env_var: str, default: str = "") -> str:
    """Read API key for the current request.

    Looks up the env-var name in the per-request context dict.
    Falls back to ``os.environ`` (i.e. the global env) when the
    context is empty -- this preserves local-dev behaviour where no
    per-user keys are injected.
    """
```

Three things to notice:

1. **One ContextVar, not 16.** We do not create a ContextVar per
   provider. The context is a dict; the env-var name is the dict key.
   This keeps the middleware simple and avoids a 16-line dance every
   time we add a new provider.
2. **Fallback to `os.environ`.** In local dev and in startup code
   (before any request is in flight), the context is empty and the
   reader returns the value from the actual environment. This is the
   "fail open" behaviour that lets existing scripts and tests keep
   working.
3. **The fallback is the only thing that touches `os.environ`.**
   Readers never call `os.getenv` for API keys. Writers (the four
   mutators above) replace `os.environ[key] = value` with
   `set_tenant_keys({...})`.

The fallback path is **the safety net** that lets the migration be
phased: every reader we touch can be migrated independently, and
un-migrated readers still get the correct local-dev value from
`os.environ`. The race only matters in production with multiple
tenants; that is exactly where the middleware always sets the context
before the request runs.

---

## 4. Middleware behaviour change

`APIKeyInjectionMiddleware.__call__` is the only place that
materialises the per-request context. The new body:

```
async def __call__(self, request, call_next):
    user_id = await self._resolve_user_id(request)
    if not user_id:
        return await call_next(request)
    user_keys = user_api_keys(user_id) or {}
    token = set_tenant_keys(user_keys)
    try:
        return await call_next(request)
    finally:
        reset_tenant_keys(token)
```

The middleware continues to call `user_api_keys(user_id)` (the existing
DB read). The only new line is `set_tenant_keys` / `reset_tenant_keys`.
The `os.environ` injection is removed. The `is_production` gate is
removed: even in local dev, the context is set, so a local user with
per-user keys stored in the DB (e.g. a multi-tenant dev seed) gets
the right key. This is also the fix for the
**MT-6.3 (no per-user key isolation in local dev mode)** concern.

---

## 5. Migration order for the 23 reader files and 5 writer files

To keep the diff small and reviewable per PR, the readers and
writers are migrated in the following order, each as one commit:

1. **Phase 1.1a** — the migration infrastructure: introduce
   `services/tenant_context.py` and update the middleware to use
   `set_tenant_keys` / `reset_tenant_keys`. No reader is touched in
   this commit; the test verifies that the new module is in place
   and the middleware is wired.
2. **Phase 1.1b** — the 6 write sites:
   - `services/llm_providers/main_text_generation.py`
   - `services/llm_providers/main_image_generation.py`
   - `services/llm_providers/textgen_utils/llm_text_generator.py`
   - `services/onboarding/api_key_manager.py`
   - `api/onboarding_utils/step4_persona_routes.py`
   - `middleware/api_key_injection_middleware.py` (already moved
     in 1.1a; here we remove the `os.environ` injection branch)
   The writers must move first because they are the actual race
   trigger.
3. **Phase 1.1c** — `services/llm_providers/*.py` (3 reader files;
   the `gemini_provider.py` and `gemini_grounded_provider.py`
   family).
4. **Phase 1.1d** — `services/research/*.py` and
   `services/blog_writer/research/*.py` (7 files; the research
   subsystem is internal and easy to test).
5. **Phase 1.1e** — `services/seo_tools/*.py`,
   `services/integrations/wix/auth_utils.py`,
   `services/translation/deepl_translator.py`,
   `services/stability_service.py`,
   `config/stability_config.py` (5 files).
6. **Phase 1.1f** — `api/onboarding_utils/onboarding_completion_service.py`,
   `api/podcast/handlers/*.py`,
   `api/linkedin_image_generation.py`, `start_linkedin_service.py`,
   `main.py`, `app.py` (6 files; mostly entry-point fallbacks).
7. **Phase 1.1g** — `services/user_api_key_context.py` and
   `services/hallucination_detector.py` (the snapshot function and
   the last multi-key consumer).

Each phase is one PR, each PR is a subset of the files that
mechanically replace `os.getenv(<KEY>)` with `get_tenant_key(<KEY>)`,
or replace `os.environ[<KEY>] = value` with the contextvar setter.
Tests in the same PR prove the equivalence in local dev
(os.environ fallback) and in multi-tenant simulated mode (contextvar
override).

---

## 6. Singleton dictionaries with bounded eviction (mt/phase-1.3)

Three unbounded dicts accumulate per-user state with no eviction:

- `services/intelligence/txtai_service.py:_instances` -- the txtai
  service singletons.
- `services/intelligence/agents/agent_orchestrator.py:orchestrators`
  -- the agent orchestration singletons.
- `services/database.py:_user_engines` -- the per-user SQLAlchemy
  engines.

The fix in `mt/phase-1.3` is uniform across the three:

1. Add a `cleanup_user(user_id)` method that drops the entry, disposes
   the underlying connections / model handles, and is safe to call
   multiple times.
2. Replace the bare `dict` with an `OrderedDict` + size cap (default
   256) so the cap is bounded. Eviction policy: LRU, with a single
   warning log when the cap is hit so operators can see real load.
3. Hook `cleanup_user` into the workspace cleanup path so
   `cleanup_user_workspace` (a separate concern) leaves no in-memory
   references behind.

This is split from `mt/phase-1.1` because it does not depend on the
contextvars work and can land independently.

---

## 7. Semantic cache isolation (mt/phase-1.4)

Three coupled changes in `services/intelligence/semantic_cache.py`:

- **MT-6.6** -- `self.user_indices` is `Dict[str, str]`, single-entry
  per user. The fix is to change it to `Dict[str, List[str]]` and
  update the two mutation sites and the one lookup site to handle
  the list. This is a one-file change.
- **MT-6.5** -- add a per-user quota so one tenant cannot evict
  another's entries. The cleanest implementation: split
  `memory_cache` into a `Dict[str, OrderedDict]` keyed by `user_id`,
  with each per-user dict capped at e.g. 64 entries. The global LRU
  falls back to a per-user LRU; memory size accounting sums across
  users. The `get_cached_semantic_insights` API is unchanged.
- **MT-6.7** -- route `semantic_cache_decorator` through
  `get_cached_semantic_insights` rather than `self.memory_cache.get`
  directly, so user scoping is consistent.

The three changes land in one PR because they touch the same data
structure.

---

## 8. Per-tenant rate limiting (mt/phase-1.5)

`RateLimitMiddleware` keys by IP or auth header fragment. The fix:
once `APIKeyInjectionMiddleware` has set `request.state.user_id`, the
rate limiter reads that and uses it as the primary key. The IP is the
fallback for unauthenticated routes.

This needs to be done after `mt/phase-1.1` because the user_id
contract is established there.

---

## 9. DISABLE_AUTH and the easy wins (mt/phase-1.2 + 1.6)

`mt/phase-1.2`:

- **MT-6.2** -- in `auth_middleware.verify_token`, when
  `self.disable_auth` is true, generate the mock user_id from
  `request.client.host` (the client IP) so concurrent dev users get
  distinct workspaces. The fallback to `mock_user_id` only happens
  when there is no client IP.
- **MT-6.3** -- remove the `is_production` gate in
  `APIKeyInjectionMiddleware` (the contextvars migration already
  covers this; MT-6.3 falls out of phase 1.1, so it is folded in
  there rather than a separate concern).

`mt/phase-1.6` (the cleanup phase):

- **MT-6.10** -- `user_workspace_manager.cleanup_user_workspace` calls
  `cleanup_user` on each of the three singleton dictionaries.
- **MT-6.9** -- on logout (a Clerk webhook), call
  `semantic_cache_manager.invalidate_user_cache(user_id)`.
- **MT-6.11** -- remove `user_id` from the subscription URL paths in
  the frontend; the backend already derives user from JWT.
- **MT-6.12** -- `get_optional_user` returns a sentinel
  `{'id': 'anonymous'}` instead of `None`, and every consumer is
  audited to handle the sentinel correctly.

---

## 10. Risk register and rollback

| Risk | Mitigation |
|---|---|
| `ContextVar` not propagating across `asyncio.create_task` for fire-and-forget background jobs (the in-flight `_index_tasks_to_sif` task) | The middleware sets the context **before** the background task is created; `ContextVar` propagates through `create_task`. We add a unit test that asserts the background task observes the same context. |
| Some reader paths are entered from a thread pool (the `run_in_threadpool` calls in `today_workflow.py` etc.) | `ContextVar` values are inherited by threads spawned via `asyncio.to_thread` / FastAPI's `run_in_threadpool`. We add a unit test that runs through `run_in_threadpool` and asserts the key is visible. |
| A module-level constant caches `os.getenv(...)` at import time | We replace the pattern with a lazy `_get_api_key()` accessor that consults the contextvar; module imports no longer cache keys. A code-grep test asserts no API-key lookup happens at module top-level. |
| Fallback to `os.environ` could mask a misconfigured contextvar in production | The fallback logs a `WARNING` the first time per process if a key is read in production with an empty context. The middleware then raises a `RuntimeError` in a debug mode flag. |
| Subscription endpoint `user_id` URL path removal breaks an existing client | The change is opt-in via a new route (`/api/subscription/status/me`) added alongside the old one. The old route is removed in the next release. |

Rollback: each phase is one PR. To roll back `mt/phase-1.1`, revert
that PR. The singleton, cache, and rate-limit work in 1.3-1.5 is
independent. The DISABLE_AUTH fix in 1.2 is also independent.

---

## 11. Test strategy

The migration needs three kinds of tests, beyond the existing
contract tests:

- **Multi-tenant race regression tests** -- simulated concurrent
  requests with different `user_id`s; assert the key seen by each
  request is the right one and never the other's. This is the test
  that would have caught MT-6.1 in CI.
- **Local-dev fallback tests** -- assert that `get_tenant_key(X)` is
  equivalent to `os.getenv(X)` when no context is set.
- **Context propagation tests** -- through `asyncio.create_task` and
  `run_in_threadpool`, the contextvar must be visible to spawned
  code.

The audit document commits no code; the tests are added in
`mt/phase-1.1`.

---

## 12. Summary of phases

| Phase | Focus | Files | Effort |
|---|---|---|---|
| `mt/phase-1` | **This document. Audit + plan only.** | 0 source files | 0.5 day |
| `mt/phase-1.1` | `os.environ` -> `ContextVar` migration (in 7 sub-phases) | 23 readers + 5 writer files + middleware + new module | 5-7 days |
| `mt/phase-1.2` | `DISABLE_AUTH` isolation + dev-mode key injection | 1-2 files | 0.5 day |
| `mt/phase-1.3` | Singleton dicts with bounded eviction | 3 files | 2 days |
| `mt/phase-1.4` | Semantic cache isolation | 1 file | 2 days |
| `mt/phase-1.5` | Per-tenant rate limiting | 1-2 files | 1.5 days |
| `mt/phase-1.6` | Workspace cleanup, logout, URL/sentinel cleanup | 3-4 files | 1 day |

Total: ~13 days against the original 18.5 estimate, with the
critical `os.environ` race fixed in `mt/phase-1.1`.
