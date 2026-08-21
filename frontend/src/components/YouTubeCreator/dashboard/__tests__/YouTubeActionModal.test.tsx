import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { YT_Z_KNOWLEDGE_CENTER, YT_Z_MODAL, YT_Z_RAIL } from "../youtubeStudioZIndex";

describe("YouTubeActionModal overlay", () => {
  it("does not render when closed", () => {
    render(
      <YouTubeActionModal open={false} title="Plan" onClose={jest.fn()}>
        Body
      </YouTubeActionModal>,
    );
    expect(screen.queryByRole("dialog", { name: "Plan" })).toBeNull();
  });

  it("portals the backdrop onto document.body above the Channel Pulse rail", () => {
    const onClose = jest.fn();
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

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
