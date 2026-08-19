import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlanBrainstormPanel } from "./PlanBrainstormPanel";

const mockRun = jest.fn();
const mockSave = jest.fn();
const mockLoadSaved = jest.fn();
const mockHashPrompt = jest.fn((p: string) => `hash:${p}`);

let mockHookState: Record<string, unknown> = {};

jest.mock("../hooks/useYouTubePlanBrainstorm", () => ({
  useYouTubePlanBrainstorm: () => ({
    phase: "results",
    ideas: [
      {
        prompt: "Budget Japan travel tips for first timers",
        rationale: "Helps new travelers plan confidently",
        evidence: "Source [1]: ...",
      },
    ],
    sources: [{ title: "Travel Guide", url: "https://example.com/travel", snippet: "tips" }],
    seedError: null,
    saveError: null,
    savingIndex: null,
    savedPromptHashes: new Set<string>(),
    savedIdeas: [],
    savedLoading: false,
    savedListError: null,
    isUsingCache: false,
    loaderMessageIndex: 0,
    run: mockRun,
    save: mockSave,
    loadSaved: mockLoadSaved,
    resetResults: jest.fn(),
    resolveEffectiveSeed: (s: string) => s.trim(),
    hashPrompt: mockHashPrompt,
    ...mockHookState,
  }),
}));

describe("PlanBrainstormPanel", () => {
  const onUseIdea = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockHookState = {};
  });

  it("does not call generate when seed and niche are empty", async () => {
    render(
      <PlanBrainstormPanel
        userIdea=""
        channelBible={{
          niche: "",
          target_audience: "",
          default_video_goal: "",
          default_cta: "",
          brand_style: "",
          visual_style_guide: "",
          tone: "",
        }}
        onUseIdea={onUseIdea}
      />,
    );

    fireEvent.click(screen.getByText(/Brainstorm video ideas/i));
    const generateBtn = screen.getByRole("button", { name: /Generate ideas/i });
    expect(generateBtn).toBeDisabled();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("calls onUseIdea with the card prompt", async () => {
    render(
      <PlanBrainstormPanel
        userIdea="Japan travel"
        channelBible={null}
        onUseIdea={onUseIdea}
      />,
    );

    fireEvent.click(screen.getByText(/Brainstorm video ideas/i));
    fireEvent.click(screen.getByRole("button", { name: /Use this idea/i }));

    expect(onUseIdea).toHaveBeenCalledWith("Budget Japan travel tips for first timers");
  });

  it("calls save handler when Save is clicked", async () => {
    render(
      <PlanBrainstormPanel
        userIdea="Japan travel"
        channelBible={null}
        onUseIdea={onUseIdea}
      />,
    );

    fireEvent.click(screen.getByText(/Brainstorm video ideas/i));
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(0);
    });
  });

  it("keeps the seed field empty after the user clears a prefilled niche", async () => {
    render(
      <PlanBrainstormPanel
        userIdea=""
        channelBible={{
          niche: "Budget Japan travel",
          target_audience: "",
          default_video_goal: "",
          default_cta: "",
          brand_style: "",
          visual_style_guide: "",
          tone: "",
        }}
        onUseIdea={onUseIdea}
      />,
    );

    fireEvent.click(screen.getByText(/Brainstorm video ideas/i));
    const seedInput = screen.getByLabelText(/Topic seed/i);
    expect(seedInput).toHaveValue("Budget Japan travel");

    fireEvent.change(seedInput, { target: { value: "" } });
    expect(seedInput).toHaveValue("");
  });

  it("shows the loading panel while ideas are generating", () => {
    mockHookState = {
      phase: "loading",
      ideas: [],
      loaderMessageIndex: 1,
    };

    render(
      <PlanBrainstormPanel
        userIdea="Japan travel"
        channelBible={null}
        onUseIdea={onUseIdea}
      />,
    );

    fireEvent.click(screen.getByText(/Brainstorm video ideas/i));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Analyzing content and extracting insights/i)).toBeInTheDocument();
  });

  it("toggles trending as a source chip instead of opening a trends modal", () => {
    render(
      <PlanBrainstormPanel
        userIdea="Japan travel"
        channelBible={null}
        onUseIdea={onUseIdea}
      />,
    );

    fireEvent.click(screen.getByText(/Brainstorm video ideas/i));
    const trendingChip = screen.getByRole("button", { name: "Trending" });
    fireEvent.click(trendingChip);

    expect(screen.queryByText(/Select trends topic/i)).not.toBeInTheDocument();
    expect(trendingChip).toHaveAttribute("aria-pressed", "true");
  });

  it("loads saved ideas when repurpose chip is toggled on", () => {
    render(
      <PlanBrainstormPanel
        userIdea="Japan travel"
        channelBible={null}
        onUseIdea={onUseIdea}
      />,
    );

    fireEvent.click(screen.getByText(/Brainstorm video ideas/i));
    fireEvent.click(screen.getByRole("button", { name: "Repurpose" }));

    expect(mockLoadSaved).toHaveBeenCalled();
    expect(screen.getByText(/Saved video ideas/i)).toBeInTheDocument();
  });
});
