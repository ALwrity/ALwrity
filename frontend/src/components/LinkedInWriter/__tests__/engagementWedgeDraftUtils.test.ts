import {
  pushDraftToStudio,
  readStudioDraft,
} from "../components/dashboard/engagementWedgeDraftUtils";

describe("engagementWedgeDraftUtils", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe("readStudioDraft", () => {
    it("prefers sessionStorage li_draft over localStorage", () => {
      sessionStorage.setItem("li_draft", "session draft");
      localStorage.setItem("alwrity-copilot-draft-content", "local draft");
      expect(readStudioDraft()).toBe("session draft");
    });

    it("falls back to localStorage when session draft is empty", () => {
      localStorage.setItem("alwrity-copilot-draft-content", "local draft");
      expect(readStudioDraft()).toBe("local draft");
    });

    it("returns empty string when no draft exists", () => {
      expect(readStudioDraft()).toBe("");
    });
  });

  describe("pushDraftToStudio", () => {
    it("does nothing for blank content", () => {
      const handler = jest.fn();
      window.addEventListener("linkedinwriter:updateDraft", handler);
      pushDraftToStudio("   ");
      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener("linkedinwriter:updateDraft", handler);
    });

    it("dispatches updateDraft and syncs storage", () => {
      const handler = jest.fn();
      window.addEventListener("linkedinwriter:updateDraft", handler);
      pushDraftToStudio("Optimised post");
      expect(handler).toHaveBeenCalled();
      expect(sessionStorage.getItem("li_draft")).toBe("Optimised post");
      expect(localStorage.getItem("alwrity-copilot-draft-content")).toBe(
        "Optimised post",
      );
      window.removeEventListener("linkedinwriter:updateDraft", handler);
    });
  });
});
