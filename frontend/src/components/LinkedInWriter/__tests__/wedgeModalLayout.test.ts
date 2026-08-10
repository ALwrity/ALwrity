import {
  POST_WEDGE_MODAL_SIZE,
  POST_WEDGE_MODAL_SIZE_CLASS,
  WEDGE_TILE_GRID_CLASS,
  WEDGE_TILE_GRID_STYLE,
} from "../components/dashboard/wedgeModalLayout";

describe("wedgeModalLayout", () => {
  it("defines post-modal canvas dimensions", () => {
    expect(POST_WEDGE_MODAL_SIZE).toEqual({
      width: "min(77.6vw, 960px)",
      maxWidth: "min(77.6vw, 960px)",
      maxHeight: "min(98dvh, calc(100dvh - 8px))",
    });
    expect(POST_WEDGE_MODAL_SIZE_CLASS).toBe("linkedin-wedge-modal--post-size");
  });

  it("defines 4-column publish-style tile grid", () => {
    expect(WEDGE_TILE_GRID_CLASS).toBe("linkedin-wedge-tile-grid");
    expect(WEDGE_TILE_GRID_STYLE).toEqual({
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 12,
      alignItems: "stretch",
    });
  });
});
