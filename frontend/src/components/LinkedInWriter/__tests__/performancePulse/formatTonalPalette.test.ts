import {
  FORMAT_TONAL_PALETTE,
  getFormatActionButtonStyle,
} from "../../components/dashboard/performancePulse/formatTonalPalette";

describe("formatTonalPalette", () => {
  it("defines soft tonal colors for all content types", () => {
    expect(FORMAT_TONAL_PALETTE.post.bg).toBe("#eff6ff");
    expect(FORMAT_TONAL_PALETTE.article.bg).toBe("#ecfdf5");
    expect(FORMAT_TONAL_PALETTE.carousel.bg).toBe("#f5f3ff");
    expect(FORMAT_TONAL_PALETTE.video_script.bg).toBe("#fff1f2");
  });

  it("applies locked grey styling when requested", () => {
    const style = getFormatActionButtonStyle({
      colors: FORMAT_TONAL_PALETTE.post,
      locked: true,
    });
    expect(style.background).toBe("#f3f4f6");
    expect(style.cursor).toBe("not-allowed");
  });

  it("uses compact sizing for Pulse transform buttons", () => {
    const style = getFormatActionButtonStyle({
      colors: FORMAT_TONAL_PALETTE.article,
      compact: true,
    });
    expect(style.fontSize).toBe(10);
    expect(style.padding).toBe("5px 10px");
  });
});
