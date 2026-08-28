import { resolveYoutubeContentLanguageCode } from "../constants";

describe("resolveYoutubeContentLanguageCode", () => {
  it("keeps known ISO codes", () => {
    expect(resolveYoutubeContentLanguageCode("hi")).toBe("hi");
    expect(resolveYoutubeContentLanguageCode("HI")).toBe("hi");
  });

  it("maps BCP-47 tags and display names", () => {
    expect(resolveYoutubeContentLanguageCode("hi-IN")).toBe("hi");
    expect(resolveYoutubeContentLanguageCode("Hindi")).toBe("hi");
  });

  it("falls back to English when omitted or unknown", () => {
    expect(resolveYoutubeContentLanguageCode(undefined)).toBe("en");
    expect(resolveYoutubeContentLanguageCode("")).toBe("en");
    expect(resolveYoutubeContentLanguageCode("xx")).toBe("en");
  });
});
