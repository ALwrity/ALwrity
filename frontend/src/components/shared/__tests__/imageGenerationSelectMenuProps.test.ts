import {
  IMAGE_GENERATION_DIALOG_Z_INDEX,
  IMAGE_GENERATION_SELECT_MENU_Z_INDEX,
  imageGenerationSelectMenuProps,
} from "../imageGenerationSelectMenuProps";

describe("imageGenerationSelectMenuProps", () => {
  it("uses z-index above default MUI Popover/Dialog layers", () => {
    expect(IMAGE_GENERATION_DIALOG_Z_INDEX).toBeGreaterThan(1300);
    expect(IMAGE_GENERATION_SELECT_MENU_Z_INDEX).toBeGreaterThan(
      IMAGE_GENERATION_DIALOG_Z_INDEX,
    );
  });

  it("sets z-index on Menu and Popper roots, not only Paper", () => {
    expect(imageGenerationSelectMenuProps.sx).toMatchObject({
      zIndex: IMAGE_GENERATION_SELECT_MENU_Z_INDEX,
    });
    expect(imageGenerationSelectMenuProps.PopperProps?.sx).toMatchObject({
      zIndex: IMAGE_GENERATION_SELECT_MENU_Z_INDEX,
    });
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
