import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeMobileWorkflowGrid } from "../YouTubeMobileWorkflowGrid";

describe("YouTubeMobileWorkflowGrid", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders the LinkedIn-style creating-today heading and six wedges", () => {
    render(
      <YouTubeMobileWorkflowGrid
        onCardAction={() => undefined}
        profileHubSlot={<span>hub</span>}
      />,
    );
    expect(screen.getByRole("heading", { name: "What are You Creating Today" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Plan:/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Create:/ })).toBeTruthy();
    expect(screen.getByText("START")).toBeTruthy();
  });

  it("invokes onCardAction without mock data", () => {
    const onCardAction = vi.fn();
    render(<YouTubeMobileWorkflowGrid onCardAction={onCardAction} />);
    fireEvent.click(screen.getByRole("button", { name: /Publish:/ }));
    expect(onCardAction).toHaveBeenCalledWith("publish");
  });
});
