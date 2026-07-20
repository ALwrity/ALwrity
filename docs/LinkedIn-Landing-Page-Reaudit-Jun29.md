# LinkedIn Landing Page — Re-Audit Report (Post-Implementation)

**Page:** Signed-in LinkedIn Studio Dashboard (`/linkedin-writer`, no draft open)  
**Date:** June 29, 2026  
**Scope:** Follow-up audit after approved fixes from the initial audit  

---

## Implementation Summary (Completed This Pass)

| Item | Status |
|------|--------|
| Removed welcome headline (TC 21 reverted) | ✅ Done |
| Connected profile green dot on avatar + permanent “✓ LinkedIn connected” text | ✅ Done |
| Removed hover “?” tooltip on green status dot | ✅ Done |
| Connect welcome modal auto-opens **only for not-connected** users (first visit) | ✅ Done |
| Profile Analysis Ready modal **no longer auto-opens** for connected users | ✅ Done |
| Knowledge Center button −20%, 6-column row on hover, hero shrinks (no overlap) | ✅ Done |
| Knowledge Center label kept as **“Knowledge center”** | ✅ Done |
| TC 28, 29, 30 (alt text, Live Web Research rename, Co-Pilot branding) | ✅ Done |
| Analytics sidebar −20% width (280→224px) | ✅ Done |
| TC 31–48 batch (mobile FAB, analytics copy/CTA, Co-Pilot fallback, Quick Create Esc, page title, etc.) | ✅ Done |
| WatchdogButton mounted for Plan → Watchdog workflow | ✅ Done |

### Second pass (Improvements 1–4 + R-3, R-4, R-5, R-10, R-11, R-12, R-13)

| Item | Status |
|------|--------|
| **Imp 1** — Connect button one-line; connect copy in centered modal (no text behind popup); modal re-opens after disconnect | ✅ Done |
| **Imp 2** — Radial hero fixed 420px center hub; no shrink on KC / errors / modals | ✅ Done |
| **Imp 3** — Green status dot z-index fix; removed “✓ LinkedIn connected” text | ✅ Done |
| **Imp 4** — Watchdog opens via portal (Plan → Watchdog works) | ✅ Done |
| **R-3** — Plan wedge pinned “Recommended first step” hint (session-dismiss) | ✅ Done |
| **R-4** — Plan wedge copy updated | ✅ Done |
| **R-5** — Disconnected Get Topic Ideas / Profile Analytics → OAuth connect | ✅ Done |
| **R-10** — KC grid 6-across horizontal scroll on medium viewports | ✅ Done |
| **R-11** — Analytics sidebar connect-only when disconnected | ✅ Done |
| **R-12** — QA sign-in prerequisite documented | ✅ Done |
| **R-13** — Public image paths verified (`Alwrity-*` vs `ALwrity-*` casing matches build assets) | ✅ Verified |

---

## UI Overlap Policy (Documented)

**Rule:** No dashboard component may visually cover or clip another component’s interactive area.

**How it is enforced in code:**
- Main column uses `flex` column layout: **Radial Hero (fixed 420px height, `flex-shrink:0`) → Knowledge Center (`flex-shrink:0`)**.
- Hero size does **not** change when Knowledge Center expands, modals open, or error snackbars appear.
- Knowledge Center grid uses `width:100%` in document flow (not `position:absolute` over the hero).
- CSS isolation: `.linkedin-dashboard-main { isolation: isolate }` in `alwrity-copilot.css`.
- On viewports `<1100px`, Knowledge Center grid uses horizontal scroll with 6 tiles in a row (no 3-column wrap).

**Manual QA check:** Hover **Knowledge center** → confirm radial wheel **stays the same size** and no tile floats over the profile avatar or wedge labels.

**QA prerequisite (R-12):** Sign in before testing `/linkedin-writer` — the dashboard is the signed-in LinkedIn Studio view, not the public marketing landing page.

---

## PAGE MAP (Top → Bottom)

1. App Header  
2. Tab Bar  
3. Radial Workflow Hero + Center Hub  
4. Knowledge Center Dock  
5. Mobile Analytics Teaser (≤960px)  
6. Analytics Sidebar (desktop)  
7. Mobile Co-Pilot FAB (≤960px)  
8. Global modals / snackbars  

---

# REMAINING ACTION ITEMS

---

## SECTION 1 — APP HEADER

---

**Test Case No:** R-1  
**Audited Section:** App Header — “Today’s Tasks” quick action  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** Button in Content Persona panel still fires an event nothing listens to — dead click.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/Header.tsx` ~line 462 — dispatches `linkedinwriter:showTodaysTasks`; no listener in codebase.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- **Before:** Click **📅 Today's Tasks** → nothing happens.  
- **After option A:** Remove the button until feature exists.  
- **After option B:** Navigate to calendar: `navigate('/content-planning', { state: { activeTab: 1 } })`.  
**Estimated Test Time to Complete:** 3 minutes  

---

## SECTION 2 — TAB BAR

---

**Test Case No:** R-2  
**Audited Section:** Tab bar — “Dashboard” label clarity  
**Evaluation Module:** Module 3  
**Why It Matters / Impact:** New users may not understand this tab is their LinkedIn home base.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/LinkedInWriterTabBar.tsx` line 11 — `label: 'Dashboard'`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- **Before:** `Dashboard`  
- **After:** `Studio Home`  
**Estimated Test Time to Complete:** 2 minutes  

