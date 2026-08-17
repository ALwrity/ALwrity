import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  PlanUrlImportBar,
  buildIdeaFromExtraction,
  extractApiError,
} from "./PlanUrlImportBar";
import { podcastApi } from "../../../services/podcastApi";

jest.mock("../../../services/podcastApi", () => ({
  podcastApi: {
    extractUrl: jest.fn(),
  },
}));

jest.mock("../../PodcastMaker/CreateStep/WebsitePreviewModal", () => {
  const React = require("react");
  return {
    WebsitePreviewModal: (props: {
      open?: boolean;
      useTextLabel?: string;
      showAnalyzeButton?: boolean;
      onUseTextOnly: () => void;
    }) => {
      if (!props.open) return null;
      return React.createElement(
        "div",
        null,
        React.createElement("span", { "data-testid": "use-text-label" }, props.useTextLabel),
        React.createElement(
          "span",
          { "data-testid": "show-analyze" },
          String(props.showAnalyzeButton),
        ),
        React.createElement(
          "button",
          { type: "button", onClick: props.onUseTextOnly },
          "Use for video idea",
        ),
      );
    },
  };
});

const mockedExtractUrl = jest.mocked(podcastApi.extractUrl);

describe("PlanUrlImportBar helpers", () => {
  it("buildIdeaFromExtraction prefers title and summary", () => {
    expect(
      buildIdeaFromExtraction({ title: "Bali Guide", summary: "Pack light.", text: "Long text" }),
    ).toBe("Bali Guide: Pack light.");
  });

  it("extractApiError maps 404 to a helpful message", () => {
    expect(extractApiError({ response: { status: 404 } }, "fallback")).toMatch(/unavailable/i);
  });

  it("extractApiError maps timeout codes", () => {
    expect(extractApiError({ code: "ECONNABORTED" }, "fallback")).toMatch(/timed out/i);
  });
});

describe("PlanUrlImportBar", () => {
  const onIdeaChange = jest.fn();
  const onSourceArticleChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not call extract when the URL is empty", () => {
    render(
      <PlanUrlImportBar
        userIdea=""
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Extract" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Extract" }));
    expect(mockedExtractUrl).not.toHaveBeenCalled();
  });

  it("shows a protocol error and does not call the API for example.com", async () => {
    render(
      <PlanUrlImportBar
        userIdea=""
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Article URL to import"), {
      target: { value: "example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Extract" }));

    expect(await screen.findByText(/http:\/\/ or https:\/\//i)).toBeInTheDocument();
    expect(mockedExtractUrl).not.toHaveBeenCalled();
  });

  it("calls extractUrl with the pasted URL", async () => {
    mockedExtractUrl.mockResolvedValue({
      success: true,
      title: "Bali Guide",
      summary: "Pack light.",
      text: "Longer article text",
      url: "https://example.com/bali-guide",
      highlights: [],
    });

    render(
      <PlanUrlImportBar
        userIdea=""
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Article URL to import"), {
      target: { value: "https://example.com/bali-guide" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Extract" }));

    await waitFor(() => {
      expect(mockedExtractUrl).toHaveBeenCalledWith({ url: "https://example.com/bali-guide" });
    });
  });

  it("extracts on Enter when URL is valid", async () => {
    mockedExtractUrl.mockResolvedValue({
      success: true,
      title: "Bali Guide",
      summary: "Pack light.",
      text: "Longer article text",
      url: "https://example.com/bali-guide",
      highlights: [],
    });

    render(
      <PlanUrlImportBar
        userIdea=""
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
      />,
    );

    const input = screen.getByLabelText("Article URL to import");
    fireEvent.change(input, { target: { value: "https://example.com/bali-guide" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(mockedExtractUrl).toHaveBeenCalledWith({ url: "https://example.com/bali-guide" });
    });
  });

  it("shows the API error when extract returns success=false", async () => {
    mockedExtractUrl.mockResolvedValue({
      success: false,
      url: "https://example.com/missing",
      error: "Failed to extract content: not_found",
    });

    render(
      <PlanUrlImportBar
        userIdea=""
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Article URL to import"), {
      target: { value: "https://example.com/missing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Extract" }));

    expect(await screen.findByText("Failed to extract content: not_found")).toBeInTheDocument();
    expect(onIdeaChange).not.toHaveBeenCalled();
  });

  it("shows sign-in message on 401 errors", async () => {
    mockedExtractUrl.mockRejectedValue({ response: { status: 401 } });

    render(
      <PlanUrlImportBar
        userIdea=""
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Article URL to import"), {
      target: { value: "https://example.com/protected" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Extract" }));

    expect(await screen.findByText("Please sign in again.")).toBeInTheDocument();
  });

  it("fills the idea and source article when Use for video idea is clicked", async () => {
    mockedExtractUrl.mockResolvedValue({
      success: true,
      title: "Bali Guide",
      summary: "Pack light.",
      text: "Longer article text",
      url: "https://example.com/bali-guide",
      highlights: [],
    });

    render(
      <PlanUrlImportBar
        userIdea=""
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Article URL to import"), {
      target: { value: "https://example.com/bali-guide" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Extract" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Use for video idea" })).toBeInTheDocument();
    });
    expect(screen.getByTestId("use-text-label")).toHaveTextContent("Use for video idea");
    expect(screen.getByTestId("show-analyze")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "Use for video idea" }));

    expect(onIdeaChange).toHaveBeenCalledWith("Bali Guide: Pack light.");
    expect(onSourceArticleChange).toHaveBeenCalledWith({
      url: "https://example.com/bali-guide",
      title: "Bali Guide",
      summary: "Pack light.",
    });
    expect(screen.getByText(/Using article: example.com/i)).toBeInTheDocument();
  });

  it("clears source article when the imported chip is deleted", async () => {
    mockedExtractUrl.mockResolvedValue({
      success: true,
      title: "Bali Guide",
      summary: "Pack light.",
      text: "Longer article text",
      url: "https://example.com/bali-guide",
      highlights: [],
    });

    render(
      <PlanUrlImportBar
        userIdea=""
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Article URL to import"), {
      target: { value: "https://example.com/bali-guide" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Extract" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Use for video idea" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Use for video idea" }));

    fireEvent.click(screen.getByTestId("CancelIcon"));

    expect(onSourceArticleChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText(/Using article:/i)).not.toBeInTheDocument();
  });

  it("copies idea URL into the import field", () => {
    render(
      <PlanUrlImportBar
        userIdea="https://example.com/from-idea"
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use idea URL" }));

    expect(screen.getByLabelText("Article URL to import")).toHaveValue(
      "https://example.com/from-idea",
    );
  });

  it("shows an empty-content error when title, summary, and text are missing", async () => {
    mockedExtractUrl.mockResolvedValue({
      success: true,
      title: "",
      summary: "",
      text: "",
      url: "https://example.com/empty",
      highlights: [],
    });

    render(
      <PlanUrlImportBar
        userIdea=""
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Article URL to import"), {
      target: { value: "https://example.com/empty" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Extract" }));

    expect(await screen.findByText("No readable content found at this URL.")).toBeInTheDocument();
    expect(onIdeaChange).not.toHaveBeenCalled();
  });

  it("disables extract while parent disabled prop is true", () => {
    render(
      <PlanUrlImportBar
        userIdea=""
        onIdeaChange={onIdeaChange}
        onSourceArticleChange={onSourceArticleChange}
        disabled
      />,
    );

    fireEvent.change(screen.getByLabelText("Article URL to import"), {
      target: { value: "https://example.com/bali-guide" },
    });
    expect(screen.getByRole("button", { name: "Extract" })).toBeDisabled();
  });
});
