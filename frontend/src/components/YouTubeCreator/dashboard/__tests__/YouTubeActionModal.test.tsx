import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { YT_Z_KNOWLEDGE_CENTER, YT_Z_MODAL, YT_Z_MODAL_POPOVER, YT_Z_RAIL } from "../youtubeStudioZIndex";
import { selectMenuProps } from "../../styles";

describe("YouTubeActionModal overlay", () => {
  it("does not render when closed", () => {
    render(
      <YouTubeActionModal open={false} title="Plan" onClose={vi.fn()}>
        Body
      </YouTubeActionModal>,
    );
    expect(screen.queryByRole("dialog", { name: "Plan" })).toBeNull();
  });

  it("portals the backdrop onto document.body above the Channel Pulse rail", () => {
    const onClose = vi.fn();
    render(
      <YouTubeActionModal open title="Plan" onClose={onClose}>
        Body
      </YouTubeActionModal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Plan" });
    const backdrop = dialog.closest(".yt-modal-backdrop") as HTMLElement;
    expect(backdrop).toBeTruthy();
    expect(backdrop.parentElement).toBe(document.body);
    expect(Number.parseInt(backdrop.style.zIndex, 10)).toBe(YT_Z_MODAL);
    expect(YT_Z_MODAL).toBeGreaterThan(YT_Z_RAIL);
    expect(YT_Z_MODAL).toBeGreaterThan(YT_Z_KNOWLEDGE_CENTER);
    expect(YT_Z_MODAL_POPOVER).toBeGreaterThan(YT_Z_MODAL);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is visible on document.body in a layer above in-tree Hub rail chrome", () => {
    render(
      <>
        <div data-testid="hub-rail" className="yt-studio-right-rail" style={{ zIndex: YT_Z_RAIL }} />
        <YouTubeActionModal open title="Plan" onClose={vi.fn()}>
          Body
        </YouTubeActionModal>
      </>,
    );

    const dialog = screen.getByRole("dialog", { name: "Plan" });
    const backdrop = dialog.closest(".yt-modal-backdrop") as HTMLElement;
    const rail = screen.getByTestId("hub-rail");
    expect(dialog).toBeVisible();
    expect(backdrop.parentElement).toBe(document.body);
    expect(Number.parseInt(backdrop.style.zIndex, 10)).toBeGreaterThan(
      Number.parseInt(String(rail.style.zIndex), 10),
    );
  });

  it("does not raise plan-step select menus with a Studio +1 z-index patch", () => {
    const menuProps = selectMenuProps as Record<string, unknown>;
    expect((menuProps.style as Record<string, unknown>)?.zIndex).toBeUndefined();
    expect((menuProps.sx as Record<string, unknown>)?.zIndex).toBeUndefined();
  });
});
