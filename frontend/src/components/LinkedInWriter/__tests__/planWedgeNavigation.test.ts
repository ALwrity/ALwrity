import {
  OPEN_PLAN_SAVED_IDEAS_EVENT,
  PLAN_RETURN,
  signalReopenPlanSavedIdeas,
} from "../components/dashboard/planWedgeNavigation";

describe("planWedgeNavigation", () => {
  it("defines Quick Create return targets for Plan wedge flows", () => {
    expect(PLAN_RETURN.wedge).toEqual({
      wedge: "plan",
      label: "Plan",
    });
    expect(PLAN_RETURN.savedIdeas).toEqual({
      wedge: "plan",
      label: "My Saved Ideas",
      reopenPlanSavedIdeas: true,
    });
  });

  it("signalReopenPlanSavedIdeas dispatches plan saved ideas event", () => {
    const handler = jest.fn();
    window.addEventListener(OPEN_PLAN_SAVED_IDEAS_EVENT, handler);

    signalReopenPlanSavedIdeas();

    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener(OPEN_PLAN_SAVED_IDEAS_EVENT, handler);
  });
});
