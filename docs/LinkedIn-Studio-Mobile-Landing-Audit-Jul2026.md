# LinkedIn Studio — Mobile Landing Page Audit

**Page:** Signed-in LinkedIn Studio Dashboard (`/linkedin-writer`, no draft open)  
**Date:** July 18, 2026  
**Viewport scope:** **960px width and below** (phones and small tablets)  
**Repository:** [ALwrity-prod](https://github.com/ALwrity/ALwrity-prod)  
**Audit standard:** Alwrity Master Audit Framework (UI · UX · SEO)  
**Positioning lens:** ALwrity is an AI-first, SME-focused, Human-in-the-Loop (HITL) platform. LinkedIn Studio is the reference studio for other apps. Recommendations favour **expert guidance + human control**, not “fully automated magic.”

---



## QA prerequisites (read before testing)

1. **Sign in** to ALwrity before opening `/linkedin-writer`. Unsigned users are redirected away from this page.
2. Use a **real phone** or Chrome DevTools **Device Toolbar** at these widths: **360px**, **375px**, **390px**, **768px**, **960px**.
3. Test in **portrait** orientation first; repeat key cases in landscape on one phone width.
4. For “not connected” cases, use an account with LinkedIn disconnected (or disconnect in settings).
5. For connect welcome popup, use a fresh browser profile or clear `linkedin_connect_welcome_dismissed_[userId]` in browser storage (developer assist only).

---



## Strategic alignment (four growth pillars)


| Pillar                      | Mobile landing relevance                                               | Finding count (this audit) |
| --------------------------- | ---------------------------------------------------------------------- | -------------------------- |
| 1. Radical time-to-value    | Header height, toolbar overlap, connect modal length, workflow clarity | 9                          |
| 2. Dynamic UX for CTR       | On-page hooks, scannable grid, tour accuracy                           | 6                          |
| 3. Core Web Vitals          | Bottom inset vs Co-Pilot bar, layout shift checks                      | 2                          |
| 4. Authority-loop (E-E-A-T) | HITL copy, trust in connect flow, Co-Pilot positioning                 | 5                          |


---



## Manual test matrix (device and breakpoint)

Run **every test case marked “Matrix: All”** at all five widths. Cases marked with a single width are edge-case checks.


| Width     | Device profile         | What to watch                                                                                  |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| **360px** | Small Android          | Label wrapping, toolbar overlap, modal scroll                                                  |
| **375px** | iPhone SE / mini       | Thumb reach, Co-Pilot bar vs last grid row                                                     |
| **390px** | iPhone 14 / 15         | Default mobile baseline                                                                        |
| **768px** | Tablet portrait        | Header 3-row stack, tour tablet steps                                                          |
| **960px** | Layout breakpoint edge | Switch between mobile grid and desktop radial (should still show mobile layout at exactly 960) |


**Breakpoint sync note for developers:** Layout JS uses **961px** (`useDesktopViewport.ts`). CSS mobile block uses **max-width: 960px**. Header stacks at **768px**. Tour uses **640px** and **960px**. Test at **960px and 961px** side-by-side to catch drift.

---



## PAGE MAP (top → bottom on mobile)

1. App Header (stacked at ≤768px)
2. Main toolbar — Tour `?`, Today’s Growth Tasks, Resume (when draft exists)
3. Profile hub (avatar or connected profile)
4. Connect / Disconnect button below hub
5. Connect welcome popup (first visits / first 3 sessions)
6. Mobile workflow grid — “What would you like to do?”
7. Analytics & Knowledge right rail (**hidden on mobile — see M-15, M-16**)
8. Sticky Co-Pilot bar (bottom)
9. Global overlays — tour, action modals, bottom sheets

---



## Recommended mobile page order (structural Before/After)

Use this table when implementing layout fixes (see M-4, M-15).


| Order | Current (`WelcomeMessage.tsx` render order)      | Recommended mobile order                       |
| ----- | ------------------------------------------------ | ---------------------------------------------- |
| 1     | Header                                           | Header (slimmer — optional)                    |
| 2     | Toolbar overlay on hero (absolute, overlaps hub) | **Toolbar row below header, in document flow** |
| 3     | Profile hub                                      | Profile hub                                    |
| 4     | Connect button                                   | Connect button                                 |
| 5     | Workflow grid                                    | Workflow grid                                  |
| 6     | Right rail (hidden)                              | **Visible mobile Analytics + Knowledge entry** |
| 7     | Co-Pilot bar (fixed bottom)                      | Co-Pilot bar (fixed bottom)                    |


---



# SECTION 1 — APP HEADER

---

**Test Case No:** M-1  
**Priority:** 🟡 Warning  
**Audited Section:** App Header — vertical space on mobile  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** On phones, the header uses up to **three rows** of space before the user sees Studio actions. It feels like settings/admin, not a creator home. Users may scroll or leave before reaching the workflow grid.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/styles/alwrity-copilot.css` — `@media (max-width: 768px)` header grid (approx. lines 2843–2952). `frontend/src/components/LinkedInWriter/components/Header.tsx` — brand row, center controls, search row.  
**Manual test steps:**

1. Sign in. Open `/linkedin-writer` on a **390px** wide screen.
2. Count how many horizontal bands appear in the blue header before the white dashboard content.
3. Measure roughly how much of the first screen is header only (should be less than 25% of viewport height).

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Three stacked rows — (1) LinkedIn logo, (2) profile strength + persona pill, (3) search + GIF + bell + user.
- **After:** Collapse to **two rows** on ≤768px: Row 1 = logo + user menu; Row 2 = search (full width) + icon cluster. Move profile strength into the persona panel only (not a permanent header row).
- **After (copy):** No copy change required for M-1 — layout only.

**Estimated Test Time to Complete:** 5 minutes  
**Matrix:** 375px, 768px  

---

**Test Case No:** M-2  
**Priority:** 🟡 Warning  
**Audited Section:** App Header — “Today’s Tasks” dead click  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** User taps **Today's Tasks** in the Content Persona menu and nothing happens. This breaks trust in ALwrity as a reliable guide. (Same issue as desktop R-1.)  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/Header.tsx` — line ~515 dispatches event `linkedinwriter:showTodaysTasks`; line ~535 button label `📅 Today's Tasks`. No listener found elsewhere in the LinkedIn Writer codebase.  
**Manual test steps:**

1. On mobile width, tap the **Content Persona** pill (person icon) in the header.
2. Tap **📅 Today's Tasks**.
3. **Pass criteria for fix:** User is taken to growth tasks OR calendar OR the button is removed.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Tap **Today's Tasks** → nothing happens.
- **After option A (preferred):** Open the existing **Today's Growth Tasks** dropdown (same as toolbar 🚀 pill) — wire click to toggle that panel.
- **After option B:** Navigate to content planning: label **Open content calendar →** and route to `/content-planning`.
- **After option C:** Remove the menu item until the feature exists.

**Estimated Test Time to Complete:** 3 minutes  
**Matrix:** All  

---

**Test Case No:** M-3  
**Priority:** 🟢 Optimization  
**Audited Section:** App Header — Content Persona label hidden on narrow screens  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** At widths ≤1100px, the text **Content Persona** is hidden and only an icon shows. First-time users may not know what the pill does.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/styles/alwrity-copilot.css` — `@media (max-width: 1100px)` hides persona label. `Header.tsx` — persona pill control.  
**Manual test steps:**

1. At **390px**, find the persona pill in the header.
2. Confirm there is **no visible text label** next to the icon.
3. Tap it — confirm a panel opens (expected).

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Icon-only pill with no label on mobile.
- **After:** Show short label **Persona** next to icon on mobile, OR add `title="Content Persona"` tooltip on long-press (iOS/Android) plus visible helper text on first visit: **Set your writing voice**.

**Estimated Test Time to Complete:** 3 minutes  
**Matrix:** 390px, 768px  

---

**Test Case No:** M-4  
**Priority:** 🟡 Warning  
**Audited Section:** App Header — search disabled when disconnected  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** Disconnected users see a search field that may be disabled or unhelpful on mobile, adding clutter without value.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/Header.tsx` — `LinkedInSearchBar` in header right cluster.  
**Manual test steps:**

1. Disconnect LinkedIn (or use account not connected).
2. At **390px**, try to use the search field in the header.
3. Note whether the field is disabled, empty, or confusing.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Search visible in header row 3 when disconnected.
- **After:** Hide search on mobile when disconnected, OR replace placeholder with: **Connect LinkedIn to search your posts** (tapping opens connect flow).

**Estimated Test Time to Complete:** 4 minutes  
**Matrix:** 390px  

---



# SECTION 2 — MAIN TOOLBAR (Tour, Growth Tasks, Resume)

---

**Test Case No:** M-5  
**Priority:** 🟡 Warning  
**Audited Section:** Toolbar — overlaps profile hub  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Tour, Growth, and Resume pills sit **on top of** the profile avatar area. On small phones the user's face/logo and the **?** button compete for the same space.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/styles/alwrity-copilot.css` — `.linkedin-dashboard-main-toolbar` (approx. lines 580–610): `position: absolute; top: 8px; left: 8px; z-index: 25`. `frontend/src/components/LinkedInWriter/components/WelcomeMessage.tsx` — toolbar render block.  
**Manual test steps:**

1. At **375px**, open `/linkedin-writer` (connected or not).
2. Look at top-left of the white dashboard area.
3. **Fail if:** Any part of the **?** circle or Growth pill covers the LinkedIn avatar circle.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Toolbar `position: absolute` over hero with no top padding on hero stage.
- **After:** Move toolbar **below header, in normal document flow** (see structural table above). Add `padding-top` on `.linkedin-dashboard-hero-stage` equal to toolbar height when overlay approach is kept temporarily.
- **Layout:** Toolbar stack order stays: **?** → **Today's Growth Tasks** → **Resume**.

**Estimated Test Time to Complete:** 5 minutes  
**Matrix:** 360px, 375px, 390px  

---

**Test Case No:** M-6  
**Priority:** 🟡 Warning  
**Audited Section:** Toolbar — “Today's Growth Tasks” label length  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** The full label **Today's Growth Tasks** is long for narrow screens. It may wrap to two lines or feel cramped, reducing scanability.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/dashboard/TodayGrowthWalkthrough.tsx` — `DashboardRailIconButton` label prop. `DashboardRailIconButton.tsx` — `iconLeading`, `emojiIcon="🚀"`. CSS: `.linkedin-dashboard-main-toolbar .linkedin-rail-icon-trigger--icon-leading`.  
**Manual test steps:**

1. At **360px** and **390px**, inspect the Growth pill.
2. Confirm the **full** label is readable without clipping.
3. Note if label wraps to two lines (acceptable if fully visible).

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Label `Today's Growth Tasks` on all mobile widths.
- **After option A:** Keep full label but ensure pill `max-width: calc(100vw - 24px)` and allow two-line wrap (already partially in CSS — verify visually).
- **After option B (≤640px only):** Shorten visible label to **Growth Tasks** while keeping `aria-label="Today's Growth Tasks"`.

**Estimated Test Time to Complete:** 4 minutes  
**Matrix:** 360px, 390px  

---

**Test Case No:** M-7  
**Priority:** 🟢 Optimization  
**Audited Section:** Toolbar — Tour guide tooltip on touch devices  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** The words **Tour guide** appear only on hover (CSS `::after`). Phone users never see that hint unless they use a screen reader (`aria-label="Tour guide"`).  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/styles/alwrity-copilot.css` — `.linkedin-studio-tour-trigger--tooltip::after`. `WelcomeMessage.tsx` — tour button.  
**Manual test steps:**

1. On a **real phone**, tap the **?** circle once (do not long-press).
2. Confirm whether any **Tour guide** text appears before the tour starts.
3. **Expected today:** No visible label on tap; tour may start or require second interaction depending on implementation.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Hover-only tooltip **Tour guide**.
- **After:** On first visit only, show a 3-second floating label **Tour guide** under the **?** button, OR add visible micro-label **Tour** under the icon on ≤640px (icon stays circular).

**Estimated Test Time to Complete:** 3 minutes  
**Matrix:** 390px (real device preferred)  

---

**Test Case No:** M-8  
**Priority:** 🟢 Optimization  
**Audited Section:** Toolbar — Resume pill visibility  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Resume only appears when a draft exists. Users with a saved draft may miss it if the pill is below the fold or overlapped.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/dashboard/ResumeDraftRailChip.tsx` — returns `null` when `!draft`. `WelcomeMessage.tsx` — passes `draft` prop.  
**Manual test steps:**

1. Create a draft in LinkedIn Studio (start a post, type one line, navigate back to dashboard).
2. At **390px**, confirm **Resume** pill appears below Growth pill with icon before label.
3. Tap **Resume** — light modal **Resume Draft** opens (not hover popover).

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Resume pill with no draft indicator elsewhere.
- **After:** When draft exists, add a small **dot badge** on the Resume icon (orange) so users notice without reading the label.

**Estimated Test Time to Complete:** 5 minutes  
**Matrix:** 390px  

---



# SECTION 3 — PROFILE HUB AND CONNECT

---

**Test Case No:** M-9  
**Priority:** 🟡 Warning  
**Audited Section:** Profile hub — Optimise Profile hard to find (connected users)  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** On mobile there is no hover. A tiny control on the avatar is easy to miss. Users may never discover profile optimisation — a key ALwrity differentiator. (Related to desktop R-7.)  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/LinkedInConnectedProfileCard.tsx` or profile setup panel — small optimise control on avatar.  
**Manual test steps:**

1. Connect LinkedIn. Open dashboard at **390px**.
2. Try to find **Optimise Profile** without using the tour.
3. Time how long it takes (target: under 10 seconds for fix validation).

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Small icon on avatar corner only.
- **After:** Add a full-width pill below avatar: `Optimise Profile →` (min height 44px, tappable).

**Estimated Test Time to Complete:** 5 minutes  
**Matrix:** 390px  

---

**Test Case No:** M-10  
**Priority:** 🟡 Warning  
**Audited Section:** Connect welcome popup — copy length on small screens  
**Evaluation Module:** Module 3  
**Why It Matters / Impact:** Popup title and benefits list may require scrolling inside the modal on small phones. Users may miss **Connect LinkedIn⚡** or **Explore first**.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/LinkedInConnectionPlaceholder.tsx` — constants lines 33–44: title **Let's Supercharge Your LinkedIn! 🔥**, lead **Connect your account to unlock full power of ALwrity**, benefits list, reassurance paragraph, CTAs **Connect LinkedIn⚡** / **Explore first**.  
**Manual test steps:**

1. Use account within first **3 login sessions** and not dismissed welcome (or reset storage with dev help).
2. At **375px**, open dashboard disconnected.
3. Without scrolling inside the modal, confirm both buttons are visible.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before lead:** `Connect your account to unlock full power of ALwrity`
- **After lead:** `Your AI co-pilot for LinkedIn — you stay in control of every post.`
- **Before reassurance (long):** `Not ready to commit just yet? No worries! You can still explore our planning and creation tools without connecting.`
- **After reassurance (shorter):** `Explore planning and creation tools first — connect when you're ready to publish.`
- **Layout:** Reduce modal vertical padding on ≤640px so CTAs sit above the fold.

**Estimated Test Time to Complete:** 6 minutes  
**Matrix:** 375px, 390px  

---

**Test Case No:** M-11  
**Priority:** 🟢 Optimization  
**Audited Section:** Connect button — touch target size  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** Connect is the main conversion action for disconnected mobile users. Button must be easy to tap with a thumb.  
**Repository Location & Structural Logic:** `LinkedInConnectionPlaceholder.tsx` — `CONNECT_BUTTON_STYLE` minWidth 220, padding 12px 40px. CSS `@media (max-width: 960px)` connect touch rules (~lines 2188–2220 in `alwrity-copilot.css`).  
**Manual test steps:**

1. At **390px**, disconnected, locate **Connect LinkedIn⚡** below avatar.
2. Use Chrome DevTools inspect — confirm button height ≥ **44px**.
3. Tap with thumb — single tap registers (no mis-taps).

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before/After:** If height < 44px, set `min-height: 48px` and `width: 100%` max `320px` centered on mobile.

**Estimated Test Time to Complete:** 3 minutes  
**Matrix:** 390px  

---

**Test Case No:** M-12  
**Priority:** 🟢 Optimization  
**Audited Section:** Connect welcome — session window (first 3 logins)  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** Popup shows for first **3 browser sessions** per user unless dismissed. QA must understand this to avoid false “bug” reports.  
**Repository Location & Structural Logic:** `LinkedInConnectionPlaceholder.tsx` — `MAX_CONNECT_WELCOME_LOGIN_COUNT = 3`, localStorage keys `linkedin_connect_welcome_login_count_`*, sessionStorage `linkedin_connect_welcome_session_counted_*`.  
**Manual test steps:**

1. Session 1: popup shows (if not dismissed).
2. Dismiss with **Explore first** — popup should not return.
3. New session without dismiss: count increments until session 4 — popup stops.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Documentation only:** Add to QA checklist — no code change required unless product wants TTL reset after 7 days (product suggestion).

**Estimated Test Time to Complete:** 8 minutes (multi-session)  
**Matrix:** 390px  

---



# SECTION 4 — MOBILE WORKFLOW GRID

---

**Test Case No:** M-13  
**Priority:** 🟢 Optimization  
**Audited Section:** Workflow grid — too many choices at once  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** User sees **6 cards** plus toolbar pills, connect, and Co-Pilot bar. Master Framework guidance: flag screens with more than **3–4 competing choices**. Risk of decision fatigue for busy SME users.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/dashboard/DashboardMobileWorkflowGrid.tsx` — 2×3 grid. `dashboardWorkflowConfig.ts` — six cards.  
**Manual test steps:**

1. At **390px**, count primary actions visible without scrolling on first screen.
2. Include: Tour, Growth, Connect, six cards, Co-Pilot bar.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Six equal cards on first scroll.
- **After (phased):** Highlight **Plan** and **Create** as primary row; collapse **Engagement** and **Remarket** under **More actions** accordion OR show “Recommended for you” two-card row first (HITL: start with strategy, then create).

**Estimated Test Time to Complete:** 4 minutes  
**Matrix:** 390px  

---

**Test Case No:** M-14  
**Priority:** 🟡 Warning  
**Audited Section:** Workflow grid — Plan card copy still vague  
**Evaluation Module:** Module 3  
**Why It Matters / Impact:** Mobile card description **Brainstorm ideas, Watchdog news, and weekly plans** is better than desktop wedge but still jargon-heavy (**Watchdog**). SMEs may not know what Plan does. (Related to R-4.)  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/components/dashboard/dashboardWorkflowConfig.ts` — `WORKFLOW_MOBILE_DESCRIPTIONS.plan` line ~120; desktop `description` line ~59.  
**Manual test steps:**

1. Read **Plan** card at **390px** without prior ALwrity knowledge.
2. Ask: “What will happen if I tap this?” — answer should be obvious.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before (mobile desc):** `Brainstorm ideas, Watchdog news, and weekly plans`
- **After (mobile desc):** `Get AI topic ideas, track industry news, and build your posting plan`
- **Before (grid title):** `What would you like to do?`
- **After (grid title):** `What should we work on today?`

**Estimated Test Time to Complete:** 3 minutes  
**Matrix:** All  

---

**Test Case No:** M-15  
**Priority:** 🟢 Optimization  
**Audited Section:** Workflow grid — “Start here” badge on Plan  
**Evaluation Module:** Module 3  
**Why It Matters / Impact:** Positive pattern — guides HITL journey (plan first, human review later). Aligns with thought-leader positioning.  
**Repository Location & Structural Logic:** `DashboardMobileWorkflowGrid.tsx` — badge **Start here**, `PLAN_PINNED_HINT_KEY` session dismiss. Hint text: **Tip: Most creators begin with Plan, then Create.**  
**Manual test steps:**

1. Fresh session at **390px** — confirm **Start here** badge on Plan card.
2. Tap Plan — badge should dismiss for session.
3. Confirm hint line appears below grid (if motion not reduced).

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Keep as-is.** Optional: change hint to **Plan with AI, create with your voice, publish when you're ready.**

**Estimated Test Time to Complete:** 4 minutes  
**Matrix:** 390px  

---

**Test Case No:** M-16  
**Priority:** 🟡 Warning  
**Audited Section:** Workflow grid — disconnected actions (Plan/Create vs Analysis)  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** Some actions may silently fail or show errors when LinkedIn is not connected (related to R-5 on desktop). Mobile users need a clear **Connect first** message.  
**Repository Location & Structural Logic:** `WelcomeMessage.tsx` — connection gate listeners. `WorkflowActionModals.tsx` — event handlers.  
**Manual test steps:**

1. Disconnected, **390px**.
2. Tap **Analysis**, **Create** (Get Topic Ideas path), **Publish**.
3. **Pass:** Each either works in offline/planning mode OR opens connect modal with clear copy.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** Silent failure or empty modal.
- **After:** Unified modal title **Connect LinkedIn to continue** body **This action needs your LinkedIn profile. You can still use Plan and Create without connecting.**

**Estimated Test Time to Complete:** 8 minutes  
**Matrix:** 390px  

---



# SECTION 5 — ANALYTICS AND KNOWLEDGE (MOBILE GAP)

---

**Test Case No:** M-17  
**Priority:** 🔴 Response Time  
**Audited Section:** Analytics rail hidden but tour references it  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** The guided tour tells mobile users to **scroll for Analytics**, but the Analytics panel is **hidden** on screens ≤960px. The tour spotlight points at nothing useful — broken onboarding.  
**Repository Location & Structural Logic:**  

- CSS hide: `alwrity-copilot.css` line ~2351 — `.linkedin-dashboard-right-rail { display: none !important; }` inside `@media (max-width: 960px)`.  
- Tour copy: `frontend/src/utils/walkthroughs/linkedInStudioTourSteps.ts` — `MOBILE_ANALYTICS_STEP` lines ~241–250: *“Scroll for your Analytics card and Knowledge Center…”*; target `[data-tour="li-mobile-analytics"]` on `DashboardRightRail.tsx`.  
**Manual test steps:**

1. At **390px**, start **Tour guide** from **?** button.
2. Advance until step titled **Analytics & Knowledge**.
3. **Fail today:** Spotlight targets hidden/off-screen rail; user cannot complete step as described.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before tour content:** `Scroll for your Analytics card and Knowledge Center — view post stats, open your library, and explore ALwrity features.`
- **After option A (preferred):** Ship visible mobile Analytics section; update tour to **Tap Analytics below to view post stats and open your Library.**
- **After option B (quick fix):** Remove analytics step from mobile tour until mobile UI exists.

**Estimated Test Time to Complete:** 6 minutes  
**Matrix:** 390px, 768px  

---

**Test Case No:** M-18  
**Priority:** 🔴 Response Time  
**Audited Section:** Mobile analytics teaser — CSS only, never shipped  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** Styles exist for `.linkedin-mobile-analytics-teaser` but **no React component** renders it. CSS also sets `display: none !important` on mobile (line ~~2405). Feature was planned but not delivered.~~  
~~**Repository Location & Structural Logic:**~~ `alwrity-copilot.css` ~~—~~ `.linkedin-mobile-analytics-teaser` ~~(~~lines 1968–1981, 2405–2407). No `.tsx` reference in codebase.  
**Manual test steps:**

1. Search rendered page HTML at **390px** for text **Analytics** outside hidden rail.
2. **Fail today:** No teaser button in DOM.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **After:** Add component `DashboardMobileAnalyticsTeaser.tsx` with button label **View Analytics & Library →** placed **below workflow grid**, opening analytics modal or expanding inline panel.
- **Copy (teaser):** `Track post performance and open your content library — in one place.`

**Estimated Test Time to Complete:** 4 minutes  
**Matrix:** 390px  

---

**Test Case No:** M-19  
**Priority:** 🟡 Warning  
**Audited Section:** Knowledge Center — no landing entry on mobile  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Library, Best Practices, and Feature Map live in the desktop right rail. Mobile users must discover them through workflow modals — easy to miss ALwrity’s educational/thought-leader content.  
**Repository Location & Structural Logic:** `DashboardRightRail.tsx` — Library + KnowledgeCenterDock (hidden on mobile). `KnowledgeCenterDock.tsx` — inline panel logic unused when rail hidden.  
**Manual test steps:**

1. At **390px**, try to find **Knowledge center** or **Library** from landing without opening Plan/Create modals.
2. **Fail today:** No direct entry on landing.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **After:** Pair with M-18 — single mobile section **Analytics & Knowledge** with two buttons: **Analytics** | **Knowledge & Library**.

**Estimated Test Time to Complete:** 5 minutes  
**Matrix:** 390px  

---



# SECTION 6 — STICKY CO-PILOT BAR

---

**Test Case No:** M-20  
**Priority:** 🟡 Warning  
**Audited Section:** Co-Pilot bar — covers last workflow row  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Fixed bottom bar plus main `padding-bottom` must match. If inset is too small, the last row of cards (e.g. **Remarket**) is hidden under the bar.  
**Repository Location & Structural Logic:** `alwrity-copilot.css` — `--li-mobile-bottom-inset: 96px` (960px block), `80px` at ≤430px. `.linkedin-dashboard-main` `padding-bottom`. `DashboardMobileCopilotBar.tsx` — bar min-height 52px + padding.  
**Manual test steps:**

1. At **390px**, scroll to bottom of workflow grid.
2. Confirm **Remarket** card is fully visible above Co-Pilot bar.
3. Repeat at **360px**.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** If clipped, inset too small.
- **After:** Set `--li-mobile-bottom-inset` to **bar height + 24px** (measure rendered bar ≈ 72–80px → use **104px** inset minimum).

**Estimated Test Time to Complete:** 4 minutes  
**Matrix:** 360px, 390px  

---

**Test Case No:** M-21  
**Priority:** 🟢 Optimization  
**Audited Section:** Co-Pilot bar — copy and HITL positioning  
**Evaluation Module:** Module 3  
**Why It Matters / Impact:** Placeholder **Ask ALwrity Co-Pilot…** supports AI-first positioning. Should imply human oversight, not autopilot.  
**Repository Location & Structural Logic:** `DashboardMobileCopilotBar.tsx` line ~54 — `Ask ALwrity Co-Pilot…`; CTA **Ask**; `aria-label="Ask ALwrity Co-Pilot"`.  
**Manual test steps:**

1. Read bar copy at **390px**.
2. Tap bar — Co-Pilot sidebar opens.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** `Ask ALwrity Co-Pilot…`
- **After (optional A/B):** `Ask your Co-Pilot — draft, refine, you publish`
- **Keep CTA pill:** `Ask`

**Estimated Test Time to Complete:** 3 minutes  
**Matrix:** 390px  

---

**Test Case No:** M-22  
**Priority:** 🟡 Warning  
**Audited Section:** Co-Pilot bar — keyboard overlap  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** When keyboard opens, bar should move up (`visualViewport` logic). If it fails, input area is blocked on real devices.  
**Repository Location & Structural Logic:** `DashboardMobileCopilotBar.tsx` — `keyboardOffset` state, lines 16–31.  
**Manual test steps:**

1. On **real phone**, tap Co-Pilot bar, focus chat input.
2. Confirm bar/input is not hidden behind keyboard.
3. Dismiss keyboard — bar returns to bottom.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before/After:** If bar stays under keyboard, increase offset calculation threshold or use `visualViewport.offsetTop` in bottom style (developer fix).

**Estimated Test Time to Complete:** 5 minutes  
**Matrix:** Real device required  

---



# SECTION 7 — GLOBAL (TOUR, SEO, ACCESSIBILITY, CLEANUP)

---

**Test Case No:** M-23  
**Priority:** 🟡 Warning  
**Audited Section:** Page title — no meta description  
**Evaluation Module:** Module 3  
**Why It Matters / Impact:** Browser tab shows **LinkedIn Studio | ALwrity** but there is no meta description for bookmarks, shares, or search snippets.  
**Repository Location & Structural Logic:** `frontend/src/components/LinkedInWriter/LinkedInWriter.tsx` line ~176 — `document.title = 'LinkedIn Studio | ALwrity'` only. No React Helmet / meta tags on this route.  
**Manual test steps:**

1. Open `/linkedin-writer`. View page source or Elements — search `meta name="description"`.
2. **Fail today:** No route-specific description.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **After meta description:** `Plan, create, and publish LinkedIn content with ALwrity's AI Co-Pilot — you stay in control of every post.`
- **After Open Graph title:** `LinkedIn Studio | ALwrity`

**Estimated Test Time to Complete:** 3 minutes  
**Matrix:** N/A (source check)  

---

**Test Case No:** M-24  
**Priority:** 🟡 Warning  
**Audited Section:** Heading hierarchy — H1 is brand-only  
**Evaluation Module:** Module 3  
**Why It Matters / Impact:** The only **H1** is **LinkedIn / Studio** in the header — brand naming, not user value. Screen readers and SEO benefit from a clear value statement.  
**Repository Location & Structural Logic:** `Header.tsx` — `h1` with **LinkedIn** / **Studio**. Workflow grid uses `h2` **What would you like to do?**  
**Manual test steps:**

1. Use accessibility tree or HeadingsMap extension at **390px**.
2. Confirm one H1, logical H2 order.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **After:** Add visually subtle subtitle under header (not new H1): **Your AI-powered LinkedIn workspace** as `p` with class `linkedin-dashboard-value-prop`, OR change H2 to include value: **What should we work on today?**

**Estimated Test Time to Complete:** 3 minutes  
**Matrix:** 390px  

---

**Test Case No:** M-25  
**Priority:** 🟡 Warning  
**Audited Section:** Breakpoint fragmentation  
**Evaluation Module:** Module 1  
**Why It Matters / Impact:** Layout, header, and tour use different breakpoints (961, 960, 768, 640). QA may see different behaviour at 960 vs 961px or tablet vs phone.  
**Repository Location & Structural Logic:**  

- `frontend/src/components/LinkedInWriter/hooks/useDesktopViewport.ts` — 961px  
- `frontend/src/components/LinkedInWriter/components/dashboard/dashboardLayoutConstants.ts`  
- `alwrity-copilot.css` — multiple `@media` blocks  
- `linkedInStudioTourSteps.ts` — `TOUR_BREAKPOINT_*`  
**Manual test steps:**

1. Set width **960px** — mobile grid visible, no radial ring.
2. Set width **961px** — desktop radial visible, no mobile grid.
3. Set **768px** — header stacks to 3 rows.
4. Document any unexpected mix (e.g. desktop header + mobile grid).

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **After:** Document single **Mobile Studio** breakpoint at **960px** in `docs/dashboardDesktopHeroPlacement.md` and align tour breakpoints to match where possible.

**Estimated Test Time to Complete:** 10 minutes  
**Matrix:** 960px, 961px, 768px, 640px  

---

**Test Case No:** M-26  
**Priority:** 🟢 Optimization  
**Audited Section:** Dead CSS — mobile resume bar  
**Evaluation Module:** Module 2  
**Why It Matters / Impact:** Styles for `.linkedin-mobile-resume-bar` still set `display: flex` on mobile, but UI uses toolbar **Resume** pill + modal. Dead code confuses future QA and agents.  
**Repository Location & Structural Logic:** `alwrity-copilot.css` — `.linkedin-mobile-resume-bar` (~lines 1916–1965, 2409–2411). No TSX usage after Resume toolbar migration.  
**Manual test steps:**

1. Search codebase for `linkedin-mobile-resume-bar` in `.tsx` files — expect zero.
2. On device, confirm resume UX is toolbar only.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **After:** Remove unused `.linkedin-mobile-resume-bar` CSS block OR add comment `/* deprecated — use ResumeDraftRailChip */` and delete rules.

**Estimated Test Time to Complete:** 2 minutes  
**Matrix:** N/A (code review)  

---

**Test Case No:** M-27  
**Priority:** 🟢 Optimization  
**Audited Section:** Tour — done step HITL messaging  
**Evaluation Module:** Module 3  
**Why It Matters / Impact:** Final tour step should reinforce Plan → Create → human review → Publish loop (thought-leader, HITL).  
**Repository Location & Structural Logic:** `linkedInStudioTourSteps.ts` — `COMPACT_DONE_STEP` / `DONE_STEP` content strings.  
**Manual test steps:**

1. Complete mobile tour at **390px**.
2. Read final card copy.

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Before:** `Replay this tour from the Tour button. Try Plan or Create to make your first post.`
- **After:** `You're set. Start with Plan, draft in Create, review every word, then Publish when it sounds like you. Replay anytime from ?.`

**Estimated Test Time to Complete:** 4 minutes  
**Matrix:** 390px  

---

**Test Case No:** M-28  
**Priority:** 🟡 Warning  
**Audited Section:** Accessibility — Co-Pilot avatar alt text  
**Evaluation Module:** Module 2 (Global accessibility)  
**Why It Matters / Impact:** Bar uses `<img alt="" aria-hidden>` — decorative OK if button has `aria-label`. Verify screen reader announces button correctly.  
**Repository Location & Structural Logic:** `DashboardMobileCopilotBar.tsx` lines 48–53, 46.  
**Manual test steps:**

1. VoiceOver (iOS) or TalkBack (Android): focus Co-Pilot bar.
2. **Pass:** Announces **Ask ALwrity Co-Pilot** (or improved label from M-21).

**Actionable Recommendation & Concrete Before/After Adjustments:**

- **Keep** `aria-label` on button; ensure it matches visible intent after any copy change.

**Estimated Test Time to Complete:** 5 minutes  
**Matrix:** Real device + screen reader  

---

## Issue #106 post-implementation review (M-29 through M-38)

**Page:** LinkedIn Studio home — `/linkedin-writer` (signed in, no draft open)  
**Added:** July 18, 2026 — Master Framework + Issue #106 Level 2 review  

**Current PAGE MAP (as of 2026-07-18):**

| Order | What the user sees (top → bottom) |
|------:|-----------------------------------|
| 1 | Blue header: LinkedIn / Studio, GIF, bell, user, tour **?** |
| 2 | LinkedIn Search strip (**connected only** on mobile ≤768px) |
| 3 | **Studio quick actions** — one segmented row above workflow title (Growth, Resume, Persona, Optimise) |
| 4 | **What are You / Creating today 🎯** + inline profile combo pill (avatar inside Connect/Disconnect, swipe photo → link / ← unlink) |
| 5 | Smart studio nudge on mobile (connect / profile strength only — **priority nudge on desktop toolbar**) |
| 6 | Six workflow cards (2 columns, icon + title + description) |
| 7 | Analytics · Knowledge center · Library (one row) |
| 8 | Round Co-Pilot button (bottom-right) |

---

**Test Case No:** M-29  
**Priority:** 🟢 Optimization  
**Audited Section:** PAGE MAP accuracy  
**Manual test steps:** Width **390**. Scroll once top to bottom. **Pass:** Order matches table above.  
**Matrix:** 390px  

---

**Test Case No:** M-30  
**Priority:** 🟡 Warning  
**Audited Section:** Workflow grid — card descriptions  
**Manual test steps:**

1. Width **390**. Inspect all six cards.
2. **Pass:** Each card shows **icon + title + one grey helper line** (max 2 lines), matching desktop descriptions (e.g. Plan → *Brainstorming, industry watchdog, and content strategy*).

**Matrix:** 360px, 390px  

---

**Test Case No:** M-31  
**Priority:** 🟡 Warning  
**Audited Section:** Mobile header first-screen space  
**Manual test steps:**

1. Width **390** (disconnected: two bands; connected: nav + search + tabs).
2. **Pass:** Header uses slimmer bands (nav ~48px, tab row ~52px each); **at least half of one workflow card** visible without scrolling.

**Matrix:** 375px, 390px  

---

**Test Case No:** M-32  
**Priority:** 🟡 Warning  
**Audited Section:** Analytics quick stats (Issue #106 gap)  
**Status:** **Not implemented** — pending product approval.  
**Manual test steps:** Connected user with posts. **Fail today:** Analytics row shows icon + label only; no inline stats teaser.  
**Matrix:** 390px (connected)  

---

**Test Case No:** M-33  
**Priority:** 🟡 Warning  
**Audited Section:** Co-Pilot + phone keyboard  
**Manual test steps (real phone required):**

1. Tap Co-Pilot FAB (bottom-right).
2. Focus message box; keyboard opens.
3. Type a full sentence.
4. **Pass:** Input stays above keyboard; text visible; Send works.

**Matrix:** Real device only  

---

**Test Case No:** M-34  
**Priority:** 🟡 Warning  
**Audited Section:** Studio tab labels  
**Manual test steps:**

1. Width **360**. Confirm all four tabs appear in **one horizontal row** with full two-line labels: **Today's Grow** / **Tasks**, **Resume** / **Work**, **Content** / **Persona**, **Optimise** / **Profile** (label above icon).
2. **Pass:** Complete titles visible (~9–11px); selected tab uses soft blue background (no row pop); tabs scroll horizontally on narrow widths if needed; each tab opens the same modal/dropdown as before.

**Matrix:** 360px, 390px  

---

**Test Case No:** M-34b  
**Priority:** 🟢 Optimization  
**Audited Section:** Mobile profile hub — swipe hint & gesture  
**Manual test steps:**

1. Width **390**, disconnected. Title and profile strip pill sit on **one row**; swipe hint below reads **→ Swipe to link** (no “LinkedIn” on Connect button).
2. Swipe the strip right (~72px+). **Pass:** Connect flow starts.
3. Connected: button label **Disconnect** (red/white); hint **← Swipe to unlink**; left swipe triggers disconnect.

**Matrix:** 390px (real device preferred)  

---

**Test Case No:** M-35  
**Priority:** 🟢 Optimization  
**Audited Section:** Search strip when disconnected  
**Manual test steps:**

1. LinkedIn **not connected**. Width **390**.
2. **Pass:** No grey LinkedIn Search strip in header (two-band header: nav + tabs only).

**Matrix:** 390px (disconnected)  

---

**Test Case No:** M-39  
**Priority:** 🟢 Optimization  
**Audited Section:** Profile hub + workflow header  
**Manual test steps:**

1. Width **390**. Locate **What would you like to do?** — profile strip (avatar + Connect/Disconnect) must sit **on the same row**, after the title.
2. **Pass:** No full-width profile strip below the six cards; hero hub area does not add empty scroll gap.
3. Below the header row, a **context nudge** appears (connect guidance, profile strength, priority action, or HITL tip) — dismissible with **×**.

**Matrix:** 360px, 390px (connected + disconnected)  

---

**Test Case No:** M-36  
**Priority:** 🟢 Optimization  
**Audited Section:** Library navigation  
**Status:** **Not implemented** — pending product approval.  
**Matrix:** 390px  

---

**Test Case No:** M-37  
**Priority:** 🟡 Warning  
**Audited Section:** Page meta description (M-23)  
**Status:** **Not implemented** — pending product approval.  
**Matrix:** Page source check  

---

**Test Case No:** M-38  
**Priority:** 🟢 Optimization  
**Audited Section:** Mobile value-prop heading  
**Status:** **Not implemented** — pending product approval.  
**Matrix:** 390px  

---



# GLOBAL ISSUES SUMMARY


| ID                     | Priority         | Theme                                                          |
| ---------------------- | ---------------- | -------------------------------------------------------------- |
| M-17, M-18, M-19       | 🔴 Response Time | Analytics/Knowledge missing on mobile while tour promises them |
| M-5, M-20              | 🟡 Warning       | Layout overlap (toolbar, bottom bar)                           |
| M-2, M-16              | 🟡 Warning       | Dead clicks / connection gates                                 |
| M-23, M-24             | 🟡 Warning       | SEO and heading value prop                                     |
| M-25                   | 🟡 Warning       | Breakpoint drift risk                                          |
| M-13, M-14, M-21, M-27 | 🟢 Optimization  | Copy and cognitive load (HITL positioning)                     |


---



## PRIORITY SUMMARY


| Priority         | Count | Fix within                      |
| ---------------- | ----- | ------------------------------- |
| 🔴 Response Time | 2     | 48 hours (tour + analytics gap) |
| 🟡 Warning       | 14    | Current sprint                  |
| 🟢 Optimization  | 8     | Backlog                         |


**Total test cases:** 28  
**Estimated full manual pass:** ~95 minutes (use matrix to split across devices)

---



## Suggestions for product team (HITL / thought-leader positioning)

1. **Mobile Analytics is not optional** for a “Studio” positioning — SMEs expect to see performance somewhere on the landing page; ship teaser or inline card before next marketing push.
2. **Copy tone:** Prefer “co-pilot”, “you review”, “your voice” over “unlock full power” / “supercharge” — aligns with HITL trust.
3. **Regression script:** After any mobile layout change, run M-5, M-17, M-20 on 375px before release.
4. **Cross-reference:** Desktop items R-1, R-4, R-5, R-7 in `LinkedIn-Landing-Page-Reaudit-Jun29.md` still affect mobile behaviour — track together.

---



## QA checklist notes


| Item                                      | What to verify                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **M-12 — Connect welcome session window** | The connect welcome popup appears for the **first 3 browser sessions** per signed-in user unless dismissed via **Explore first**. Session counting uses `localStorage` key `linkedin_connect_welcome_login_count_{userId}` (incremented once per browser session via `sessionStorage` key `linkedin_connect_welcome_session_counted_{userId}`). Dismissal persists in `linkedin_connect_welcome_dismissed_{userId}`. **Session 4+:** popup should not auto-open. **After dismiss:** popup should not return. |
| **M-12 — Product backlog (optional)**     | No code change shipped. If product wants the 3-session window to reset after **7 days**, implement TTL on the login-count key separately.                                                                                                                                                                                                                                                                                                                                                                    |


---



## Changes


| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-18 | **Audit published.** Initial mobile landing audit (M-1 through M-28).                                                                                                                                                                                                                                                                                                                                       |
| 2026-07-18 | **M-2 implemented (all devices):** Removed **Today's Tasks** from Content Persona Quick Actions (`Header.tsx`). Resolves dead click (also desktop R-1).                                                                                                                                                                                                                                                     |
| 2026-07-18 | **M-1 implemented (mobile ≤768px):** Header collapsed to two rows — row 1: logo + persona + user menu; row 2: search (when connected) + GIF + alerts. Profile strength moved into persona panel (`Header.tsx`, `alwrity-copilot.css`).                                                                                                                                                                      |
| 2026-07-18 | **M-3 implemented (mobile ≤768px):** Persona button `title` updated; first-visit helper **Set your writing voice** with dismiss (`linkedin_persona_voice_hint_seen`).                                                                                                                                                                                                                                       |
| 2026-07-18 | **M-4 implemented (mobile ≤768px):** LinkedIn search hidden when disconnected (`Header.tsx`).                                                                                                                                                                                                                                                                                                               |
| 2026-07-18 | **M-5 implemented (mobile ≤960px):** Toolbar in document flow (no absolute overlay on hero); order unchanged: ? → Growth → Resume.                                                                                                                                                                                                                                                                          |
| 2026-07-18 | **M-6 implemented (mobile ≤640px):** Growth pill shows **Growth Tasks**; `aria-label` remains **Today's Growth Tasks**.                                                                                                                                                                                                                                                                                     |
| 2026-07-18 | **M-7 implemented (all devices, first visit):** 3-second floating label **Tour guide** under ? button (`linkedin_studio_tour_floating_hint_seen`).                                                                                                                                                                                                                                                          |
| 2026-07-18 | **M-8 implemented (all devices when draft exists):** Orange dot badge on Resume icon.                                                                                                                                                                                                                                                                                                                       |
| 2026-07-18 | **M-9 implemented (mobile ≤960px):** Full-width **Optimise Profile →** pill below avatar (min 44px); corner ✦ hidden on mobile (`LinkedInConnectedProfileCard.tsx`, `alwrity-copilot.css`).                                                                                                                                                                                                                 |
| 2026-07-18 | **M-10 implemented (mobile ≤640px layout + copy):** HITL connect welcome lead/reassurance copy; compact modal padding so CTAs fit above fold (`LinkedInConnectionPlaceholder.tsx`, `alwrity-copilot.css`).                                                                                                                                                                                                  |
| 2026-07-18 | **M-11 implemented (mobile ≤960px):** Connect button `min-height: 48px`, full width, max `320px` centered (`alwrity-copilot.css`).                                                                                                                                                                                                                                                                          |
| 2026-07-18 | **M-12 documented:** QA checklist note for 3-session connect welcome window — no code change (optional 7-day TTL noted for product).                                                                                                                                                                                                                                                                        |
| 2026-07-18 | **M-13 implemented (mobile ≤960px):** **Recommended for you** row (Plan + Create first); remaining cards under **More actions** accordion (`DashboardMobileWorkflowGrid.tsx`, `dashboardWorkflowConfig.ts`).                                                                                                                                                                                                |
| 2026-07-18 | **M-15 implemented (mobile):** Workflow hint updated to **Plan with ALwrity, create your voice, publish when you're ready.**                                                                                                                                                                                                                                                                                |
| 2026-07-18 | **M-16 implemented (disconnected gates):** Unified **Connect LinkedIn to continue** modal for gated workflow cards and connection-required events; Plan/Create remain usable without connecting (`WelcomeMessage.tsx`, `dashboardWorkflowConfig.ts`).                                                                                                                                                       |
| 2026-07-18 | **M-17 implemented (mobile ≤960px):** Visible **Analytics & Knowledge** section below workflow grid; tour step updated to **Tap Analytics below to view post stats and open your Library.**                                                                                                                                                                                                                 |
| 2026-07-18 | **M-18 implemented (mobile ≤960px):** `DashboardMobileAnalyticsSection.tsx` — **Analytics** button opens post analytics; teaser copy shipped.                                                                                                                                                                                                                                                               |
| 2026-07-18 | **M-19 implemented (mobile ≤960px):** Same section — **Knowledge & Library** expands inline panel with content library link + Knowledge Center feature grid.                                                                                                                                                                                                                                                |
| 2026-07-18 | **Co-Pilot mobile (Section 6 — product direction):** Replaced full-width sticky bar with **floating corner FAB** (desktop-like); tour target `li-mobile-copilot-fab`; reduced bottom inset to avoid covering workflow cards (partial M-20 fix).                                                                                                                                                             |
| 2026-07-18 | **M-25 implemented:** Centralized breakpoints in `dashboardLayoutConstants.ts`; tour tablet breakpoint aligned to Mobile Studio **960px**; QA doc `docs/dashboardDesktopHeroPlacement.md`; hero placement doc updated.                                                                                                                                                                                      |
| 2026-07-18 | **M-26 implemented:** Removed dead `.linkedin-mobile-resume-bar` CSS (resume UX is toolbar `ResumeDraftRailChip` only).                                                                                                                                                                                                                                                                                     |
| 2026-07-18 | **M-27 implemented:** Tour done step HITL copy — *You're set. Start with Plan, draft in Create, review every word, then Publish when it sounds like you. Replay anytime from ?.* (`linkedInStudioTourSteps.ts`).                                                                                                                                                                                            |
| 2026-07-18 | **Mobile header refresh (≤768px):** **LinkedIn / Studio** title visible; plan chip hidden; GIF + bell before user menu; search moved below nav bar; quick-actions row (**Growth**, **Resume Draft**, **Content Persona**, **Optimise Profile**). All devices: Resume label → **Resume Draft**.                                                                                                              |
| 2026-07-18 | **Mobile header tab strip (≤768px):** Nav bar = brand + GIF + bell + user only. **LinkedIn Search** full-width strip below nav (disabled when disconnected). Studio actions as **underline tabs** in one row: **Growth**, **Resume**, **Persona**, **Optimise** — dropdowns/modals unchanged.                                                                                                               |
| 2026-07-18 | **Mobile tab flows (≤768px / ≤960px):** Growth, Content Persona, Resume Work, and Optimise Profile open as **bottom-sheet modals** (uniform UX). Full tab labels shown (multi-line). **Optimise Profile** pill removed below hero avatar on mobile — header tab only.                                                                                                                                       |
| 2026-07-18 | **Mobile UX pass:** Studio tab modals **centered** on screen; **profile hub strip** (avatar + green/red status dot + inline Connect/Disconnect); all **6 workflow cards** visible in compact 2×3 grid (no More actions accordion).                                                                                                                                                                          |
| 2026-07-18 | **Mobile layout polish:** Tour **?** in header nav (after GIF); **workflow grid above profile strip**; Co-Pilot FAB **bottom-left**; **Analytics circular icon**; tour step order aligned with layout.                                                                                                                                                                                                      |
| 2026-07-18 | **Mobile bottom dock polish (≤960px):** Tour **?** in header nav — **no outer white circle** (plain blue glyph). Co-Pilot FAB moved to **bottom-right**. Bottom row: **Analytics**, **Knowledge**, and **Library** as three equal **circular icon + label** actions in one row; Knowledge expands feature grid; Library opens asset library directly. Tour copy updated for the row and Co-Pilot placement. |
| 2026-07-18 | **Mobile landing declutter (≤960px):** Removed workflow hint *Plan with ALwrity…* and **Analytics & Knowledge** section heading. Tightened bottom scroll inset after icon row. **Knowledge center** label restored; Knowledge opens as **centered modal** (not inline expand).                                                                                                                              |
| 2026-07-18 | **M-30 implemented (mobile ≤960px):** Six workflow cards show **icon + title + desktop short description** (2-line clamp). Removed hidden-desc CSS; mobile grid uses `card.description` from `dashboardWorkflowConfig.ts` (`DashboardMobileWorkflowGrid.tsx`, `alwrity-copilot.css`).                                                                                                                      |
| 2026-07-18 | **M-31 implemented (mobile ≤768px):** Slimmer header bands — nav row **48px**, tab cells **44px**, tighter padding; disconnected users see **two bands** (nav + single-row tabs). Goal: at least half of one workflow card visible on first screen at 390px.                                                                                                                                                      |
| 2026-07-18 | **M-33 implemented (mobile ≤960px):** `useMobileVisualViewportInset` syncs keyboard overlap to `--li-visual-viewport-keyboard-inset`; Co-Pilot FAB and sidebar input/messages shift above on-screen keyboard (`WelcomeMessage.tsx`, `alwrity-copilot.css`). **Requires real-device QA.**                                                                                                                    |
| 2026-07-18 | **M-34 adjusted (mobile ≤768px):** Studio tabs restored to **single-row** underline strip (**Today's Growth Tasks**, **Resume Work**, **Content Persona**, **Optimise Profile**); horizontal scroll on narrow widths. Kept improved label sizing `clamp(10px, 2.8vw, 12px)`. |
| 2026-07-18 | **M-35 implemented (mobile ≤768px):** LinkedIn Search strip **hidden when disconnected** (`Header.tsx` — `showMobileSearchRow = isMobileHeaderNav && connected`). Aligns with M-4 intent on the mobile tab header layout.                                                                                                                                                                                     |
| 2026-07-18 | **Mobile profile hub relocation (≤960px):** `linkedin-profile-hub-strip` moved inline after **What would you like to do?** title (`DashboardMobileWorkflowGrid.tsx`, `WelcomeMessage.tsx`, `LinkedInProfileHubStrip` inline variant). Empty hero hub collapsed.                                                                                                                                              |
| 2026-07-18 | **Mobile studio context nudge (≤960px):** `DashboardMobileStudioContextNudge` — state-aware tip below workflow header (priority action, profile strength, connect guidance, HITL copy); dismissible per session.                                                                                                                                                                                              |
| 2026-07-18 | **Mobile tab + profile hub polish (≤768px / ≤960px):** Studio tabs use label-above-icon, fixed row height, soft blue active background; **Resume Work** two-line label; profile strip swipe hint + swipe gestures (`useProfileHubStripSwipe.ts`, M-34b). |
| 2026-07-18 | **Mobile landing copy & strip refresh (≤960px):** Workflow title → **What would You / like to Create**; studio tabs show full two-line titles; connected **ready** nudge removed; profile strip enlarged, user name hidden, **Disconnect LinkedIn** red/white, combined swipe hint. Reverted extra spacing between tabs and workflow header. |
| 2026-07-18 | **Mobile studio quick actions dock (≤960px):** Four studio actions unified in one segmented row above workflow title (`MobileStudioQuickActionsDock.tsx`); removed from header. Profile strip prominent card with swipe hint inside strip boundary. |
| 2026-07-18 | **Issue #106 Level 2 audit pack:** Appended test cases **M-29 through M-38** (post-implementation review). M-32, M-36, M-37, M-38 remain open for product approval.                                                                                                                                                                                                                                        |
| —          | *(Add rows when remaining M-items are implemented and verified.)*                                                                                                                                                                                                                                                                                                                                           |


**Implementation status:** M-1 through M-27 implemented July 18, 2026 (M-12 doc-only). M-28 pending QA verification. **M-30, M-31, M-33, M-34, M-35 implemented July 18, 2026** (M-33 requires real-device keyboard QA).

---

*End of document.*