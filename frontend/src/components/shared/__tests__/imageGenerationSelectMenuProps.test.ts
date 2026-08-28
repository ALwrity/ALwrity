import { imageGenerationSelectMenuProps } from "../imageGenerationSelectMenuProps";

describe("imageGenerationSelectMenuProps", () => {
  it("does not hardcode Menu or Popper z-index (MUI modal manager)", () => {
    expect(imageGenerationSelectMenuProps.sx).toBeUndefined();
    expect(imageGenerationSelectMenuProps.PopperProps?.sx).toBeUndefined();
    expect(imageGenerationSelectMenuProps.PaperProps?.sx).toMatchObject({
      bgcolor: "#1e293b",
    });
  });

  it("opens menus downward and disables flip to avoid clipped upward menus", () => {
    expect(imageGenerationSelectMenuProps.anchorOrigin).toEqual({
      vertical: "bottom",
      horizontal: "left",
    });
    expect(imageGenerationSelectMenuProps.transformOrigin).toEqual({
      vertical: "top",
      horizontal: "left",
    });
    expect(imageGenerationSelectMenuProps.PopperProps?.placement).toBe(
      "bottom-start",
    );
    const flipModifier = imageGenerationSelectMenuProps.PopperProps?.modifiers?.find(
      (modifier) => modifier.name === "flip",
    );
    expect(flipModifier?.enabled).toBe(false);
  });
});
