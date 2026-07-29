# LinkedIn Studio — responsive breakpoints (QA reference)

**Canonical source of truth (code):**  
`frontend/src/components/LinkedInWriter/components/dashboard/dashboardLayoutConstants.ts`

**Hero placement detail (desktop radial):**  
`frontend/src/components/LinkedInWriter/components/dashboard/dashboardDesktopHeroPlacement.md`

---

## Mobile Studio boundary — **960px**

The primary layout switch for LinkedIn Studio landing (`/linkedin-writer`, no draft open):

| Viewport | Layout |
|----------|--------|
| **≤960px** | Mobile Studio — workflow grid, floating Co-Pilot FAB, mobile Analytics & Knowledge section, toolbar pills in document flow |
| **≥961px** | Desktop Studio — radial workflow ring, right rail, corner Co-Pilot dock |

**Implementation sync checklist (must stay aligned):**

| Layer | File | Value |
|-------|------|-------|
| Constants | `dashboardLayoutConstants.ts` | `MOBILE_STUDIO_MAX_WIDTH_PX = 960`, `DESKTOP_DASHBOARD_MIN_WIDTH_PX = 961` |
| React hook | `useDesktopViewport.ts` | `matchMedia('(min-width: 961px)')` |
| CSS | `alwrity-copilot.css` | `@media (max-width: 960px)` for mobile studio block |
| Tour tablet/mobile | `alwrityJoyrideTheme.ts` | `TOUR_BREAKPOINT_TABLET_PX` = `MOBILE_STUDIO_MAX_WIDTH_PX` |

---

## Secondary breakpoints (intentional, not bugs)

| Breakpoint | Constant | Purpose |
|------------|----------|---------|
| **768px** | `HEADER_COMPACT_MAX_WIDTH_PX` | App header stacks to two rows (logo/persona + controls) |
| **640px** | `TOUR_PHONE_MAX_WIDTH_PX` | Tour uses phone tooltips; tablet tour at 641–960px |
| **430px** | CSS only | Smaller bottom inset for Co-Pilot FAB on very small phones |

---

## Manual QA (M-25)

1. **960px** — mobile grid visible, no radial ring, mobile analytics section visible.
2. **961px** — desktop radial visible, no mobile grid.
3. **768px** — header two-row layout.
4. **640px** — tour phone variant (narrower tooltips).
5. No mixed state (e.g. desktop header + mobile grid) at boundary widths.

---

*Last updated: July 2026 — M-25 implementation.*
