/**
 * Audience tab copy — live Analytics rows only.
 */
import {
  ageGroupLabel,
  countryRowLabel,
  formatViewerPercent,
  genderLabel,
  subscribedStatusLabel,
  viewerPercentBarWidth,
} from "../youtubeVideoAnalyticsAudienceLabels";

describe("youtubeVideoAnalyticsAudienceLabels", () => {
  it("maps age groups and gender without inventing missing buckets", () => {
    expect(ageGroupLabel("age13-17")).toBe("13–17");
    expect(ageGroupLabel("age18-24")).toBe("18–24");
    expect(ageGroupLabel("age65-")).toBe("65+");
    expect(ageGroupLabel("custom")).toBe("custom");
    expect(genderLabel("female")).toBe("Female");
    expect(genderLabel("male")).toBe("Male");
    expect(genderLabel("user_specified")).toBe("User specified");
  });

  it("keeps ZZ as Unknown country and subscribed statuses as Hub copy", () => {
    expect(countryRowLabel({ country: "ZZ", label: "Unknown country" })).toBe(
      "Unknown country",
    );
    expect(countryRowLabel({ country: "US" })).toBe("US");
    expect(subscribedStatusLabel("SUBSCRIBED")).toBe("Subscribed");
    expect(subscribedStatusLabel("UNSUBSCRIBED")).toBe("Unsubscribed");
  });

  it("formats viewer share without inventing a 50 percent default", () => {
    expect(formatViewerPercent(null)).toBe("—");
    expect(formatViewerPercent(40)).toBe("40%");
    expect(viewerPercentBarWidth(undefined)).toBe(0);
    expect(viewerPercentBarWidth(140)).toBe(100);
  });
});