---

## SECTION 3 — RADIAL WORKFLOW HERO

---

**Test Case No:** R-3  
**Audited Section:** Radial wedges — descriptions hidden on touch devices  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Mobile users only see emoji + one word per wedge until they tap.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/dashboard/DashboardRadialWorkflow.tsx` — tooltips on hover/focus only.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- Add first-visit pinned hint on **Plan** wedge for 5 seconds: `"Start here: brainstorm topics and monitor industry news."`  
- Or add `onClick` to pin tooltip until next tap.  
**Estimated Test Time to Complete:** 5 minutes  

---

**Test Case No:** R-4  
**Audited Section:** Plan wedge — copy still vague  
**Evaluation Module:** Module 3  
**Why It Matters / Impact:** “Content strategy” does not tell users what they get.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/dashboard/dashboardWorkflowConfig.ts` lines 24–25.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- **Before:** `Brainstorming, industry watchdog, and content strategy`  
- **After:** `Get AI topic ideas, monitor industry news, and build your posting plan`  
**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** R-5  
**Audited Section:** Analysis / Create actions when LinkedIn not connected  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** **Get Topic Ideas** and **Profile Analytics** still silently fail when disconnected (listeners only mount after connect).  
**Repository Location & Structural Logic:**  
- Events: `WorkflowActionModals.tsx` lines 68–70, 83–86  
- Listeners: `LinkedInProfileSetupPanel.tsx` lines 185–196 (connected only)  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- In `WelcomeMessage.tsx`, listen for these events when disconnected and open the existing **Connect LinkedIn to get started** modal OR call `connectWithOAuth()`.  
**Estimated Test Time to Complete:** 5 minutes  

---

**Test Case No:** R-6  
**Audited Section:** Watchdog — no visible entry point in header  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Watchdog works from Plan modal but is undiscoverable elsewhere.  
**Repository Location & Structural Logic:** `WelcomeMessage.tsx` — `.linkedin-watchdog-mount` hides the button; `WatchdogButton.tsx` has visible UI.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- **Suggestion:** Add a visible **Watchdog** pill in `Header.tsx` (next to Content Persona) OR show badge when unread updates exist.  
- Keep hidden mount for modal routing if header button duplicates open behavior.  
**Estimated Test Time to Complete:** 4 minutes  

---

## SECTION 4 — CONNECTED PROFILE HUB

---

