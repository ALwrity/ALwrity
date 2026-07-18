# Desktop radial hero placement (≥961px)

This document describes how **Radial workflow hero**, **Profile hub**, and **Connect button** are positioned on wide screens. All three share one vertical axis anchored on the profile hub.

## Responsive breakpoints (Mobile Studio)

**Canonical constants:** `dashboardLayoutConstants.ts` — import these instead of hard-coding pixel values.

| Name | Constant | CSS / JS | Layout effect |
|------|----------|----------|---------------|
| **Mobile Studio** | `MOBILE_STUDIO_MAX_WIDTH_PX` = **960** | `@media (max-width: 960px)` | Mobile workflow grid, floating Co-Pilot FAB, Analytics section; radial ring hidden |
| **Desktop Studio** | `DESKTOP_DASHBOARD_MIN_WIDTH_PX` = **961** | `@media (min-width: 961px)` + `useDesktopViewport()` | Radial ring, right rail, desktop Co-Pilot dock |
| **Header compact** | `HEADER_COMPACT_MAX_WIDTH_PX` = **768** | `@media (max-width: 768px)` | Two-row app header |
| **Tour phone** | `TOUR_PHONE_MAX_WIDTH_PX` = **640** | Tour variant only | Compact tour tooltips (641–960 uses tablet tour) |

**960 vs 961:** Mobile CSS uses `max-width: 960px`; JS desktop detection uses `min-width: 961px`. There is no gap — at exactly 960px you get mobile; at 961px you get desktop.

**QA matrix:** 960px → mobile grid, no radial. 961px → radial, no mobile grid. 768px → compact header. 640px → phone tour tooltips.

See also: `docs/dashboardDesktopHeroPlacement.md` (QA breakpoint reference).

---

## Golden rule

> **One axis, one source of truth:** horizontal position always comes from `layout.centerX` in `computeRadialLayout()`. Never position the connect button with a separate `left: 50%` or a different offset on desktop.

## DOM structure (desktop)

```
.linkedin-dashboard-main          (position: relative; height: 100%)
├── .linkedin-dashboard-topbar    (absolute; does not affect flex height)
├── .linkedin-dashboard-hero-stage (flex: 1; position: relative; --hub-center-left: XX%)
│   ├── .linkedin-dashboard-hero
│   │   └── .linkedin-dashboard-hero-canvas (height = layout.viewH)
│   │       ├── <svg> radial wedges     → center at (layout.centerX, layout.centerY)
│   │       └── .linkedin-dashboard-hero-hub → left: var(--hub-center-left)
│   └── .linkedin-dashboard-plan-anchor--hub-bottom  → left: var(--hub-center-left)
└── .linkedin-dashboard-bottom-dock (Co-Pilot FAB only; separate left edge)
```

## Horizontal alignment (shared axis)

### Calculation (`dashboardRadialLayout.ts`)

| Step | Formula | Notes |
|------|---------|-------|
| Canvas width | `viewW = max(320, round(containerWidth))` | From `canvas.clientWidth` |
| Horizontal nudge | `ringHorizontalOffset(viewW) = round(clamp(20, viewW × 0.08, 100))` | Shifts stack right to balance analytics rail |
| **Hub / ring center X** | `centerX = viewW / 2 + ringHorizontalOffset(viewW)` | Single anchor for SVG + overlays |
| CSS percentage | `hubCenterLeft = (centerX / viewW) × 100` | Exported as `layoutHubCenterPercent()` |

### Runtime wiring (`LinkedInDashboardHero.tsx`)

1. `computeRadialLayout(width, stageHeight, desktopViewport=true)` runs on resize.
2. `hubCenterLeft = layoutHubCenterPercent(layout) + '%'`.
3. `hero-stage` gets `style.setProperty('--hub-center-left', hubCenterLeft)`.
4. These elements use `left: var(--hub-center-left); transform: translateX(-50%)`:
   - `.linkedin-dashboard-hero-hub` (profile hub)
   - `.linkedin-tour-lifecycle-spotlight`
   - `.linkedin-dashboard-plan-anchor--hub-bottom` (connect button)
5. SVG wedges use the same `layout.centerX` / `layout.centerY` in viewBox coordinates.

### If horizontal alignment breaks

- Check `useDesktopViewport()` uses `961px` (see `dashboardLayoutConstants.ts` and CSS).
- Do **not** use canvas width alone for desktop detection — main column can be narrower than the viewport.
- Ensure connect is **not** centered with `left: 50%` in the bottom dock; it must use `--hub-center-left`.
- Ensure `ringHorizontalOffset()` changes apply to SVG and overlays together (only edit `dashboardRadialLayout.ts`).

## Vertical placement

Vertical layout splits into **two layers**: (A) canvas geometry, (B) stage flex/CSS.

### A) Canvas geometry (ring + hub inside SVG canvas)

