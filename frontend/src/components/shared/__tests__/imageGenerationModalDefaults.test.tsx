import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImageGenerationModal } from "../ImageGenerationModal";
import { LINKEDIN_IMAGE_MODELS } from "../ImageGenerationPresets";
import { LINKEDIN_DEFAULT_IMAGE_MODEL } from "../linkedInImageModelUtils";

function getModelSelect() {
  return screen.getAllByRole("combobox")[2];
}

describe("ImageGenerationModal default model", () => {
  it("opens with the LinkedIn default model selected", () => {
    render(
      <ImageGenerationModal
        open
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        initialPrompt="LinkedIn post about AI"
        showModelSelection
        availableModels={LINKEDIN_IMAGE_MODELS}
        defaultModel={LINKEDIN_DEFAULT_IMAGE_MODEL}
      />,
    );

    expect(getModelSelect().textContent).toContain("Gemini 3 Pro Image");
  });

  it("resets to defaultModel when the modal is reopened", async () => {
    const onClose = vi.fn();

    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <ImageGenerationModal
            open={open}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            onGenerate={vi.fn()}
            initialPrompt="LinkedIn post about AI"
            showModelSelection
            availableModels={LINKEDIN_IMAGE_MODELS}
            defaultModel={LINKEDIN_DEFAULT_IMAGE_MODEL}
          />
        </>
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(getModelSelect().textContent).toContain("Gemini 3 Pro Image");

    fireEvent.mouseDown(getModelSelect());
    fireEvent.click(screen.getByRole("option", { name: /Ideogram V3 Turbo/i }));
    expect(getModelSelect().textContent).toContain("Ideogram V3 Turbo");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(getModelSelect().textContent).toContain("Gemini 3 Pro Image");
  });
});