**Test Case No:** R-7  
**Audited Section:** Optimise Profile — tiny ✦ icon on avatar  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Primary optimisation action remains hard to discover on connected dashboard.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/LinkedInConnectedProfileCard.tsx` lines 142–180.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- **Before:** 30px ✦ icon on avatar corner  
- **After:** Visible pill below avatar: **`Optimise Profile →`** using `OptimiseProfileControl` capsule variant  
**Estimated Test Time to Complete:** 4 minutes  

---

**Test Case No:** R-8  
**Audited Section:** Profile Analysis Ready modal — manual access only  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Connected users no longer get auto-popup (by design). They may miss analysis is ready.  
**Repository Location & Structural Logic:** `LinkedInProfileSetupPanel.tsx` — modal still renders but auto-open removed.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- **After:** Show persistent banner under avatar when analysis ready: `"Profile analysis ready — View results"` linking to Optimise Profile.  
**Estimated Test Time to Complete:** 4 minutes  

---

## SECTION 5 — KNOWLEDGE CENTER

---

**Test Case No:** R-9  
**Audited Section:** Knowledge Center — Google-Ground & Assistive open same modal  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Two tiles, one outcome — confusing.  
**Repository Location & Structural Logic:** `WelcomeMessage.tsx` lines 100–108 — both open assistive info modal.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- **Option A:** Merge into one tile **Research-Backed Writing**.  
- **Option B:** Google-Ground opens Co-Pilot with pre-filled research prompt instead of info modal.  
**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** R-10  
**Audited Section:** Knowledge Center — 6-in-a-row on narrow desktop  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Below 1100px width, grid drops to 3 columns (by design). User asked for one line on all sizes.  
**Repository Location & Structural Logic:** `alwrity-copilot.css` — `@media (max-width: 1100px)` grid override.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- **Suggestion:** On medium screens use horizontal scroll single row: `grid-template-columns: repeat(6, minmax(120px, 1fr)); overflow-x: auto` instead of wrapping to 3 columns.  
**Estimated Test Time to Complete:** 4 minutes  

---

## SECTION 6 — ANALYTICS SIDEBAR

---

**Test Case No:** R-11  
**Audited Section:** Analytics — duplicate empty state when disconnected  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Connect CTA box and chart placeholders both show “no data” — slightly redundant.  
**Repository Location & Structural Logic:** `DashboardAnalyticsSidebar.tsx` — `showEmptyConnectCta` plus chart sections with `—`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- When `!connected`, hide chart sections until connected; show only the connect card.  
**Estimated Test Time to Complete:** 3 minutes  

---

## SECTION 7 — GLOBAL

---

**Test Case No:** R-12  
**Audited Section:** Route requires sign-in  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** `/linkedin-writer` redirects unsigned users to marketing homepage — QA must sign in first.  
**Repository Location & Structural Logic:** `frontend/src/App.tsx` — `ProtectedRoute` wrapper.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- Document in QA checklist: **Sign in before testing LinkedIn Studio dashboard.**  
- Optional: add LinkedIn Studio preview section on public `Landing.tsx`.  
**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** R-13  
**Audited Section:** Public image path case sensitivity (Linux production)  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** Mixed casing in `/Alwrity-*` vs `/ALwrity-*` paths may 404 on Linux hosts.  
**Repository Location & Structural Logic:** `frontend/public/` filenames vs references in `knowledgeCenterFeatures.ts`, `InfoModals.tsx`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- Run production Network tab → confirm all Knowledge Center images return HTTP 200.  
- Standardise filenames to lowercase kebab-case OR align every reference to exact public folder spelling.  
**Estimated Test Time to Complete:** 5 minutes  

---

**Test Case No:** R-14  
**Audited Section:** SEO Analytics leaves LinkedIn context  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Navigating to `/seo-dashboard` may disorient users.  
**Repository Location & Structural Logic:** `WorkflowActionModals.tsx` line 97 — `navigate('/seo-dashboard')`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  
- Add breadcrumb on SEO page: `LinkedIn Studio › SEO Analytics`  
- Or open in new tab with `window.open('/seo-dashboard', '_blank')`.  
**Estimated Test Time to Complete:** 4 minutes  

---

## PRIORITY SUMMARY

| Priority | Count | Focus |
|----------|------:|-------|
| 🔴 Critical | 1 | Disconnected Get Topic Ideas / Profile Analytics dead paths (R-5) |
| 🟡 Warning | 8 | Today's Tasks (R-1), Optimise discoverability (R-7), analysis banner (R-8), Watchdog visibility (R-6), etc. |
| 🟢 Optimization | 5 | Tab label (R-2), Plan copy (R-4), KC scroll row (R-10), SEO breadcrumb (R-14), touch tooltips (R-3) |

**Remaining test cases:** 14  
**Estimated manual pass:** ~50 minutes  

---

## Suggestions for Product Team

1. **Connect modal timing:** Auto-open connect modal on first visit helps conversion; consider showing again after 7 days if still disconnected (reset `linkedin_connect_welcome_dismissed` with TTL).  
2. **Watchdog visibility:** Industry Watchdog is a differentiator — a header badge with unread count would increase engagement.  
3. **Overlap regression test:** Add to QA script: expand Knowledge Center + open Connect modal + open Plan modal — verify z-index stacking (modals at 11000+ should always sit on top).

---

## Changes

| Date | Change |
|------|--------|
| 2026-06-29 | **Original audit published** (R-1 through R-14, implementation summary, remaining action items). Content above this section is unchanged from the original re-audit. |
| 2026-07-18 | **Mobile landing audit added.** Full mobile-specific findings (M-1 through M-28) published separately in [`LinkedIn-Studio-Mobile-Landing-Audit-Jul2026.md`](LinkedIn-Studio-Mobile-Landing-Audit-Jul2026.md). Desktop re-audit items R-1–R-14 remain open where not yet fixed; mobile audit adds critical gaps not covered here. |
| 2026-07-18 | **Cross-reference — mobile-only issues:** Analytics right rail hidden at ≤960px while mobile tour still references `[data-tour="li-mobile-analytics"]` (see mobile **M-17**). `.linkedin-mobile-analytics-teaser` CSS exists but no component shipped (**M-18**). Toolbar pills overlap profile hub on small phones (**M-5**). Dead `.linkedin-mobile-resume-bar` CSS after Resume moved to toolbar modal (**M-26**). |
| 2026-07-18 | **Cross-reference — shared desktop/mobile issues:** R-1 (Today's Tasks dead click) = mobile **M-2**; R-4 (Plan copy) = mobile **M-14**; R-5 (disconnected actions) = mobile **M-16**; R-7 (Optimise Profile) = mobile **M-9**. |
| 2026-07-18 | **Code implemented (July 18, 2026):** **M-2 / R-1** — Today's Tasks removed from persona menu (all devices). **M-1, M-3, M-4** — mobile header two-row layout, persona voice hint, hide search when disconnected. **M-5–M-8** — toolbar document flow, Growth Tasks short label (≤640px), tour floating hint, Resume badge. See [`LinkedIn-Studio-Mobile-Landing-Audit-Jul2026.md`](LinkedIn-Studio-Mobile-Landing-Audit-Jul2026.md) Changes section. |
| — | *(Add rows when R-items or linked M-items are implemented and verified.)* |

**Note:** Do not delete original R-1–R-14 findings above when logging fixes — append status here only.
