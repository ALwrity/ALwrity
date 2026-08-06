import { readEngagementBoosterContext } from "../components/dashboard/engagementBoosterContext";
import { savePreferences } from "../utils/storageUtils";
import { saveDraftContentType } from "../utils/linkedInDraftContentTypeStorage";

describe("engagementBoosterContext", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("reads content type from session storage", () => {
    saveDraftContentType("carousel");
    const ctx = readEngagementBoosterContext();
    expect(ctx.contentType).toBe("carousel");
  });

  it("detects persona context from saved preferences", () => {
    savePreferences({
      industry: "FinTech",
      tone: "Professional",
      target_audience: "CFOs",
    });

    const ctx = readEngagementBoosterContext();
    expect(ctx.hasPersonaContext).toBe(true);
    expect(ctx.industry).toBe("FinTech");
    expect(ctx.target_audience).toBe("CFOs");
  });

  it("reports no persona context when preferences are empty", () => {
    savePreferences({
      industry: "",
      target_audience: "",
      tone: "Professional",
    });

    const ctx = readEngagementBoosterContext();
    expect(ctx.hasPersonaContext).toBe(true);
    expect(ctx.tone).toBe("Professional");
  });
});
