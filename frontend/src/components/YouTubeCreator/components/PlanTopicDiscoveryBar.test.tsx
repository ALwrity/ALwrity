import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlanTopicDiscoveryBar } from "./PlanTopicDiscoveryBar";
import { podcastApi } from "../../../services/podcastApi";

jest.mock("../../../services/podcastApi", () => ({
  podcastApi: {
    getTrendingTopics: jest.fn(),
    researchByCategory: jest.fn(),
  },
}));

jest.mock("../../PodcastMaker/CreateStep/TrendingTopicsModal", () => {
  const React = require("react");
  return {
    TrendingTopicsModal: (props: { open?: boolean; source?: string; onSelectTopic: (topic: string) => void }) => {
      if (!props.open) return null;
      return React.createElement(
        "div",
        null,
        React.createElement("span", { "data-testid": "trends-source" }, props.source),
        React.createElement(
          "button",
          { type: "button", onClick: () => props.onSelectTopic("Rising YouTube query") },
          "Select trends topic",
        ),
      );
    },
  };
});

jest.mock("../../PodcastMaker/CreateStep/CategoryResearchModal", () => {
  const React = require("react");
  return {
    CategoryResearchModal: (props: {
      open?: boolean;
      loading?: boolean;
      error?: string | null;
      topics?: Array<{ title: string }>;
      onSelectTopic: (topic: string) => void;
    }) => {
      if (!props.open) return null;
      const topics = props.topics || [];
      return React.createElement(
        "div",
        null,
        props.loading ? React.createElement("span", null, "Searching categories...") : null,
        props.error ? React.createElement("span", null, props.error) : null,
        ...topics.map((topic: { title: string }) =>
          React.createElement(
            "button",
            {
              key: topic.title,
              type: "button",
              onClick: () => props.onSelectTopic(topic.title),
            },
            topic.title,
          ),
        ),
      );
    },
  };
});

const mockedResearchByCategory = podcastApi.researchByCategory as jest.Mock;

describe("PlanTopicDiscoveryBar", () => {
  const onIdeaChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("disables trends and category chips when the idea is empty", () => {
    render(<PlanTopicDiscoveryBar userIdea="" onIdeaChange={onIdeaChange} />);

    expect(screen.getByRole("button", { name: /Get Trending Topics — Coming Soon/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "News" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Type a video idea first/i)).toBeInTheDocument();
  });

  it("keeps trends locked but enables category chips when the user has typed an idea", () => {
    render(<PlanTopicDiscoveryBar userIdea="AI tutorials" onIdeaChange={onIdeaChange} />);

    expect(screen.getByRole("button", { name: /Get Trending Topics — Coming Soon/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "News" })).toBeEnabled();
  });

  it("calls researchByCategory for News with the typed idea", async () => {
    mockedResearchByCategory.mockResolvedValue({
      success: true,
      category: "news",
      provider: "tavily",
      topics: [{ title: "AI news headline", url: "https://example.com", snippet: "s", score: 0.9 }],
    });

    render(<PlanTopicDiscoveryBar userIdea="AI tutorials" onIdeaChange={onIdeaChange} />);
    fireEvent.click(screen.getByRole("button", { name: "News" }));

    await waitFor(() => {
      expect(mockedResearchByCategory).toHaveBeenCalledWith({
        category: "news",
        keyword: "AI tutorials",
        maxResults: 8,
        websiteUrl: undefined,
      });
    });
  });

  it("fills the idea when a category topic is selected", async () => {
    mockedResearchByCategory.mockResolvedValue({
      success: true,
      category: "news",
      provider: "tavily",
      topics: [{ title: "AI news headline", url: "https://example.com", snippet: "s", score: 0.9 }],
    });

    render(<PlanTopicDiscoveryBar userIdea="AI tutorials" onIdeaChange={onIdeaChange} />);
    fireEvent.click(screen.getByRole("button", { name: "News" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "AI news headline" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "AI news headline" }));

    expect(onIdeaChange).toHaveBeenCalledWith("AI news headline");
  });

  it("shows the API error when category search returns success=false", async () => {
    mockedResearchByCategory.mockResolvedValue({
      success: false,
      category: "news",
      provider: "tavily",
      topics: [],
      error: "Tavily search failed: quota exceeded",
    });

    render(<PlanTopicDiscoveryBar userIdea="AI tutorials" onIdeaChange={onIdeaChange} />);
    fireEvent.click(screen.getByRole("button", { name: "News" }));

    await waitFor(() => {
      expect(screen.getByText("Tavily search failed: quota exceeded")).toBeInTheDocument();
    });
    expect(onIdeaChange).not.toHaveBeenCalled();
  });

  it("shows the server quota message on HTTP 429", async () => {
    mockedResearchByCategory.mockRejectedValue({
      response: {
        status: 429,
        data: { detail: { message: "Monthly Tavily limit reached" } },
      },
    });

    render(<PlanTopicDiscoveryBar userIdea="AI tutorials" onIdeaChange={onIdeaChange} />);
    fireEvent.click(screen.getByRole("button", { name: "News" }));

    await waitFor(() => {
      expect(screen.getByText("Monthly Tavily limit reached")).toBeInTheDocument();
    });
    expect(onIdeaChange).not.toHaveBeenCalled();
  });

  it("does not open trends while coming soon is enabled", () => {
    render(<PlanTopicDiscoveryBar userIdea="AI tutorials" onIdeaChange={onIdeaChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Get Trending Topics — Coming Soon/i }));

    expect(screen.queryByTestId("trends-source")).not.toBeInTheDocument();
  });
});
