/**
 * Age-restriction radios stay readable on the white Creator surface when
 * disabled (global MUI theme is dark). Hub wedge is out of scope.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePublishAudienceFields } from "../components/YouTubePublishAudienceFields";
import { outlinedControlSx } from "../styles";

const FIELDS_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "components",
  "YouTubePublishAudienceFields.tsx",
);

describe("YouTubePublishAudienceFields disabled readability", () => {
  it("hides 18+ radios until Age restriction (advanced) is expanded", () => {
    render(
      <YouTubePublishAudienceFields
        madeForKids={false}
        ageRestricted={false}
        onMadeForKidsChange={vi.fn()}
        onAgeRestrictedChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("radio", { name: /Yes, restrict my video to viewers over 18/i }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /age restriction \(advanced\)/i }));

    expect(
      screen.getByRole("radio", { name: /Yes, restrict my video to viewers over 18/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole("radio", { name: /No, don't restrict my video to viewers over 18/i }),
    ).toBeEnabled();
  });

  it("overrides disabled radio and label colors so they stay visible on white", () => {
    const source = readFileSync(FIELDS_SOURCE, "utf8");
    expect(source).toContain("&.Mui-disabled");
    expect(source).toContain("opacity: 1");
    expect(source).toContain("#6b7280");
  });

  it("still shows both 18+ labels when Made for Kids is Yes", () => {
    render(
      <YouTubePublishAudienceFields
        madeForKids
        ageRestricted={false}
        onMadeForKidsChange={vi.fn()}
        onAgeRestrictedChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /age restriction \(advanced\)/i }));

    expect(screen.getByText(/Yes, restrict my video to viewers over 18/i)).toBeVisible();
    expect(
      screen.getByText(/No, don't restrict my video to viewers over 18/i),
    ).toBeVisible();
    expect(
      screen.getByRole("radio", { name: /Yes, restrict my video to viewers over 18/i }),
    ).toBeDisabled();
  });

  it("wraps Audience in an outlined surface with Privacy-matching hover border", () => {
    const source = readFileSync(FIELDS_SOURCE, "utf8");
    expect(source).toContain("outlinedControlSx");
    expect(source).toContain('id="yt-audience-label"');
    expect(source).toContain('aria-labelledby="yt-audience-label"');
    expect(outlinedControlSx).toMatchObject({
      backgroundColor: "#ffffff",
      border: "1.5px solid #d1d5db",
    });
    expect(outlinedControlSx["&:hover"]).toMatchObject({
      borderColor: "#9ca3af",
    });
  });

  it("exposes Audience as a named fieldset for assistive tech", () => {
    render(
      <YouTubePublishAudienceFields
        madeForKids={false}
        ageRestricted={false}
        onMadeForKidsChange={vi.fn()}
        onAgeRestrictedChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("group", { name: "Audience" })).toBeTruthy();
  });

  it("left-aligns Age restriction (advanced) under the Made for Kids radios", () => {
    const source = readFileSync(FIELDS_SOURCE, "utf8");
    expect(source).not.toContain('flexDirection: "row-reverse"');
    expect(source).toContain('justifyContent: "flex-start"');
    expect(source).toContain('alignSelf: "flex-start"');
    expect(source).toContain("order: -1");
  });
});
