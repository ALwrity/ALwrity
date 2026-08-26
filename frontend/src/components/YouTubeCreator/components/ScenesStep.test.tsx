import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { ScenesStep } from "./ScenesStep";
import type { VideoPlan } from "../../../services/youtubeApi";

const videoPlan: VideoPlan = {
  video_summary: "Budget travel tips",
  target_audience: "Travelers",
  video_goal: "Educate",
  key_message: "Save money",
  content_outline: [
    { section: "Hook", description: "Open strong", duration_estimate: 10 },
  ],
  hook_strategy: "Ask a question",
  call_to_action: "Subscribe",
  visual_style: "cinematic",
  tone: "friendly",
  seo_keywords: ["travel"],
  duration_type: "medium",
};

const noop = () => undefined;

describe("ScenesStep", () => {
  it("shows UnifiedPlanScript and hides PlanDetails chips after Phase 2", () => {
    render(
      <ScenesStep
        videoPlan={videoPlan}
        scenes={[]}
        editingSceneId={null}
        editedScene={null}
        loading={false}
        onBuildScenes={noop}
        onEditScene={noop}
        onSaveScene={noop}
        onCancelEdit={noop}
        onEditChange={noop}
        onToggleScene={noop}
        onBack={noop}
        onNext={noop}
        scriptPhase="ready"
        fullScript="Hook spoken.\n\nBody spoken."
      />,
    );

    expect(screen.getByLabelText("Full video script")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Hook spoken/)).toBeInTheDocument();
    expect(screen.queryByText("Target Audience")).not.toBeInTheDocument();
    expect(screen.queryByText("Key Message")).not.toBeInTheDocument();
    expect(screen.queryByText("SEO Keywords")).not.toBeInTheDocument();
  });

  it("shows the exact expand prompt after Phase 2 without restoring plan chips", () => {
    render(
      <ScenesStep
        videoPlan={{
          ...videoPlan,
          generation: {
            text_gateway: "llm_text_gen",
            system_prompt: "You are ALwrity Script.",
            user_prompt: "Expand this approved pitch.",
            json_schema_applied: true,
          },
        }}
        scenes={[]}
        editingSceneId={null}
        editedScene={null}
        loading={false}
        onBuildScenes={noop}
        onEditScene={noop}
        onSaveScene={noop}
        onCancelEdit={noop}
        onEditChange={noop}
        onToggleScene={noop}
        onBack={noop}
        onNext={noop}
        scriptPhase="ready"
        fullScript="Hook spoken.\n\nBody spoken."
      />,
    );

    expect(screen.getByText("Exact expand prompt sent to the LLM")).toBeInTheDocument();
    expect(screen.getByText("You are ALwrity Script.")).toBeInTheDocument();
    expect(screen.getByText("Expand this approved pitch.")).toBeInTheDocument();
    expect(screen.queryByText("Target Audience")).not.toBeInTheDocument();
  });

  it("shows PlanDetails chip layout for the legacy generated plan", () => {
    render(
      <ScenesStep
        videoPlan={videoPlan}
        scenes={[]}
        editingSceneId={null}
        editedScene={null}
        loading={false}
        onBuildScenes={noop}
        onEditScene={noop}
        onSaveScene={noop}
        onCancelEdit={noop}
        onEditChange={noop}
        onToggleScene={noop}
        onBack={noop}
        onNext={noop}
        scriptPhase="idle"
      />,
    );

    expect(screen.getByText("Target Audience")).toBeInTheDocument();
    expect(screen.queryByLabelText("Full video script")).not.toBeInTheDocument();
  });

  it("does not wrap Scenes in a Hub modal shell or trap asset dialogs", () => {
    const { container } = render(
      <ScenesStep
        videoPlan={videoPlan}
        scenes={[]}
        editingSceneId={null}
        editedScene={null}
        loading={false}
        onBuildScenes={noop}
        onEditScene={noop}
        onSaveScene={noop}
        onCancelEdit={noop}
        onEditChange={noop}
        onToggleScene={noop}
        onBack={noop}
        onNext={noop}
        scriptPhase="idle"
      />,
    );

    expect(container.querySelector(".yt-modal-backdrop")).toBeNull();
    expect(container.querySelector(".yt-creator-surface")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
