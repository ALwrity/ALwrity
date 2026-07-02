# Audit: User Navigation Menu (UserBadge.tsx)
**Date:** July 1, 2026  
**Auditor:** AI Full-Stack Code Engineer / Technical UI/UX Auditor  
**Scope:** `frontend/src/components/shared/UserBadge.tsx` — the global avatar-triggered navigation menu used across all ALwrity pages including LinkedIn Studio.

---

## 1. Current State — What the Menu Does

The menu is a **global, context-unaware** dropdown activated by clicking the user avatar in the top-right of every page (including LinkedIn Studio). Rendered via `HeaderControls` → `UserBadge`.

| Section | Content | File Reference | Assessment |
|---|---|---|---|
| User Info Header | Name + email from Clerk | Lines 250–257 | Basic — no AI context |
| Current Plan Chip | Free/Pro/Enterprise + refresh button | Lines 260–291 | Duplicates chip already shown outside the menu |
| System Health | Full `SystemStatusIndicator` component (ops monitoring) | Lines 296–312 | Internal engineering concern — value is debatable for end users |
| Usage Statistics | Compact `UsageDashboard` (API calls, cost by provider) | Lines 316–331 | Useful but generic; not LinkedIn-specific |
| Manage Subscription | Button → `/pricing` | Line 335 | OK |
| View Costing Details | Button → `/billing` | Line 338 | OK |
| Sign Out | Standard action | Line 341 | OK |
| Reset Onboarding | Destructive delete (red styling) | Lines 347–354 | Dangerously prominent — one mis-click destroys all user data |

---

## 2. What AI Data Exists But Is Absent From the Menu

The LinkedIn pipeline (Phases 1–7) produces rich, cached intelligence that the menu never surfaces:

### Phase 5 — `LinkedInAIProfileIntelligence` (always cached after first connect)
- `professional_identity` — single-line AI summary of the user's professional persona
- `primary_expertise[]` — top 2–3 expertise tags
- `brand_positioning` — their unique value statement  
- `target_audience[]` — who they write for
- `writing_opportunities[]` — content angle ideas

**Model:** `AIProfileIntelligenceResponse` in `backend/models/linkedin_social_models.py`  
**Frontend type:** `LinkedInAIProfileIntelligence` in `frontend/src/api/linkedinSocial.ts`

### Phase 3 — `LinkedInProfileValidation` (computed on connect, refreshed on optimization actions)
- `optimization_score` (0–100) — rubric-based best-practice score
- `completeness_score` — basic field completeness check
- `optimization_gaps_count` — number of actionable improvements remaining
- `score_basis` — `rubric` | `rubric_with_progress` | `completeness_fallback`

**Model:** `ProfileValidationResponse` in `backend/models/linkedin_social_models.py`  
**Live update event:** `PROFILE_STRENGTH_UPDATED_EVENT` (dispatched in `useLinkedInProfileOptimization` after batch actions)

### Phase 6 — `LinkedInTopicRecommendation[]` (cached after full pipeline run)
- Personalized topic recommendations with `growth_impact` (High/Medium/Low)

### Phase 7 — `LinkedInProfileOptimizationItem[]` (cached, batched)
- Quick-win actions with `impact`, `effort`, `suggested_copy`, `completion_criteria`

### Persona — `corePersona` / `platformPersona` (from `usePlatformPersonaContext`)
- `persona_name`, `archetype`, `core_belief`, `tonal_range`

---

## 3. Strategic Gap

ALwrity's identity is **AI-First, SME, HITL Thought Leader**. The user navigation menu currently communicates billing and ops — not intelligence.

The avatar click is **prime real-estate** — users open it multiple times per session. It should reflect: *"ALwrity knows who you are, what your LinkedIn profile needs, and what you should create next."*

---

## 4. Five Planned Features (Brainstormed Jul 1, 2026)

### Feature 1 — LinkedIn Identity Mirror Card
Show the user's AI-detected professional identity (from `ai_profile_intelligence`) as a compact card below the user info header.

**Data source:** `LinkedInAIProfileIntelligence.professional_identity`, `primary_expertise`, `brand_positioning`  
**Effort:** 3–4 hours  
**ROI:** Very High — zero new backend; core AI-First positioning  
**Status:** Planned

---

### Feature 2 — "Your #1 LinkedIn Action Today" Priority Card
Surface the highest-value pending optimization item (impact=High, effort=Low) or top topic recommendation directly in the menu.

**Data source:** `LinkedInProfileOptimizationItem[]`, `LinkedInTopicRecommendation[]`  
**Effort:** 4–5 hours  
**ROI:** High — directly drives optimization loop engagement  
**Status:** Planned

---

### Feature 3 — LinkedIn Opportunity Score ✅ IMPLEMENTED Jul 1, 2026
Replace or augment the System Health section with a user-facing LinkedIn Opportunity Score card showing `optimization_score` / 100 with a contextual coaching nudge.

