import { resolveGrowNetworkSectionOrder } from "../components/dashboard/growNetworkSectionOrder";

describe("resolveGrowNetworkSectionOrder", () => {
  it("uses fixed layout: active PYMK left, advisor sidebar right", () => {
    expect(resolveGrowNetworkSectionOrder(true)).toEqual(["pymk", "ai"]);
    expect(resolveGrowNetworkSectionOrder(false)).toEqual(["pymk", "ai"]);
  });
});
