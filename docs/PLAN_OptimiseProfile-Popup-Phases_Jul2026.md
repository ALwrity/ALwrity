# Optimise Profile Popup — Phased UX Implementation Plan

**Goal:** Keep **all existing Optimise Profile features** usable in the **90% viewport modal**, with **minimal or no scrolling** on a typical laptop (1366×768 minimum; ideal: 1920×1080).  
**Scope:** LinkedIn Studio dashboard — `ProfileOptimizationPanel` and related modals.  
**Test as you go:** Complete each phase’s checklist before starting the next.

---

## Baseline (already shipped)

| Item | Status |
|------|--------|
| Modal size 90vw × 90dvh + blurred backdrop | Done |
| Optimise entry: toolbar pill + profile ✦ icon + mobile tab | Done |
| Hover hint: **LinkedIn Profile** title + strength ticker | Done |

**Manual smoke test (baseline):**
- [ ] Connect LinkedIn → open Optimise from profile ✦ and from toolbar pill
- [ ] Modal fills ~90% of screen; background blurs
- [ ] Hover (pointer devices): popover shows **LinkedIn Profile** + ticker on both entry points

---

## North-star layout (end state)

Single-screen grid inside the modal (no page scroll at 1080p):

```
┌─────────────────────────────────────────────────────────────┐
│ [×]  LinkedIn Profile · 62% strength · 2/5 done    [Recheck]│  ← sticky header
├──────────────────────────┬──────────────────────────────────┤
│ Brand + section scores   │ Quick win recommendation        │
│ (compact)                │ (primary card + copy / actions)  │
├──────────────────────────┴──────────────────────────────────┤
│ Photo (collapsed by default) · Batch banner · 2–3 cards max │
├─────────────────────────────────────────────────────────────┤
│        [Skip]  [Mark done]  [Load next batch]               │  ← sticky footer
└─────────────────────────────────────────────────────────────┘
```

**Pass criteria (final):** On 1920×1080 and 1366×768, connected user with a typical batch (≤5 recommendations, photo collapsed): **no vertical scroll** inside `.linkedin-profile-optimization-dialog__body`.

---

## Phase 1 — Density & structure (layout only)

**Objective:** Fit more content above the fold without removing features.

| Change | Files (indicative) |
|--------|-------------------|
| Reduce panel padding (20px → 12–14px) | `ProfileOptimizationPanel.tsx`, CSS |
| Compact “Improve your LinkedIn profile” header to one line + subline | Same |
| Desktop ≥961px: **2-column grid** — left: brand + section scores; right: quick win + list | `dashboard-layout.css`, panel |
| Limit visible recommendation cards to **3** with “Show all (N)” expand | Panel list section |
| Move “Hide suggestions” to header icon/text link | Panel |

**Manual test checklist:**
- [ ] All sections still reachable (brand, photo, scores, cards, batch, recheck)
- [ ] 1080p: scroll reduced vs baseline; note remaining scroll px
- [ ] Mobile 375px: single column still readable; no horizontal overflow

**Exit:** Scroll on 1080p reduced by ≥40% vs baseline, or quick win + scores visible without scroll.

---

## Phase 2 — Progressive disclosure (keep features, hide depth)

**Objective:** Default view = essentials; advanced blocks collapsed.

| Change | Rationale |
|--------|-----------|
| **Profile photo** block → collapsed accordion “Improve photo (optional)” | Photo flow is heavy; opens on expand |
| **Brand identity** card → compact strip (1 row) with expand | Saves ~120px |
| **Section scores** → horizontal chips instead of full panel | Saves vertical space |
| Low-impact recommendations → accordion “More suggestions (N)” | Keeps high-impact above fold |

**Manual test checklist:**
- [ ] Expand photo accordion → upload / make presentable / download still work
- [ ] Expand “More suggestions” → all cards + mark done / skip work
- [ ] Collapsed state: 1080p **no scroll** with ≤3 high-priority items

**Exit:** Default collapsed view passes no-scroll on 1080p for typical account.

---

## Phase 3 — Sticky chrome (header + footer)

**Objective:** Actions always visible; body scrolls only if truly needed.

