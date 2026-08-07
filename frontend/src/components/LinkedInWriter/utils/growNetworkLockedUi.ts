/** Grow Network — frontend-only section locks (backend APIs remain available). */

export const GROW_NETWORK_LOCKED_SECTIONS = new Set(["network_advisor"]);

export type GrowNetworkLockedSection = "network_advisor";

export const GROW_NETWORK_NOTIFY_KEYS: Record<
  GrowNetworkLockedSection,
  string
> = {
  network_advisor: "linkedin_grow_network_advisor_notify_requested",
};

export function isGrowNetworkSectionLocked(
  section: string,
): section is GrowNetworkLockedSection {
  return GROW_NETWORK_LOCKED_SECTIONS.has(section);
}

export function isNetworkAdvisorLocked(): boolean {
  return isGrowNetworkSectionLocked("network_advisor");
}
