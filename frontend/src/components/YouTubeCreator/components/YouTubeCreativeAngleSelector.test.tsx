import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeCreativeAngleSelector } from "./YouTubeCreativeAngleSelector";

describe("YouTubeCreativeAngleSelector", () => {
  it("selects a preset chip", () => {
    const onChange = jest.fn();
    render(<YouTubeCreativeAngleSelector value="" onChange={onChange} />);

    fireEvent.click(screen.getByText("Contrarian"));
    expect(onChange).toHaveBeenCalledWith("Contrarian");
  });

  it("shows custom text field when Custom is selected", () => {
    const onChange = jest.fn();
    render(<YouTubeCreativeAngleSelector value="" onChange={onChange} />);

    fireEvent.click(screen.getByText("Custom"));
    expect(screen.getByLabelText("Custom creative angle")).toBeInTheDocument();
  });
});
