import { ANALYSIS_WEDGE_MODAL_INTRO } from "../components/dashboard/analysisWedgeCopy";
import { CREATE_WEDGE_MODAL_INTRO } from "../components/dashboard/createWedgeCopy";
import { REMARKET_WEDGE_MODAL_INTRO } from "../components/dashboard/remarketWedgeCopy";

describe("analysisWedgeCopy", () => {
  it("defines analysis wedge modal intro", () => {
    expect(ANALYSIS_WEDGE_MODAL_INTRO).toBe(
      "See what's actually building your authority — then do more of it",
    );
  });
});

describe("remarketWedgeCopy", () => {
  it("defines remarket wedge modal intro", () => {
    expect(REMARKET_WEDGE_MODAL_INTRO).toBe(
      "Your ideas deserve more than one launch — remarket them into lasting authority",
    );
  });
});

describe("createWedgeCopy", () => {
  it("defines create wedge modal intro", () => {
    expect(CREATE_WEDGE_MODAL_INTRO).toBe(
      "Turn one idea into authority-building content — pick a format and let ALwrity draft it like you would",
    );
  });
});
