import { youtubeHandlerErrorMessage } from "./youtubeHandlerError";

describe("youtubeHandlerErrorMessage", () => {
  it("uses Error.message when present", () => {
    expect(youtubeHandlerErrorMessage(new Error("Network failed"), "Fallback")).toBe(
      "Network failed",
    );
  });

  it("uses a non-empty string error", () => {
    expect(youtubeHandlerErrorMessage("  Timed out  ", "Fallback")).toBe("Timed out");
  });

  it("falls back for empty or unknown values", () => {
    expect(youtubeHandlerErrorMessage(new Error("  "), "Fallback")).toBe("Fallback");
    expect(youtubeHandlerErrorMessage(null, "Fallback")).toBe("Fallback");
    expect(youtubeHandlerErrorMessage({ status: 500 }, "Fallback")).toBe("Fallback");
  });
});
