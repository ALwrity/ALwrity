import {
  GROW_NETWORK_LOCKED_SECTIONS,
  GROW_NETWORK_NOTIFY_KEYS,
  isGrowNetworkSectionLocked,
  isNetworkAdvisorLocked,
} from "../utils/growNetworkLockedUi";

describe("growNetworkLockedUi", () => {
  it("locks Network Advisor in the frontend", () => {
    expect(isNetworkAdvisorLocked()).toBe(true);
    expect(isGrowNetworkSectionLocked("network_advisor")).toBe(true);
    expect(GROW_NETWORK_LOCKED_SECTIONS.has("network_advisor")).toBe(true);
  });

  it("does not lock PYMK section", () => {
    expect(isGrowNetworkSectionLocked("pymk")).toBe(false);
  });

  it("defines notify storage key for Network Advisor", () => {
    expect(GROW_NETWORK_NOTIFY_KEYS.network_advisor).toBeTruthy();
  });
});