| Constant / field | Desktop value | Role |
|------------------|---------------|------|
| `reserveConnectSlot` | `false` | Canvas height excludes connect button (docked outside) |
| `centerY` | `extent + RING_EDGE_PAD + slack × RING_VERTICAL_BIAS_DESKTOP` | Ring center in SVG space |
| `RING_VERTICAL_BIAS_DESKTOP` | `0.5` | Fraction of extra stage slack (weak effect on page position) |
| `viewH` | `bottom_extent − viewBoxY` | Canvas pixel height |
| Hub overlay `top` | `layoutHubCenterY(layout)` | `centerY` converted to canvas pixels |
| `hubVisualR` | `64 × (1 + 0.3) ≈ 83px` radius | Profile hub size (independent of wedge scale) |

**Important:** Changing `centerY` alone does **not** move the ring on the page — it only shifts the SVG viewBox. Page vertical position is controlled by CSS (section B).

### B) Stage flex/CSS (page position)

| Location | Property | Desktop value | Effect |
|----------|----------|---------------|--------|
| `alwrity-copilot.css` | `.linkedin-dashboard-layout` `height` | `calc(100dvh - 80px)` | 80px = header (`.linkedin-writer-header`) |
| `alwrity-copilot.css` | `.linkedin-dashboard-hero-stage` `justify-content` | `flex-end` | Pushes radial canvas toward bottom |
| `alwrity-copilot.css` | `.linkedin-dashboard-hero-stage` `padding-bottom` | `30px` | Gap above connect row (tune here) |
| `alwrity-copilot.css` | `.linkedin-dashboard-hero` `margin-bottom` | `4px` | Small gap between canvas and connect |
| `alwrity-copilot.css` | `.linkedin-dashboard-plan-anchor--hub-bottom` `bottom` | `12px` | Connect button distance from stage bottom |

### Connect button vertical position

- **Desktop:** sibling of `.linkedin-dashboard-hero`, absolutely positioned on `.linkedin-dashboard-hero-stage`.
- **Not** inside `.linkedin-dashboard-hero-canvas` (PR #96 regression if moved back into canvas for desktop).
- Tune gap radial → connect: adjust `padding-bottom` on hero-stage and/or `margin-bottom` on hero.

## Wedge ring size (geometry only)

| Constant | Value | Affects |
|----------|-------|---------|
| `WEDGE_PANEL_SIZE_SCALE` | `0.9` | Ring radii −10%; not text/icons |
| `WEDGE_CARD_SCALE` | `1.2` | Annulus depth |
| `WEDGE_VOLUME_BOOST` | `1.2 × 1.3 × 1.344` | Base ring fit |
| `OUTER_BULGE_FACTOR` | `0.14` | Convex outer edge |

Font sizes (`iconFontSize`, `labelFontSize`, `descFontSize`) depend only on `viewW`, not wedge radii.

## Files to edit for common tweaks

| Goal | File | What to change |
|------|------|----------------|
| Move stack closer/farther from connect | `alwrity-copilot.css` | `padding-bottom` on `.linkedin-dashboard-hero-stage` (currently `30px`) |
| Move connect up/down | `alwrity-copilot.css` | `bottom` on `.linkedin-dashboard-plan-anchor--hub-bottom` (currently `12px`) |
| Shift stack left/right | `dashboardRadialLayout.ts` | `ringHorizontalOffset()` |
| Smaller/larger wedges (not text) | `dashboardRadialLayout.ts` | `WEDGE_PANEL_SIZE_SCALE` |
| Desktop vs mobile breakpoint | `dashboardLayoutConstants.ts` + CSS `@media (min-width: 961px)` + `useDesktopViewport.ts` | Keep all three in sync |
| Hub avatar size | `dashboardRadialLayout.ts` | `PROFILE_AVATAR_OUTER_RADIUS`, `INNER_PROFILE_GAP_RATIO` |

## Troubleshooting checklist

1. **Radial + hub misaligned horizontally**
   - Verify `--hub-center-left` is set on `.linkedin-dashboard-hero-stage` (DevTools → Computed).
   - Hub and connect must use `var(--hub-center-left)`, not hard-coded `50%`.

2. **Connect not at bottom**
   - Connect must be `.linkedin-dashboard-plan-anchor--hub-bottom` as direct child of hero-stage (fragment in `LinkedInDashboardHero`).
   - Hero-stage needs `position: relative` and `height: 100%`.

3. **Radial floating mid-screen**
   - Hero-stage needs `justify-content: flex-end` on desktop.
   - Parent chain must fill viewport: `.linkedin-dashboard-layout` `height: calc(100dvh - 80px)`.

4. **Layout looks correct on mobile but broken on desktop**
   - Confirm `desktopViewport` is passed into `computeRadialLayout(..., true)`.
   - Use `matchMedia('(min-width: 961px)')`, not canvas width.

5. **Changes to `centerY` have no visible effect**
   - Expected for page position; adjust CSS flex/padding instead.

## PR #96 baseline (do not regress)

- Hub and plan connect anchor coordinate space: hub overlay and SVG share `layout.centerX`.
- On desktop, connect is **outside** the canvas, docked on hero-stage bottom, hub-aligned.
- Mobile (≤960px): connect stays inside canvas; radial SVG hidden; mobile grid shown.