| Change | Details |
|--------|---------|
| Sticky modal header | Title “LinkedIn Profile”, strength %, session progress, Recheck |
| Sticky footer | Skip · Mark done · Load next batch (context-aware) |
| Body: `overflow-y: auto` only between header/footer | Dialog flex layout |

**Manual test checklist:**
- [ ] Scroll mid-list → footer actions stay visible
- [ ] Mark done / skip from footer matches card actions
- [ ] Close (×) and Escape still work; focus returns to trigger button

**Exit:** User never hunts for primary actions while scrolling.

---

## Phase 4 — Faster path to value (flow, not new AI)

**Objective:** Fewer clicks to first meaningful action.

| Change | Details |
|--------|---------|
| Skip **ProfileAnalysisReadyModal** when analysis already complete | `LinkedInProfileSetupPanel.tsx` |
| Pin **Quick win** card at top of right column with “Copy” + “Open LinkedIn profile” | Panel + cards |
| After copy → inline “Mark done?” on same card | Reduces scroll-back |

**Manual test checklist:**
- [ ] Return visit: Optimise opens main panel directly (no ready modal)
- [ ] First visit: ready modal still shows once if needed
- [ ] Copy + open LinkedIn + mark done completes one item without footer scroll

**Exit:** First-time user completes one recommendation in ≤3 clicks from open.

---

## Phase 5 — Batch & empty states (polish)

**Objective:** Clear endings; no dead space.

| Change | Details |
|--------|---------|
| “Batch complete” → slim inline banner (not full card) | Saves height |
| No-gaps state → compact success + 2 maintenance tips | Keeps one screen |
| Recheck delta → toast or header badge, not large alert block | Less vertical jump |

**Manual test checklist:**
- [ ] Complete batch → load next → all states fit one screen
- [ ] No-gaps profile → message + close path clear
- [ ] Recheck shows +N% without pushing content off screen

**Exit:** All terminal states (done, no gaps, error) fit 90% modal without scroll.

---

## Phase 6 — Accessibility & cross-device QA

**Objective:** Production-ready for desktop, tablet, mobile.

| Check | Notes |
|-------|-------|
| Focus trap in 90% modal | Tab order: header → content → footer |
| Hover hints | `@media (hover: hover)` only; touch uses `title` / tap |
| 90dvh on mobile browser chrome | Safe-area padding |
| Reduced motion | No required animations for ticker/popover |

**Manual test matrix:**

| Device width | Entry point | No-scroll default? | Notes |
|--------------|-------------|--------------------|-------|
| 1920×1080 | Toolbar pill | Phase 2+ target | |
| 1366×768 | Profile ✦ | Phase 2+ target | |
| 768×1024 tablet | Mobile tab | Allow minimal scroll OK | |
| 375×667 phone | Mobile tab | Scroll OK; sticky footer Phase 3 | |

---

## Feature preservation checklist (must pass every phase)

Do not remove or gate these without explicit product sign-off:

- [ ] Profile strength % + segment ticker
- [ ] Brand identity / AI intelligence card
- [ ] Profile photo upload, make presentable, download
- [ ] Section scores
- [ ] Recommendation cards (impact/effort, copy, mark done, skip)
- [ ] Quick win highlighting
- [ ] Load next batch / backlog
- [ ] Recheck profile + delta
- [ ] Refresh / hide suggestions
- [ ] Error + retry paths
- [ ] Connect gate when disconnected

---

## Suggested implementation order

1. **Phase 1** → measure scroll height (DevTools) before/after  
2. **Phase 2** → re-test no-scroll on 1080p  
3. **Phase 3** → sticky footer/header  
4. **Phase 4** → flow shortcuts  
5. **Phase 5** → edge states  
6. **Phase 6** → full matrix  

**Estimated manual QA per phase:** 20–30 minutes.

---

## How to record results

For each phase, note:

1. Viewport (e.g. 1920×1080, 100% zoom)  
2. Entry point (profile ✦ vs toolbar pill)  
3. Scroll needed? Y/N — if Y, which block caused it  
4. Pass / Fail vs phase exit criteria  

Store notes in your sprint doc or PR description when implementing each phase.
