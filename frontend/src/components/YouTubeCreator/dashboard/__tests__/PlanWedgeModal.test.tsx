import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanWedgeModal } from "../modals/PlanWedgeModal";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";

jest.mock("../../hooks/useYouTubePlanBrainstorm", () => ({
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
    run: jest.fn(),
    save: jest.fn(),
    loadSaved: jest.fn(),
    hashPrompt: (p) => p,
  }),
}));

jest.mock("../modals/YouTubePlanSavedIdeasModal", () => ({
  fetchYouTubeSavedIdeasCount: jest.fn().mockResolvedValue(3),
  YouTubePlanSavedIdeasModal: ({ open, onBack }) =>
    open ? (
      <div role="dialog" aria-label="Saved Ideas">
        <button type="button" onClick={onBack}>
          Back to Plan
        </button>
      </div>
    ) : null,
}));

jest.mock("../../components/PlanUrlImportBar", () => ({
  PlanUrlImportBar: () => <div data-tour="yt-url-import">Blog / URL import</div>,
}));

jest.mock("../../components/PlanBrainstormSourceChips", () => ({
  PlanBrainstormSourceChips: ({ onOpenChannelBible }) =>
    onOpenChannelBible ? (
      <button type="button" onClick={onOpenChannelBible}>
        Channel Bible
      </button>
    ) : (
      <div>Source chips</div>
    ),
}));

jest.mock("../YouTubeChannelBibleEditorModal", () => ({
  YouTubeChannelBibleEditorModal: ({ open, onClose, shell }) =>
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

jest.mock("../../components/PlanBrainstormLoadingPanel", () => ({
  PlanBrainstormLoadingPanel: () => null,
}));

describe("PlanWedgeModal", () => {
  const baseProps = {
    open: true,
    onClose: jest.fn(),
    goCreate: jest.fn(),
    markNotify: jest.fn(),
    notifyKeys: {},
  };

  it("uses a two-column Plan layout with unlocked tools on the right", () => {
    render(<PlanWedgeModal {...baseProps} />);

    expect(screen.getByText(WEDGE_MODAL_INTROS.plan)).toBeTruthy();
    expect(screen.getByText("Other Planning Tools")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Topic Discovery and Ideas" })).toBeTruthy();
    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(screen.queryByText("Notify me")).toBeNull();

    const trends = screen.getByRole("button", { name: /YouTube Trends/i });
    const series = screen.getByRole("button", { name: /Series Planner/i });
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
    expect(screen.queryByRole("dialog", { name: "Saved Ideas" })).toBeNull();
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
