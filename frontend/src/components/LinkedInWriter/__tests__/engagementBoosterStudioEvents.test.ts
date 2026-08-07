import { dispatchReviewOptimisedDraftInStudio } from "../components/dashboard/engagementBoosterStudioEvents";

describe("engagementBoosterStudioEvents", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("dispatches updateDraft then applyEdit with src and target", () => {
    const events: string[] = [];
    const handler = (event: Event) => {
      events.push(event.type);
    };
    window.addEventListener("linkedinwriter:updateDraft", handler);
    window.addEventListener("linkedinwriter:applyEdit", handler);

    dispatchReviewOptimisedDraftInStudio(
      "Original draft",
      "Optimised draft",
      "post",
    );

    expect(events).toEqual([
      "linkedinwriter:updateDraft",
      "linkedinwriter:applyEdit",
    ]);
    expect(sessionStorage.getItem("li_draft_content_type")).toBe("post");

    window.removeEventListener("linkedinwriter:updateDraft", handler);
    window.removeEventListener("linkedinwriter:applyEdit", handler);
  });

  it("does nothing when src or target is blank", () => {
    const handler = jest.fn();
    window.addEventListener("linkedinwriter:applyEdit", handler);

    dispatchReviewOptimisedDraftInStudio(" ", "Optimised", "post");
    dispatchReviewOptimisedDraftInStudio("Original", " ", "post");

    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener("linkedinwriter:applyEdit", handler);
  });
});
