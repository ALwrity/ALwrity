import { PUBLISH_WEDGE_MODAL_INTRO } from "../components/dashboard/publishWedgeCopy";

describe("publishWedgeCopy", () => {
  it("frames Publish wedge with confidence messaging", () => {
    expect(PUBLISH_WEDGE_MODAL_INTRO).toMatch(/Publish with confidence/i);
    expect(PUBLISH_WEDGE_MODAL_INTRO).toMatch(/hook, clarity, and timing/i);
  });
});
