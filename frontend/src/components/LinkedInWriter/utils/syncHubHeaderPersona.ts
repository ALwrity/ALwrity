import type { RadialLayout } from "../components/dashboard/dashboardRadialLayout";
import { layoutHubCenterPercent } from "../components/dashboard/dashboardRadialLayout";
import {
  HUB_HEADER_PERSONA_LEFT_CSS_VAR,
  LINKEDIN_HUB_AXIS_UPDATED_EVENT,
} from "../components/dashboard/dashboardLayoutConstants";

/** Profile picture targets in paint order — never use avatar-row (includes optimise chip). */
const PROFILE_PICTURE_AXIS_SELECTORS = [
  ".linkedin-dashboard-hero-hub .linkedin-profile-avatar-wrap img",
  ".linkedin-dashboard-hero-hub .linkedin-profile-avatar-wrap",
  ".linkedin-dashboard-hero-hub .linkedin-profile-hub-placeholder-avatar",
  ".linkedin-dashboard-hero-hub .linkedin-profile-hub-strip-avatar",
] as const;

/** Hub horizontal center from layout math (same axis as `--hub-center-left` on the canvas). */
export function computeHubAxisCenterX(
  canvas: HTMLElement,
  layout: RadialLayout,
): number {
  const canvasRect = canvas.getBoundingClientRect();
  const ratio = layoutHubCenterPercent(layout) / 100;
  return canvasRect.left + canvasRect.width * ratio;
}

/** Measured profile picture center when the hub has painted (preferred for visual alignment). */
export function measureProfilePictureCenterX(): number | null {
  for (const selector of PROFILE_PICTURE_AXIS_SELECTORS) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) continue;
    return rect.left + rect.width / 2;
  }

  const hubEl = document.querySelector(
    ".linkedin-dashboard-hero-hub",
  ) as HTMLElement | null;
  if (hubEl) {
    const rect = hubEl.getBoundingClientRect();
    if (rect.width > 0) return rect.left + rect.width / 2;
  }

  return null;
}

/**
 * Align header Content Persona pill center with the dashboard profile picture axis.
 * Stores viewport X on `document.body` for `position: fixed` header placement.
 */
export function syncHubHeaderPersona(
  canvas: HTMLElement | null,
  layout: RadialLayout,
  desktopViewport: boolean,
): void {
  if (
    !desktopViewport ||
    !canvas ||
    !document.body.classList.contains("linkedin-dashboard-view")
  ) {
    clearHubHeaderPersonaSync();
    return;
  }

  const headerRow = document.querySelector(
    ".linkedin-writer-header-row",
  ) as HTMLElement | null;
  if (!headerRow) {
    clearHubHeaderPersonaSync();
    return;
  }

  const hubCenterX =
    measureProfilePictureCenterX() ?? computeHubAxisCenterX(canvas, layout);
  const value = `${hubCenterX}px`;
  const previous = document.body.style.getPropertyValue(
    HUB_HEADER_PERSONA_LEFT_CSS_VAR,
  );
  if (previous === value) return;

  document.body.style.setProperty(HUB_HEADER_PERSONA_LEFT_CSS_VAR, value);
  headerRow.style.removeProperty(HUB_HEADER_PERSONA_LEFT_CSS_VAR);
  window.dispatchEvent(new CustomEvent(LINKEDIN_HUB_AXIS_UPDATED_EVENT));
}

export function clearHubHeaderPersonaSync(): void {
  const headerRow = document.querySelector(
    ".linkedin-writer-header-row",
  ) as HTMLElement | null;
  document.body.style.removeProperty(HUB_HEADER_PERSONA_LEFT_CSS_VAR);
  headerRow?.style.removeProperty(HUB_HEADER_PERSONA_LEFT_CSS_VAR);
}
