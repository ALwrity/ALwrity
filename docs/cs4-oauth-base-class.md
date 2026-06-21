# OAuth Common Framework — Phase 4 Plan

## Context

The user remembered a "common OAuth framework" that was supposedly merged to
main. **It was not.** Two attempts exist:

- `c66f2c1d "Add Common OAuth Framework"` (on `common-oauth-framework`
  branch only, never merged) — 3 frontend files, 848 lines, **does not
  actually replace anything** despite the commit message claim. Branch is
  3 months stale, 1,198 files diverged from main, a straight merge is
  catastrophic.
- `e4142c7f "OAuth framework production-ready"` (on main) — a 41-file
  bundle that ships **partial** OAuth framework: `WordPressOAuthContentManager`
  bearer mirror, `_check_wix_token` 1d/24h/3-attempt logic,
  `_PLATFORM_CHECKS` dispatch in `get_connected_platforms`, 56 OAuth tests
  passing, and the `oauth_callback_utils.py` shared callback HTML
  generator. But the per-provider **token storage** is not common — 4
  services each implement their own.

## State of the 4 OAuth services on local main

| Service | LOC | Fernet | `_is_likely_encrypted_blob` | `_migrate_plaintext_tokens_if_needed` | `_initialize_fernet` failure mode |
|---|---|---|---|---|---|
| `WixOAuthService` | 505 | ✅ | ✅ | ✅ | warn + return None |
| `WordPressOAuthService` | 506 | ✅ | ✅ | ✅ | warn + return None |
| `BingOAuthService` | 971 | **❌ plaintext** | **❌** | **❌** | n/a |
| `YouTubeOAuthService` | 493 | ✅ | ✅ | ✅ | **raise on missing** (different) |

`_initialize_fernet`, `_encrypt_token`, `_decrypt_token`, `_is_likely_encrypted_blob`,
`_migrate_plaintext_tokens_if_needed` are **word-for-word the same** in Wix and
WordPress, and nearly identical in YouTube. Bing lacks all of them.

## Plan: 3 small commits on local main only

Per the user's directive ("work on local main only, not multiple branches"),
no new branches. Per the audit, all work lands on main directly.

### Step 1 — Bing token encryption (P0, security)

**File**: `backend/services/integrations/bing_oauth.py`

**What**:
- Add `_initialize_fernet`, `_encrypt_token`, `_decrypt_token`,
  `_is_likely_encrypted_blob`, `_migrate_plaintext_tokens_if_needed`
  matching the Wix/WordPress pattern
- New env var: `BING_TOKEN_ENCRYPTION_KEY` (falls back to
  `OAUTH_TOKEN_ENCRYPTION_KEY`)
- Modify `store_tokens` and `update_tokens` to encrypt access/refresh
  before insert
- Modify `get_user_tokens` and `get_user_token_status` to decrypt
  on read, with the same try/except + skip-on-InvalidToken behavior Wix uses
- Add the `_migrate_plaintext_tokens_if_needed` call to the read paths

**Net**: +60 lines, fixes real security gap.

**Test**: existing Bing tests must still pass; add 1 round-trip
encryption test.

**Risk**: low — only changes internal token storage format, not the
public API.

### Step 2 — Extract `OAuthProviderBase` (P1, dedup)

**New file**: `backend/services/integrations/oauth_provider_base.py` (~120 lines)

**What**:
- Pull `_initialize_fernet`, `_encrypt_token`, `_decrypt_token`,
  `_is_likely_encrypted_blob`, `_migrate_plaintext_tokens_if_needed`,
  `_get_db_path` into a single base class
- `WixOAuthService`, `WordPressOAuthService`, `YouTubeOAuthService`,
  `BingOAuthService` all inherit from it
- Each provider keeps its own `__init__` (provider-specific client
  config), `_init_db` (provider-specific schema), and
  `generate_authorization_url` / `handle_oauth_callback` (provider-specific
  OAuth flow)
- Resolve the Fernet failure-mode inconsistency: base class returns
  `Optional[Fernet]` (matches Wix/WordPress; YouTube currently raises).
  This is also addressed in step 3.

**Net**: -150 lines (3 services × ~50 lines duplicate removed, +120
lines base class added).

**Test**: 56 existing OAuth tests must still pass (mocking pattern
preserved). Add 1 base-class unit test.

**Risk**: low — mechanical refactor, no behavior change.

### Step 3 — Normalize YouTube's `_initialize_fernet` to return None (P2, consistency)

**File**: `backend/services/youtube/youtube_oauth_service.py`

**What**: change `_initialize_fernet` to return `Optional[Fernet]` and
log a warning instead of raising on missing key. Token ops then fail with
a clearer error than "Fernet is None" deep in the call stack.

**Alternative**: invert the base class to require Fernet at
construction (constructor raises). The user's "we can't tolerate
fallbacks" mandate suggests this. **Decision pending sign-off** — both
options are valid. If inverted, this commit becomes a one-line change
to the base class constructor (not YouTube-specific).

## Out of scope

- **Merging `c66f2c1d`**: dead scaffolding, 3 months stale, would
  require 1,198-file merge with massive conflicts. Skip.
- **Per-CRUD-method template-method refactor** (`store_tokens` /
  `get_user_tokens` / `update_tokens` / `get_user_token_status` /
  `revoke_token` / `get_connection_status`): 3 of 4 services duplicate
  ~50 lines each, but the SQL differs per provider. Would save another
  ~150 lines but the template-method risk is higher (~3 days work). Defer
  to a separate phase.
- **Frontend unification**: per-platform `wordpressOAuth.ts` /
  `bingOAuth.ts` could become a single `oauthClient.ts`. The c66f2c1d
  scaffolding was an attempt at this but was 3 months stale. Defer to
  a separate phase.
- **Deleting the `common-oauth-framework` branch**: branch still exists
  locally. After the 3 commits ship and pass review, deleting it is
  safe. Not part of this plan.

## Verification

After each step:
- All 56 existing OAuth tests pass
- New tests for the step's behavior pass
- No regression in `routes/strategies.py` / `routes/wix_routes.py` /
  `routes/wordpress_oauth.py` / `routes/bing_oauth.py` etc.
- Manual smoke test: connect + disconnect one OAuth flow per
  provider (Wix, WordPress, Bing, YouTube) and confirm tokens are
  encrypted at rest in the SQLite DB

## Estimated effort

- Step 1: 30-60 min
- Step 2: 2-3 hours
- Step 3: 30 min
- Total: ~3-4 hours, 3 commits on local main
