/**
 * Plan idea pane — mic, Enhance Topic with AI, Brainstorm/URL unchanged.
 */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { YouTubePlanIdeaPane } from "../components/YouTubePlanIdeaPane";

const enhancePlanIdea = vi.fn();

vi.mock("../dashboard/youtubeStudioEvents", () => ({
  openYouTubePlanFromCreator: vi.fn(),
}));

vi.mock("../../../services/youtubeApi", async () => {
  const actual = await vi.importActual<typeof import("../../../services/youtubeApi")>(
    "../../../services/youtubeApi",
  );
  return {
    ...actual,
    youtubeApi: {
      ...actual.youtubeApi,
      enhancePlanIdea: (...args: unknown[]) => enhancePlanIdea(...args),
    },
  };
});

function installSpeechRecognition() {
  class FakeSpeechRecognition {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult = null;
    onerror = null;
    onend = null;
    start = vi.fn();
    stop = vi.fn();
  }
  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    writable: true,
    value: FakeSpeechRecognition,
  });
}

describe("YouTubePlanIdeaPane enhance and mic", () => {
  beforeEach(() => {
    enhancePlanIdea.mockReset();
    installSpeechRecognition();
  });

  afterEach(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it("hides the microphone while Generate Pitch is loading", () => {
    render(
      <YouTubePlanIdeaPane
        userIdea="Budget travel packing"
        loading
        language="en"
        durationType="shorts"
        onIdeaChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /dictate video topic/i })).toBeNull();
  });

  it("sends duration and language with the enhance request", async () => {
    enhancePlanIdea.mockResolvedValue({
      enhanced_ideas: ["One", "Two", "Three"],
      rationales: ["A", "B", "C"],
    });
    render(
      <YouTubePlanIdeaPane
        userIdea="Budget travel packing"
        loading={false}
        language="hi"
        durationType="long"
        onIdeaChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enhance topic with ai/i }));
    await waitFor(() => {
      expect(enhancePlanIdea).toHaveBeenCalledWith({
        user_idea: "Budget travel packing",
        duration_type: "long",
        language: "hi",
      });
    });
  });

  it("shows a microphone control when speech is supported", () => {
    render(
      <YouTubePlanIdeaPane
        userIdea="Budget travel packing"
        loading={false}
        language="en"
        durationType="shorts"
        onIdeaChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /dictate video topic/i })).toHaveAttribute(
      "data-tooltip",
      "Dictate your topic. Final words are added to the idea field.",
    );
    expect(screen.getByRole("button", { name: /enhance topic with ai/i })).toHaveAttribute(
      "data-tooltip",
      "Use AI to offer three stronger topic options from your idea.",
    );
  });

  it("disables Enhance Topic with AI when the idea is empty", () => {
    render(
      <YouTubePlanIdeaPane
        userIdea="   "
        loading={false}
        language="en"
        durationType="medium"
        onIdeaChange={vi.fn()}
      />,
    );
    const enhance = screen.getByRole("button", { name: /enhance topic with ai/i });
    expect(enhance).toBeDisabled();
    expect(enhance).toHaveAttribute(
      "data-tooltip",
      "Use AI to offer three stronger topic options from your idea.",
    );
  });

  it("shows the Hub progress status bar while enhance is in flight", async () => {
    let resolveEnhance: (value: {
      enhanced_ideas: string[];
      rationales: string[];
    }) => void = () => undefined;
    enhancePlanIdea.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEnhance = resolve;
        }),
    );
    render(
      <YouTubePlanIdeaPane
        userIdea="Budget travel packing"
        loading={false}
        language="en"
        durationType="shorts"
        onIdeaChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enhance topic with ai/i }));
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/Enhancing topic/i);
    expect(status).toHaveTextContent(/Loading Channel Bible context/i);
    resolveEnhance({
      enhanced_ideas: ["One", "Two", "Three"],
      rationales: ["A", "B", "C"],
    });
    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
  });

  it("opens three choices and replaces the idea when one is selected", async () => {
    enhancePlanIdea.mockResolvedValue({
      enhanced_ideas: [
        "Tokyo weekend packing without a suitcase.",
        "A 48-hour Tokyo packing checklist.",
        "What to leave at home for Tokyo.",
      ],
      rationales: ["A", "B", "C"],
    });
    const onIdeaChange = vi.fn();
    render(
      <YouTubePlanIdeaPane
        userIdea="Budget travel packing"
        loading={false}
        language="en"
        durationType="shorts"
        onIdeaChange={onIdeaChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enhance topic with ai/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(screen.getByDisplayValue("Tokyo weekend packing without a suitcase.")).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole("button", { name: /use this topic/i })[0]);
    expect(onIdeaChange).toHaveBeenCalledWith("Tokyo weekend packing without a suitcase.");
  });

  it("keeps Brainstorm and Blog/URL shortcuts", () => {
    render(
      <YouTubePlanIdeaPane
        userIdea="Budget travel packing"
        loading={false}
        language="en"
        durationType="shorts"
        onIdeaChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /brainstorm video idea/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /blog \/ url/i })).toBeTruthy();
  });

  it("shows an error when enhance fails", async () => {
    enhancePlanIdea.mockRejectedValue(new Error("Enhance failed"));
    render(
      <YouTubePlanIdeaPane
        userIdea="Budget travel packing"
        loading={false}
        language="en"
        durationType="shorts"
        onIdeaChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enhance topic with ai/i }));
    await waitFor(() => {
      expect(screen.getByText(/could not enhance/i)).toBeTruthy();
    });
  });
});
