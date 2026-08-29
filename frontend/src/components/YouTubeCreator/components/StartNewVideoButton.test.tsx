import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StartNewVideoButton } from "./StartNewVideoButton";

describe("StartNewVideoButton", () => {
  it("calls onConfirm after user confirms in dialog", () => {
    const onConfirm = vi.fn();
    render(<StartNewVideoButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Start New Video/i }));
    expect(screen.getByText(/Start a new video\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start fresh/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not call onConfirm when cancelled", () => {
    const onConfirm = vi.fn();
    render(<StartNewVideoButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Start New Video/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does not force the confirm dialog to Hub modal z-index", () => {
    render(<StartNewVideoButton onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Start New Video/i }));
    const dialog = screen.getByRole("dialog");
    const modalRoot = dialog.closest(".MuiModal-root") as HTMLElement | null;
    expect(modalRoot?.style.zIndex).not.toBe("13000");
    expect(dialog.getAttribute("style") ?? "").not.toMatch(/z-index:\s*13000/);
  });
});
