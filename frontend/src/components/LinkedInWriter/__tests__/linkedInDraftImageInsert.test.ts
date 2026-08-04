import { insertImageIntoLinkedInDraft } from "../utils/linkedInDraftImageInsert";

describe("linkedInDraftImageInsert", () => {
  beforeEach(() => {
    jest.spyOn(console, "debug").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("appends image markdown to the draft", () => {
    const result = insertImageIntoLinkedInDraft(
      "Hello world",
      "http://localhost:8000/api/linkedin/images/img-1",
    );

    expect(result).toContain("Hello world");
    expect(result).toContain(
      "![Generated LinkedIn image](http://localhost:8000/api/linkedin/images/img-1)",
    );
  });

  it("flushes assistive editor draft before inserting", () => {
    const flushDraft = jest.fn(() => "Flushed post body");

    const result = insertImageIntoLinkedInDraft(
      "stale draft",
      "http://localhost:8000/api/linkedin/images/img-2",
      { flushDraft },
    );

    expect(flushDraft).toHaveBeenCalled();
    expect(result).toContain("Flushed post body");
    expect(result).not.toContain("stale draft");
  });

  it("throws when imageUrl is empty", () => {
    expect(() => insertImageIntoLinkedInDraft("draft", "  ")).toThrow(
      "Image URL is required",
    );
    expect(console.error).toHaveBeenCalled();
  });
});
