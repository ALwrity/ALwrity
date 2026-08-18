import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { StartNewVideoButton } from "./StartNewVideoButton";

describe("StartNewVideoButton", () => {
  it("calls onConfirm after user confirms in dialog", () => {
    const onConfirm = jest.fn();
    render(<StartNewVideoButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Start New Video/i }));
    expect(screen.getByText(/Start a new video\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start fresh/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not call onConfirm when cancelled", () => {
    const onConfirm = jest.fn();
    render(<StartNewVideoButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Start New Video/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
