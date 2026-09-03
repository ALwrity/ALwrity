# Website Maker — Detailed Design (Self-Hosted Free Presence Site)

> *"You can't do digital marketing without a website."*
> *"Something better than nothing."*

ALwrity currently has no-website users complete onboarding but offers them no live web presence. This design replaces the abandoned v1 (orphaned GitHub/Netlify deploy path, thin generic rendering, fake URLs) with a self-hosted, brief-driven, single-page site served from ALwrity's own backend — free to the user, with a migration/export path from day one.

**Status:** Design approved — implementation pending.
**Owner:** ALwrity Core Team

---

## 1. Why v1 Failed (Honest Audit)

| Layer | What was built | What's actually broken |
|---|---|---|
| **AI intelligence** | `SITE_BRIEF_SCHEMA`, per-page content plans, Exa query maps, quality/confidence flags | ✅ Genuinely good. Worth keeping. |
| **Theme tokens** | `website_style_service.py` — palettes, typography, CSS custom properties from brand adjectives | ✅ Works. Produces real design tokens. |
| **Preview renderer** | `_generate_preview_html` in `website_automation_service.py` | ❌ Generic "banner + repeating cards" loop. Never reads the content_plan or brief. Produces identical cards regardless of data. |
| **Production renderer** | `generate_site_content` in `services/onboarding/website_automation_service.py` | ❌ Emits hardcoded `_index.md`/`about.md`/`contact.md` with `contact@example.com`, `(555) 123-4567`. Ignores the entire brief and content plan. |
| **Deploy path** | GitHub API → Netlify deploy | ❌ Stub: `https://{name}.netlify.app` built by string concat. `create_github_repo`, `push_content_to_repo`, `deploy_to_netlify` all return fake URLs even when tokens are present. |
| **DB persistence** | `UserWebsite` model + `create_user_website()` | ❌ No Alembic migration. Table never provisioned. |
| **Onboarding wiring** | `BusinessDescriptionStep.tsx` (orphaned) | ❌ Only referenced in a comment in `onboardingCache.ts:6-8`. Step never rendered in any wizard. |

**Root cause:** The intelligence (schemas, Exa, themes) was built first and never consumed by the output layer. The rendering/deploy layer was prototyped and never finished. The feature was abandoned before the last-mile gap was closed.

**Verdict:** The intelligence layer is the asset. The rendering/deploy layer is the part that needs a complete redesign — not a fix.

---

## 2. Design Principles

1. **Something better than nothing — but not worse than nothing.** A bad-looking or non-live site damages ALwrity's credibility. Ship only when the output quality is genuinely better than having no site at all.
2. **Every brief field maps to a DOM node.** No intelligence is wasted. If the LLM produced it, the renderer consumes it.
3. **Self-hosted from day one.** No GitHub/Netlify tokens, no external account coupling, no subscription dependency. ALwrity controls the hosting.
4. **Honest placeholders.** If `missing_fields` or `dont_know` → tasteful omission or one follow-up round. Never `contact@example.com`.
5. **Portable by default.** The export bundle (static HTML/CSS/markdown) is generated from the same renderer that produces the live site. No separate code path.
6. **Free forever, upgrade optional.** Free tier = hosted site + badge. Paid tier = custom domain, badge removal, analytics.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER FLOW                                    │
│                                                                     │
│  Business Info    ──→  Site Brief   ──→  Exa Research  ──→  Theme   │
│  (existing intake)      (LLM)            (per-page)        (tokens) │
│                                                                    │
│  Follow-up Q's   ──→  Preview      ──→  Publish         ──→  Live  │
│  (if low confidence)   (watermarked)    (verified 200)      URL     │
│                                                                    │
│  Export Bundle   ←──  (anytime)                                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     HOSTING LAYOUT                                   │
│                                                                     │
│  FastAPI backend                                                   │
│  └─ SITES_DIR = backend/sites/                                      │
│     └─ {slug}/index.html + custom.css + assets/                    │
│                                                                     │
│  Mount: app.mount("/sites", StaticFiles(directory=SITES_DIR))      │
│  Live URL: /u/{slug}/                                               │
│  Preview URL: /u/preview/{slug}/                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Model — New `user_sites` Table

