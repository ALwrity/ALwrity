import { CREATE_RETURN } from "../components/dashboard/createWedgeNavigation";

describe("createWedgeNavigation", () => {
  it("defines Quick Create return target for wedge back navigation", () => {
    expect(CREATE_RETURN.wedge).toEqual({
      wedge: "create",
      label: "Quick Create",
    });
  });
});
