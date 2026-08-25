import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Tooltip from "@mui/material/Tooltip";
import { YouTubeVideoCreatorModal } from "../modals/YouTubeVideoCreatorModal";
import { selectMenuProps, tooltipPopperProps } from "../../styles";
import {
  MUI_DEFAULT_MODAL_Z_INDEX,
  YT_CREATOR_SURFACE_BODY_CLASS,
  YT_Z_CREATOR_SURFACE,
  YT_Z_MODAL,
} from "../youtubeStudioZIndex";

jest.mock("../../YouTubeVideoCreatorPanel", () => ({
  YouTubeVideoCreatorPanel: () => (
    <div data-testid="yt-video-creator-panel">Video Creator Panel</div>
  ),
}));

describe("YouTubeVideoCreatorModal — dedicated surface", () => {
  afterEach(() => {
    document.body.classList.remove(YT_CREATOR_SURFACE_BODY_CLASS);
  });

  it("renders nothing when closed", () => {
    render(<YouTubeVideoCreatorModal open={false} onClose={jest.fn()} />);
    expect(screen.queryByRole("dialog", { name: /Video Creator/i })).toBeNull();
    expect(screen.queryByTestId("yt-video-creator-panel")).toBeNull();
  });

  it("renders pipeline surface with panel when open, not the Hub modal z-index", () => {
    render(<YouTubeVideoCreatorModal open onClose={jest.fn()} />);
    const dialog = screen.getByRole("dialog", { name: /Video Creator/i });
    expect(dialog).toBeTruthy();
    expect(dialog.className).toContain("yt-creator-surface");
    expect(dialog.closest(".yt-modal-backdrop")).toBeNull();
    expect(Number.parseInt(dialog.style.zIndex, 10)).toBe(YT_Z_CREATOR_SURFACE);
    expect(Number.parseInt(dialog.style.zIndex, 10)).toBeLessThan(YT_Z_MODAL);
    expect(screen.getByTestId("yt-video-creator-panel")).toBeTruthy();
    expect(screen.getByText(/Plan → scenes → assets → render/i)).toBeTruthy();
    expect(document.body.classList.contains(YT_CREATOR_SURFACE_BODY_CLASS)).toBe(true);
  });

  it("calls onClose from close button and Studio Hub back", () => {
    const onClose = jest.fn();
    render(<YouTubeVideoCreatorModal open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Back to Studio Hub/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("lets a nested MUI dialog portal to document.body above the Creator surface", () => {
    render(
      <>
        <YouTubeVideoCreatorModal open onClose={jest.fn()} />
        <Dialog open aria-labelledby="yt-nested-asset-dialog">
          <DialogTitle id="yt-nested-asset-dialog">Generate Image</DialogTitle>
        </Dialog>
      </>,
    );

    const surface = document.querySelector(".yt-creator-surface") as HTMLElement;
    const nested = screen.getByRole("dialog", { name: "Generate Image" });
    const surfaceZ = Number.parseInt(surface.style.zIndex, 10);

    expect(surfaceZ).toBe(YT_Z_CREATOR_SURFACE);
    expect(surfaceZ).toBeLessThan(MUI_DEFAULT_MODAL_Z_INDEX);
    expect(nested.closest(".yt-creator-surface")).toBeNull();
    expect(nested.closest(".MuiModal-root")?.parentElement).toBe(document.body);
    expect(nested).toBeVisible();
  });

  it("portals Select menus and Tooltips to document.body, not into the Creator surface", () => {
    render(
      <>
        <YouTubeVideoCreatorModal open onClose={jest.fn()} />
        <Select
          open
          value="short"
          MenuProps={selectMenuProps}
          inputProps={{ "aria-label": "Plan duration" }}
        >
          <MenuItem value="short">Short</MenuItem>
        </Select>
        <Tooltip title="Help text" open arrow {...tooltipPopperProps}>
          <span>Tip</span>
        </Tooltip>
      </>,
    );

    const listbox = screen.getByRole("listbox");
    const tooltip = screen.getByRole("tooltip");
    expect(listbox.closest(".yt-creator-surface")).toBeNull();
    expect(tooltip.closest(".yt-creator-surface")).toBeNull();
    expect(listbox.closest(".MuiPopover-root")?.parentElement).toBe(document.body);
    expect(tooltip.closest(".MuiTooltip-popper")?.parentElement ?? tooltip.parentElement).toBeTruthy();
    expect(listbox).toBeVisible();
    expect(tooltip).toBeVisible();
  });
});
