/**
 * Audience tab copy — live Analytics rows only.
 */
import {
  ageGroupLabel,
  countryRowLabel,
  deviceTypeLabel,
  formatViewerPercent,
  genderLabel,
  subscribedStatusLabel,
  viewerPercentBarWidth,
  YOUTUBE_AUDIENCE_HUB_SECTIONS,
  audienceHubSectionLabel,
} from "../youtubeVideoAnalyticsAudienceLabels";

describe("youtubeVideoAnalyticsAudienceLabels", () => {
  it("lists four Hub Audience chips, not a second top tab bar", () => {
    expect(YOUTUBE_AUDIENCE_HUB_SECTIONS.map((section) => section.id)).toEqual([
      "demographics",
      "countries",
      "subscribed",
      "devices",
    ]);
    expect(YOUTUBE_AUDIENCE_HUB_SECTIONS.map((section) => section.label)).toEqual([
      "Age and gender",
      "Top countries",
      "Subscribers watching",
      "Device type",
    ]);
    expect(YOUTUBE_AUDIENCE_HUB_SECTIONS.map((section) => section.tooltip)).toEqual([
      "Viewer share by age and gender for this date range.",
      "Views and watch time by country for this date range.",
      "Views and watch time from subscribed and unsubscribed viewers.",
      "Watch time share by device for this date range.",
    ]);
  });

  it("resolves Hub chip labels and logs unknown section ids", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(audienceHubSectionLabel("demographics")).toBe("Age and gender");
    expect(audienceHubSectionLabel("devices")).toBe("Device type");
    expect(audienceHubSectionLabel("not-a-section")).toBe("not-a-section");
    expect(error).toHaveBeenCalledWith(
      "[YouTubeVideoAnalytics] Audience section unknown",
      { section: "not-a-section" },
    );
    error.mockRestore();
  });

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

  it("maps device types to Hub copy without inventing extra devices", () => {
    expect(deviceTypeLabel("DESKTOP")).toBe("Computer");
    expect(deviceTypeLabel("MOBILE")).toBe("Mobile phone");
    expect(deviceTypeLabel("TABLET")).toBe("Tablet");
    expect(deviceTypeLabel("TV")).toBe("TV");
    expect(deviceTypeLabel("GAME_CONSOLE")).toBe("Game console");
    expect(deviceTypeLabel("AUTOMOTIVE")).toBe("Automotive");
    expect(deviceTypeLabel("WEARABLE")).toBe("Wearable");
    expect(deviceTypeLabel("UNKNOWN_PLATFORM")).toBe("Unknown device");
    expect(deviceTypeLabel("custom")).toBe("custom");
  });
});
