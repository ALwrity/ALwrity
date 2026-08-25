/**
 * Plan Your Video (Phase 0): dual generate UX removed.
 * Component test — Jest + React Testing Library (TESTING.md).
 */

import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PlanStep } from "../components/PlanStep";

vi.mock("../components/ChannelBiblePanel", () => ({
  ChannelBiblePanel: () => null,
}));
vi.mock("../components/PlanPromptPreview", () => ({
  PlanPromptPreview: () => null,
}));
vi.mock("../components/PlanDiscoveryShortcuts", () => ({
  PlanDiscoveryShortcuts: () => null,
}));
vi.mock("../../shared/AssetLibraryImageModal", () => ({
  AssetLibraryImageModal: () => null,
}));
vi.mock("../hooks/useAvatarBlobUrl", () => ({
  useAvatarBlobUrl: () => ({ avatarBlobUrl: null, avatarLoading: false }),
}));

const noop = () => undefined;

function renderPlanStep() {
  return render(
    <PlanStep
      userIdea="Budget travel packing"
      durationType="shorts"
      language="en"
      loading={false}
      referenceImage=""
      channelBible={null}
      enableResearch={false}
      creativeAngle="Contrarian"
      currentPitch={null}
      pitchHistory={[]}
      scriptPhase="idle"
      onIdeaChange={noop}
      onDurationChange={noop}
      onVideoTypeChange={noop}
      onTargetAudienceChange={noop}
      onVideoGoalChange={noop}
      onBrandStyleChange={noop}
      onReferenceImageChange={noop}
      onLanguageChange={noop}
      onAvatarUpload={noop}
      onRemoveAvatar={noop}
      onMakePresentable={noop}
      onAvatarSelectFromLibrary={noop}
      onBibleChange={noop}
      onSaveBible={noop}
      onApplyBible={noop}
      onEnableResearchChange={noop}
      onCreativeAngleChange={noop}
      onGeneratePitch={noop}
      onRegeneratePitch={noop}
      onExpandPitch={noop}
      onSelectPitchFromHistory={noop}
    />,
  );
}

describe("PlanStep Phase 0 dual UX", () => {
  it("does not offer Generate Video Plan; pitch is the only generate action", () => {
    renderPlanStep();
    expect(screen.queryByRole("button", { name: /generate video plan/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate pitch/i })).toBeInTheDocument();
  });

  it("describes content language for pitch, script, and audio", () => {
    renderPlanStep();
    expect(
      screen.getByText(/Pitch, script, and default audio use this language/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/still generated in English/i)).not.toBeInTheDocument();
  });
});
