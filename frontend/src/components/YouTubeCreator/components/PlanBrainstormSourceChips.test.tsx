import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanBrainstormSourceChips } from "./PlanBrainstormSourceChips";

describe("PlanBrainstormSourceChips", () => {
  const onToggleChannelBible = jest.fn();
  const onToggleTrending = jest.fn();
  const onToggleRepurpose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all source chips in one row", () => {
    render(
      <PlanBrainstormSourceChips
        useChannelBible
        includeTrending={false}
        includeRepurpose={false}
        hasChannelBible
        onToggleChannelBible={onToggleChannelBible}
        onToggleTrending={onToggleTrending}
        onToggleRepurpose={onToggleRepurpose}
      />,
    );

    expect(screen.getByRole("button", { name: "Channel Bible" })).toBeInTheDocument();
    expect(screen.getByText("Web research")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repurpose" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trending" })).toBeInTheDocument();
  });

  it("toggles trending without opening a modal action", () => {
    render(
      <PlanBrainstormSourceChips
        useChannelBible={false}
        includeTrending={false}
        includeRepurpose={false}
        hasChannelBible
        onToggleChannelBible={onToggleChannelBible}
        onToggleTrending={onToggleTrending}
        onToggleRepurpose={onToggleRepurpose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Trending" }));
    expect(onToggleTrending).toHaveBeenCalledTimes(1);
  });
});