New Alembic migration (new head). Retires the unmigrated `UserWebsite` model.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Primary key |
| `user_id` | FK → users | Per-user DB reference (multi-tenant) |
| `slug` | VARCHAR UNIQUE | Live path segment (e.g. `acme-co-8x3k`) |
| `template_type` | ENUM(`one_pager`, `blog`, `profile`, `shop`) | v1 = `one_pager` only; others reserved for future |
| `config` | JSON | Business name, tagline, value_prop, offerings, audience, brand_voice, geo, contact (from `SITE_BRIEF_SCHEMA.site_brief`) |
| `content_plan` | JSON | Per-section: goal, key_points, cta, refined copy, research refs, Exa output |
| `theme` | JSON | Design tokens (palette, typography, spacing, layout) + generated CSS snapshot |
| `quality` | JSON | `quality_flags`, `confidence`, `missing_fields`, `dont_know` from brief LLM output |
| `status` | ENUM | `draft → brief_done → research_done → preview_ready → published → failed` |
| `file_manifest` | JSON | List of written files + SHA-256 hash per file |
| `renderer_version` | VARCHAR | Version string for cache-busting/rebuild triggers |
| `published_at` | TIMESTAMP | When first deployed |
| `updated_at` | TIMESTAMP | Last rebuild |
| `created_at` | TIMESTAMP | First creation |
| `exported_at` | TIMESTAMP | Last export-bundle download |

**Slug generation:** `{normalized-name}-{4-char-suffix}` where suffix = `hashlib.sha256(user_id + business_name).hexdigest()[:4]`. Collision-checked against existing slugs.

**Status state machine:**
```
draft → brief_done → research_done → preview_ready → published
                ↓                        ↓
              failed                   failed
```

---

## 5. Hosting Layout — ALwrity Self-Hosted

### Why self-host (not GitHub/Netlify)

| Concern | GitHub/Netlify | Self-hosted |
|---|---|---|
| External account setup | Required per user | None |
| Token management | Per-user or shared | None |
| Cost at scale | Netlify free-tier limits | ALwrity's own infra |
| URL control | `{name}.netlify.app` | `/u/{slug}/` |
| Migration story | Locked in | Built-in export |
| Fake-deploy risk | High (stub temptation) | Zero — bytes are ours |

### Serving mechanics

- `SITES_DIR = backend/sites/` (configurable via env var `ALWRITY_SITES_DIR`)
- FastAPI mount: `app.mount("/sites", StaticFiles(directory=SITES_DIR), name="sites")`
- All generated HTML uses **relative paths** (`./custom.css`, `./assets/logo.png`) so the site works under any mount point.
- Preview sites served from `SITES_DIR/preview/{slug}/`; published sites from `SITES_DIR/{slug}/`.
- A dedicated `GET /u/{slug}` route serves `SITES_DIR/{slug}/index.html` with proper content-type headers.

### File structure per site

```
SITES_DIR/
└─ {slug}/
   ├─ index.html          # Main page (Jinja2-rendered)
   ├─ custom.css          # Theme token CSS (generated)
   └─ assets/
      ├─ favicon.ico      # Default or user-provided
      └─ og-image.png     # Optional: auto-generated OG image
```

---

## 6. Renderer — Brief-Driven Section Components

### Core rule

Every field the LLM produces must appear in the DOM. The renderer *consumes* the site brief and content plan; it does not generate placeholder copy.

### Section components (Jinja2 templates)

Each section is a typed Pydantic model whose fields map 1:1 to `SITE_BRIEF_SCHEMA` keys.

| Component | Brief fields consumed | Notes |
|---|---|---|
| `HeroSection` | `business_name`, `tagline`, `value_prop`, `offerings[0]` | CTA = first offering or custom |
| `OfferingsSection` | `offerings[]` (name, description, price_range) | Key points from content_plan `offerings` page |
| `AudienceSection` | `audience` (type: B2B/B2C, description) | "Who this is for" copy |
| `AboutSection` | `about` field or `content_plan.about` page | If absent → omit section entirely |
| `ContactSection` | `contact.email`, `contact.phone`, `contact.location`, `contact.social_links` | If `missing_fields` → one follow-up round; else tasteful blank |
| `SocialStrip` | `contact.social_links` | Only render links that exist |
| `FooterBadge` | ALwrity brand | Free-tier watermark: "Powered by ALwrity" |

### Template engine

