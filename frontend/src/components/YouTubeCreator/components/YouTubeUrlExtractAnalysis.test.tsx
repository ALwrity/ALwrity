import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import YouTubeUrlExtractAnalysis from "./YouTubeUrlExtractAnalysis";

describe("YouTubeUrlExtractAnalysis", () => {
  const basePage = {
    title: "Bali Travel Co",
    text: "Full article body text.",
    summary: "A guide to Bali beaches.",
    highlights: ["Pack light", "Book early"],
    url: "https://example.com/bali-guide",
    favicon: "https://example.com/favicon.ico",
    image: "https://example.com/og.jpg",
    subpages: [
      {
        title: "Ubud Guide",
        url: "https://example.com/ubud",
        summary: "Temples and rice terraces.",
      },
    ],
  };

  it("renders full content analysis sections inline", () => {
    render(<YouTubeUrlExtractAnalysis page={basePage} />);

    expect(screen.getByLabelText("example.com Content Analysis")).toBeInTheDocument();
    expect(screen.getByText("example.com Content Analysis")).toBeInTheDocument();
    expect(screen.getByText("Extracted content from your website")).toBeInTheDocument();
    expect(screen.getByText("Company / Organization")).toBeInTheDocument();
    expect(screen.getByText("Bali Travel Co")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
    expect(screen.getByText("A guide to Bali beaches.")).toBeInTheDocument();
    expect(screen.getByText("Key Highlights")).toBeInTheDocument();
    expect(screen.getByText("Pack light")).toBeInTheDocument();
    expect(screen.getByText("Source URL")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/bali-guide")).toBeInTheDocument();
    expect(screen.getByText("Site Image")).toBeInTheDocument();
    expect(screen.getByAltText("Favicon")).toBeInTheDocument();
    expect(screen.getByAltText("Site")).toBeInTheDocument();
    expect(screen.getByText("Subpages (1)")).toBeInTheDocument();
    expect(screen.getByText("Ubud Guide")).toBeInTheDocument();
  });

  it("falls back to body text for About when summary is empty", () => {
    render(
      <YouTubeUrlExtractAnalysis
        page={{
          ...basePage,
          summary: "",
          text: "Body-only extract.",
        }}
      />,
    );

    expect(screen.getByText("Body-only extract.")).toBeInTheDocument();
  });
});
