import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CreateWedgeModal } from "../modals/CreateWedgeModal";
import type { YouTubeCreatorState } from "../../../../hooks/useYouTubeCreatorState";

const emptyCreatorState = {
  userIdea: "",
  videoPlan: null,
  scenes: [],
} as unknown as YouTubeCreatorState;

describe("CreateWedgeModal — shared goCreate → Full Creator modal", () => {
  it("New Video (Full) calls goCreate with medium duration", () => {
    const goCreate = vi.fn();

    render(
      <CreateWedgeModal
        open
        onClose={vi.fn()}
        goCreate={goCreate}
        creatorState={emptyCreatorState}
        onOpenSeo={vi.fn()}
        onOpenThumb={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /New Video \(Full\)/i }));
    expect(goCreate).toHaveBeenCalledWith({ step: 0, durationType: "medium" });
  });

  it("Shorts Fast Path calls goCreate with shorts duration", () => {
    const goCreate = vi.fn();

    render(
      <CreateWedgeModal
        open
        onClose={vi.fn()}
        goCreate={goCreate}
        creatorState={emptyCreatorState}
        onOpenSeo={vi.fn()}
        onOpenThumb={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Shorts Fast Path/i }));
    expect(goCreate).toHaveBeenCalledWith({ step: 0, durationType: "shorts" });
  });
});
