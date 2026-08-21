import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CreateWedgeModal } from "../modals/CreateWedgeModal";
import type { YouTubeCreatorState } from "../../../../hooks/useYouTubeCreatorState";

const emptyCreatorState = {
  userIdea: "",
  videoPlan: null,
  scenes: [],
} as unknown as YouTubeCreatorState;

describe("CreateWedgeModal — New Video (Full) opens Full Creator modal", () => {
  it("calls onOpenFullCreator instead of goCreate", () => {
    const goCreate = jest.fn();
    const onOpenFullCreator = jest.fn();

    render(
      <CreateWedgeModal
        open
        onClose={jest.fn()}
        goCreate={goCreate}
        creatorState={emptyCreatorState}
        onOpenSeo={jest.fn()}
        onOpenThumb={jest.fn()}
        onOpenFullCreator={onOpenFullCreator}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /New Video \(Full\)/i }));
    expect(onOpenFullCreator).toHaveBeenCalledTimes(1);
    expect(goCreate).not.toHaveBeenCalled();
  });

  it("keeps Shorts on goCreate (tab path until later PR)", () => {
    const goCreate = jest.fn();

    render(
      <CreateWedgeModal
        open
        onClose={jest.fn()}
        goCreate={goCreate}
        creatorState={emptyCreatorState}
        onOpenSeo={jest.fn()}
        onOpenThumb={jest.fn()}
        onOpenFullCreator={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Shorts Fast Path/i }));
    expect(goCreate).toHaveBeenCalledWith({ step: 0, durationType: "shorts" });
  });
});
