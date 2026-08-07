/** Section keys inside the Grow Network modal (fixed left/right layout). */
export type GrowNetworkSectionKey = "pymk" | "ai";

/** Locked sidebar is always right; active PYMK panel is always left. */
export function resolveGrowNetworkSectionOrder(
  _connected?: boolean,
): GrowNetworkSectionKey[] {
  return ["pymk", "ai"];
}
