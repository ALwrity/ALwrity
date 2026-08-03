/**
 * LinkedInEmojiPicker smoke tests — full picker UI is provided by emoji-picker-react.
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LinkedInEmojiPicker } from "../components/LinkedInEmojiPicker";

jest.mock("emoji-picker-react", () => {
  const React = require("react");
  const MockPicker = ({
    onEmojiClick,
  }: {
    onEmojiClick: (data: { emoji: string; unified: string; names: string[] }) => void;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": "mock-emoji-picker",
        onClick: () =>
          onEmojiClick({ emoji: "🚀", unified: "1f680", names: ["rocket"] }),
      },
      "pick-rocket",
    );

  return {
    __esModule: true,
    default: MockPicker,
    Theme: { LIGHT: "light" },
    SuggestionMode: { RECENT: "recent" },
  };
});

describe("LinkedInEmojiPicker", () => {
  it("opens picker and inserts selected emoji via onSelect", () => {
    const onSelect = jest.fn();
    render(React.createElement(LinkedInEmojiPicker, { onSelect }));

    fireEvent.click(screen.getByLabelText("Add emoji"));
    fireEvent.click(screen.getByTestId("mock-emoji-picker"));

    expect(onSelect).toHaveBeenCalledWith("🚀");
  });

  it("does not open when disabled", () => {
    const onSelect = jest.fn();
    render(
      React.createElement(LinkedInEmojiPicker, { onSelect, disabled: true }),
    );

    fireEvent.click(screen.getByLabelText("Add emoji"));
    expect(screen.queryByTestId("mock-emoji-picker")).toBeNull();
  });
});