**Data source:** `LinkedInProfileValidation.optimization_score`, `optimization_gaps_count`  
**Live updates:** `PROFILE_STRENGTH_UPDATED_EVENT`  
**Effort:** 2–3 hours  
**ROI:** Highest near-term — turns an opaque metric into a motivating goal  
**Status:** ✅ Implemented — System Health retained; Score added as new section

**Implementation details:**
- `UserBadge.tsx`: Added `linkedInProfileValidation` state, event listener for `PROFILE_STRENGTH_UPDATED_EVENT`
- `Header.tsx`: Added `dispatchProfileStrengthUpdated()` call on initial profile load so the score populates the nav menu immediately when entering LinkedIn Studio (not just after optimization batch actions)
- Renders a `LinearProgress` bar (0–100) with 4-bracket color gradient: red (<40) → orange (<60) → amber (<80) → green (≥80)
- `opportunityNudge()`: coaching string derived from score bracket + `optimization_gaps_count`, with a projected target score (+3 per gap, capped at 100)
- `opportunityScoreColor()`: score-to-color mapping (pure function, no side effects)
- `isRubric` chip: shows "AI Rubric Score" (blue) vs "Completeness Score" (grey) based on `score_basis`
- "Optimise →" CTA: closes menu and dispatches `linkedinwriter:openOptimiseProfile`
- Shows "Connect LinkedIn to see your score" placeholder when `optimization_score` is null/absent
- Section is always rendered in the menu — gracefully hidden to placeholder when outside LinkedIn Studio

---

### Feature 4 — Active Persona Chip with One-Click Swap
Compact clickable persona chip showing the user's active writing voice, linking to Content Persona panel.

**Data source:** `usePlatformPersonaContext()` → `corePersona.persona_name`, `archetype`  
**Effort:** 2 hours  
**ROI:** High — increases persona adoption; all data available  
**Status:** Planned

---

### Feature 5 — Reset Onboarding Safety Relocation + Quick Launch Shortcuts
Part A: Move destructive "Reset Onboarding" behind an "Advanced" collapsible section.  
Part B: Add keyboard shortcut launcher for key LinkedIn Studio actions.

**Effort:** Part A: 30 min | Part B: 2–3 hours  
**ROI:** Part A: Critical safety fix | Part B: Power-user polish  
**Status:** ✅ Part A Implemented Jul 1, 2026 | ✅ Part B Implemented Jul 1, 2026

**Implementation details (Part A):**
- `UserBadge.tsx`: Added `showAdvanced` state (default `false`), reset to `false` on `handleClose()` so it always starts collapsed when the menu reopens
- Replaced the exposed red `MenuItem` with a subtle `▶ Advanced` toggle button (grey, uppercase, 0.7rem)
- On expand: reveals a "Danger Zone" panel with a light red border (`#fee2e2`) and `#fff5f5` background, a warning description, and the reset button styled with a contained border (not filled) so it reads as destructive but not alarming at a glance
- The confirmation `Dialog` is unchanged — still requires a second explicit confirmation before any data is deleted
- Net result: 3 deliberate steps to trigger reset (click Advanced → click Reset Onboarding → click Yes, reset everything) vs the previous 2 (click Reset Onboarding → click Yes)

---

## 5. Implementation Priority Order

| Priority | Feature | Effort | Status |
|---|---|---|---|
| 1 | Feature 3 — LinkedIn Opportunity Score | 2–3 hrs | ✅ Done |
| 2 | Feature 5A — Reset Onboarding Safety | 30 min | ✅ Done |
| 3 | Feature 1 — LinkedIn Identity Mirror | 3–4 hrs | Planned |
| 4 | Feature 4 — Active Persona Chip | 2 hrs | Planned |
| 5 | Feature 2 — #1 Today Priority Card | 4–5 hrs | Planned |
| 6 | Feature 5B — Quick Launch Shortcuts | 2–3 hrs | ✅ Done |

---

## 6. Files Modified (Feature 3 Implementation)

- `frontend/src/components/shared/UserBadge.tsx` — Added LinkedIn Opportunity Score section with live event listener; Reset Onboarding moved behind collapsible Advanced section
- `frontend/src/components/LinkedInWriter/components/Header.tsx` — Added `dispatchProfileStrengthUpdated()` on initial profile load to broadcast score to UserBadge
- `docs/AUDIT_UserNavMenu_Jul1_2026.md` — This document (reference for developers)

---

## 7. Key Event Architecture

| Event Name | Defined In | Dispatched By | Consumed By |
|---|---|---|---|
| `linkedinwriter:profileStrengthUpdated` | `profileStrengthEvents.ts` | `useLinkedInProfileOptimization` (on batch action) | `Header.tsx`, `useLinkedInProfileCompletion`, `UserBadge.tsx` (Feature 3) |
| `linkedinwriter:openOptimiseProfile` | Custom event | `Header.tsx` (on button click) | `LinkedInProfileSetupPanel` / dashboard |
| `linkedinwriter:openBrainstorm` | Custom event | Various | `Header.tsx` |
| `linkedinwriter:openPreferences` | Custom event | Various | `Header.tsx` |