- Python `jinja2.Environment` with auto-escaping.
- `render_site(slug, config, content_plan, theme) → dict[str, str]` returns `{filename: content}`.
- CSS is injected via `<link rel="stylesheet" href="./custom.css">` — generated by `website_style_service.py` using theme tokens.
- `renderer_version` field in DB triggers re-render when bumped (for future template improvements).

### Quality guardrails in renderer

| Condition | Behavior |
|---|---|
| `quality.confidence >= 0.8` and no `missing_fields` | Render all sections, no watermark beyond badge |
| `quality.confidence < 0.8` or `missing_fields` present | Trigger one follow-up round before publish |
| `dont_know` items | Omit section or show tasteful blank — never fake data |
| Empty `offerings` | Show `HeroSection` + `ContactSection` only (minimal viable site) |

---

## 7. API Shape — Endpoints

All endpoints under existing onboarding router namespace (`/api/onboarding/site/...`).

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/onboarding/site/intake` | Reuse existing `business-info` intake. Extend with `domain`, `contact` fields. |
| `POST` | `/onboarding/site/brief` | LLM site brief generation. Returns brief + `quality` (confidence, missing_fields). |
| `POST` | `/onboarding/site/research` | Run per-page Exa queries from `content_plan.query_map`. Merge research refs into copy. |
| `POST` | `/onboarding/site/theme` | Generate design tokens + CSS (existing `website_style_service`). |
| `POST` | `/onboarding/site/followup` | Max 1 round of targeted questions when `missing_fields`/low confidence. Merge into brief. |
| `POST` | `/onboarding/site/preview` | Render with `ALwrity Preview` watermark → serve from `SITES_DIR/preview/{slug}/`. |
| `POST` | `/onboarding/site/publish` | Final render (no watermark) → `SITES_DIR/{slug}/`, HTTP 200 verify, status=published. |
| `GET` | `/onboarding/site/{slug}/status` | Status + live URL. |
| `POST` | `/onboarding/site/{slug}/rebuild` | Rerender on brief/theme change (renderer_version incremented). |
| `POST` | `/onboarding/site/{slug}/export` | Zip portable bundle (HTML/CSS/assets + markdown source). |

### State transitions via API

```
intake → brief → theme → preview → publish
           ↓
        followup (if needed, max 1 round)
```

---

## 8. Onboarding Integration — No-Website Path

### Where it slots in

```
Step 1: API Keys
Step 2: Website Analysis  ──→  (has website: proceed normally)
                             ──→  (no website: offer Website Builder step)
