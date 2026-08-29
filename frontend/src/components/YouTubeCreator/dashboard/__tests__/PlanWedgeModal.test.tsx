import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanWedgeModal } from "../modals/PlanWedgeModal";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import { queueYouTubePlanDrillDown, consumeYouTubePlanDrillDown } from "../youtubePlanDrillDown";

vi.mock("../../hooks/useYouTubePlanBrainstorm", () => ({
  useYouTubePlanBrainstorm: () => ({
    phase: "idle",
    ideas: [],
    sources: [],
    seedError: null,
    saveError: null,
    savingIndex: null,
    savedPromptHashes: new Set(),
    savedIdeas: [],
    savedLoading: false,
    savedListError: null,
    isUsingCache: false,
    loaderMessageIndex: 0,
    run: vi.fn(),
    save: vi.fn(),
    loadSaved: vi.fn(),
    hashPrompt: (p: string) => p,
  }),
}));

vi.mock("../modals/YouTubePlanSavedIdeasModal", () => ({
  fetchYouTubeSavedIdeasCount: vi.fn().mockResolvedValue(3),
  YouTubePlanSavedIdeasModal: ({
    open,
    onBack,
  }: {
    open: boolean;
    onBack: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Saved Ideas">
        <button type="button" onClick={onBack}>
          Back to Plan
        </button>
      </div>
    ) : null,
}));

vi.mock("../modals/YouTubePlanUrlImportModal", () => ({
  YouTubePlanUrlImportModal: ({
    open,
    onClose,
    onBack,
  }: {
    open: boolean;
    onClose: () => void;
    onBack: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Blog / URL → Video">
        <div data-tour="yt-url-import">Blog / URL import</div>
        <button type="button" onClick={onBack}>
          Back to Plan
        </button>
        <button type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
    ) : null,
}));

vi.mock("../../components/PlanBrainstormSourceChips", () => ({
  PlanBrainstormSourceChips: ({
    onOpenChannelBible,
  }: {
    onOpenChannelBible?: () => void;
  }) =>
    onOpenChannelBible ? (
      <button type="button" onClick={onOpenChannelBible}>
        Channel Bible
      </button>
    ) : (
      <div>Source chips</div>
    ),
}));

vi.mock("../YouTubeChannelBibleEditorModal", () => ({
  YouTubeChannelBibleEditorModal: ({
    open,
    onClose,
    shell,
  }: {
    open: boolean;
    onClose: () => void;
    shell: { onBack: () => void };
  }) =>
    open ? (
      <div role="dialog" aria-label="Channel Bible">
        <button type="button" onClick={shell.onBack}>
          Back to Plan
        </button>
        <button type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
    ) : null,
}));

vi.mock("../../components/PlanBrainstormLoadingPanel", () => ({
  PlanBrainstormLoadingPanel: () => null,
}));

describe("PlanWedgeModal", () => {
  beforeEach(() => {
    // Clear any drill-down queued by a previous test (module-level state + sessionStorage).
    consumeYouTubePlanDrillDown();
    // baseProps is shared across tests; reset call history so assertions stay isolated.
    vi.clearAllMocks();
  });

  const baseProps = {
    open: true,
    onClose: vi.fn(),
    goCreate: vi.fn(),
    markNotify: vi.fn(),
    notifyKeys: {},
  };

  it("uses a two-column Plan layout with unlocked tools on the right", () => {
    render(<PlanWedgeModal {...baseProps} />);

    expect(screen.getByText(WEDGE_MODAL_INTROS.plan)).toBeTruthy();
    expect(screen.getByText("Other Planning Tools")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Topic Discovery and Ideas" })).toBeTruthy();
    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(screen.queryByText("Notify me")).toBeNull();
    expect(screen.queryByText("Blog / URL import")).toBeNull();

    const urlTile = screen.getByRole("button", { name: /Blog \/ URL → Video/i });
    const trends = screen.getByRole("button", { name: /YouTube Trends/i });
    const series = screen.getByRole("button", { name: /Series Planner/i });
    expect((urlTile as HTMLButtonElement).disabled).toBe(false);
    expect((trends as HTMLButtonElement).disabled).toBe(false);
    expect((series as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(trends);
    fireEvent.click(series);
    expect(baseProps.goCreate).toHaveBeenCalledTimes(2);
    expect(baseProps.goCreate).toHaveBeenCalledWith({ step: 0 });
  });

  it("opens Saved Ideas as a drill-down modal and returns to Plan", () => {
    render(<PlanWedgeModal {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Saved Ideas/i }));
    expect(screen.getByRole("dialog", { name: "Saved Ideas" })).toBeTruthy();
    expect(screen.queryByText(WEDGE_MODAL_INTROS.plan)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back to Plan" }));
    expect(screen.getByText(WEDGE_MODAL_INTROS.plan)).toBeTruthy();
  });

  it("opens Blog / URL import as a sidebar drill-down modal", () => {
    render(<PlanWedgeModal {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Blog \/ URL → Video/i }));
    expect(screen.getByRole("dialog", { name: "Blog / URL → Video" })).toBeTruthy();
    expect(screen.getByText("Blog / URL import")).toBeTruthy();
    expect(screen.queryByText(WEDGE_MODAL_INTROS.plan)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back to Plan" }));
    expect(screen.queryByText("Blog / URL import")).toBeNull();
    expect(screen.getByText(WEDGE_MODAL_INTROS.plan)).toBeTruthy();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it("closes Blog / URL and Plan when the URL modal close button is clicked", () => {
    render(<PlanWedgeModal {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Blog \/ URL → Video/i }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Blog / URL import")).toBeNull();
  });

  it("opens Blog / URL drill-down when Plan drill-down queue has url-import", () => {
    queueYouTubePlanDrillDown({ sub: "url-import", seed: "From Creator" });

    render(<PlanWedgeModal {...baseProps} />);

    expect(screen.getByRole("dialog", { name: "Blog / URL → Video" })).toBeTruthy();
    expect(screen.queryByText(WEDGE_MODAL_INTROS.plan)).toBeNull();
  });

  it("returns to Plan when Channel Bible close or back is used", () => {
    render(<PlanWedgeModal {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Channel Bible" }));
    expect(screen.getByRole("dialog", { name: "Channel Bible" })).toBeTruthy();
    expect(screen.queryByText(WEDGE_MODAL_INTROS.plan)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText(WEDGE_MODAL_INTROS.plan)).toBeTruthy();
    expect(baseProps.onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Channel Bible" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Plan" }));
    expect(screen.getByText(WEDGE_MODAL_INTROS.plan)).toBeTruthy();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });
});