Step 3: Competitors
Step 4: Persona
Step 5: Integrations
Step 6: Launch  ──→  (if site published: include live_url in SIF/Market Trends tasks)
```

### Frontend wiring

- `BusinessDescriptionStep.tsx` — currently orphaned (only in a comment in `onboardingCache.ts:6-8`). Re-wire to call the new `/onboarding/site/*` endpoints.
- `onboardingCache.ts` — add `websiteState: 'idle' | 'briefing' | 'previewing' | 'published'` key.
- `FinalStep.tsx` — when `website_url` is present, show live site link. When absent, show "Skip for now" (no blocker).

### Backend wiring

- `onboarding_completion_service.py` — when site is published, pass `website_url = f"/u/{slug}"` into SIF and Market Trends task payloads so downstream tasks have a real URL.
- `endpoints_config_data.py` — extend `business-info` intake with optional `contact_email`, `contact_phone`, `contact_location` fields (consumed by the brief LLM).

---

## 9. Free Tier & Business Wedge

| Tier | What's included |
|---|---|
| **Free** | Self-hosted site at `/u/{slug}/`, ALwrity badge in footer, single-page presence, max 6 sections, 1 rebuild/day |
| **Paid (future)** | Custom domain, badge removal, analytics, blog/shop templates, unlimited rebuilds |

### ALwrity badge (free tier)

- Footer: `Powered by ALwrity` with link.
- Not intrusive — matches the design language.
- Serves as organic distribution (every free site advertises ALwrity).

### Usage guardrails

- File-size quota per site: 2 MB total (static HTML + CSS + assets).
- Rebuild throttle: 1/day on free tier, 10/day on paid.
- Slug uniqueness enforced at DB level.

---

## 10. Migration / Export Path

### Export bundle (`POST /onboarding/site/{slug}/export`)

Returns a `.zip` containing:
```
{business-name}-site/
├─ index.html
├─ custom.css
├─ assets/
│  └─ ...
├─ content/
│  ├─ _index.md          # Markdown source for home page
│  ├─ about.md
│  └─ contact.md
└─ site-brief.json       # Full brief + content_plan + theme (for re-import or Hugo migration)
```

This bundle is **self-contained**: any static host (Netlify, Vercel, GitHub Pages, S3) can serve it. The user owns it.

### Future: migrate-to-Hugo (stretch goal)

Given the template types (`blog`, `profile`, `shop`) and Hugo template repos already referenced in `TEMPLATE_REPOS`, a future phase could render the export bundle as Hugo-compatible `config.toml` + markdown, enabling migration to any Hugo host. This is not v1 scope.

---

## 11. What v1 Does NOT Cover (Scope Boundaries)

| Out of scope for v1 | Why |
|---|---|
| Blog / shop / multi-page sites | `one_pager` only. Blog/shop are template types stored but not rendered. |
| CMS / admin panel | No login, no content editing. Sites are generated once, rebuilt via API. |
| Custom domain | Free tier only. Custom domain = paid tier. |
| Analytics | No tracking in v1. Future: Plausible or similar. |
| Google Search Console / SEO submission | Not wired in v1. Future: auto-submit sitemap. |
| Form submissions (contact form) | v1 = `mailto:` links. Future: form handler (Netlify Forms-style). |
| A/B testing / variants | Not in v1. |

---

## 12. Key Files to Touch (Implementation Reference)

| File | What changes |
|---|---|
| `backend/services/onboarding/website_intake_service.py` | ✅ Keep as-is (site brief schema). Only extend `SITE_BRIEF_SCHEMA` if new fields needed. |
| `backend/services/onboarding/website_style_service.py` | ✅ Keep as-is (theme tokens + CSS generation). |
| `backend/api/onboarding_utils/website_automation_service.py` | ❌ **Rewrite.** Replace `_generate_preview_html` with Jinja2 renderer. Replace fake deploy with SITES_DIR writer + HTTP verify. |
| `backend/services/onboarding/website_automation_service.py` | ❌ **Retire.** GitHub/Netlify deploy path removed. |
| `backend/services/user_website_service.py` | ❌ **Replace.** New `user_sites` table + CRUD. |
| `backend/alembic_migrations/versions/` | ➕ New migration: `user_sites` table. |
| `frontend/src/components/OnboardingWizard/BusinessDescriptionStep.tsx` | ❌ **Re-wire.** Connect to new `/onboarding/site/*` endpoints. Remove orphan. |
| `frontend/src/services/onboardingCache.ts` | ➕ Add `websiteState` key. |
| `backend/services/onboarding/completion/onboarding_completion_service.py` | ➕ Wire `website_url` into task payloads when site published. |
| `backend/start_alwrity_backend.py` | ➕ Add `SITES_DIR` env var loading + directory creation on startup. |
| `docs/WEBSITE_MAKER_DESIGN.md` | ➕ This document. |

---

## 13. Phase 1 Success Criteria

| Criterion | How we verify |
|---|---|
| No-website user gets a live site | Business-info intake → brief → theme → preview → publish → `GET /u/{slug}/` returns 200 with real content |
| Brief fields appear in DOM | `grep` rendered `index.html` for business_name, tagline, offerings — no placeholders |
| No fake data | `contact@example.com`, `(555) 123-4567` never appear in rendered output |
| Preview is watermarked | `/u/preview/{slug}/` shows `ALwrity Preview` badge |
| Export bundle is self-contained | Download zip → serve locally → renders correctly |
| 81-entry pricing suite still passes | `pytest backend/tests/` — no regressions |
| Alembic heads single | `alembic heads` shows one head |

---

## 14. Open Questions

1. **Subpath vs subdomain:** `/u/{slug}/` (zero infra) or `{slug}.sites.alwrity.com` (needs wildcard DNS but reads more professional). Recommend: subpath for launch, subdomain later.
2. **SITES_DIR location:** Same volume as backend, or separate static-file volume? Matters at scale.
3. **Preview expiry:** Should preview sites be cleaned up after N days? Or kept indefinitely?
4. **Follow-up round UX:** Modal in the wizard? Or inline in the existing `BusinessDescriptionStep`?
5. **Badge design:** Simple text link? ALwrity logo + text? Needs design input.
