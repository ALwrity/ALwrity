/**
 * Publish metadata fields must be readable on the white Creator surface
 * (global MUI theme is dark) and stay editable, including tags-in-progress.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePublishMetadataFields } from "../components/YouTubePublishMetadataFields";
import type { YouTubePublishMetadata } from "../components/youtubePublishMetadata";

const FIELDS_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "components",
  "YouTubePublishMetadataFields.tsx",
);

const metadata: YouTubePublishMetadata = {
  title: "Rank Videos in 7 Days",
  description: "Use searchable titles and retention hooks.",
  tags: ["youtube seo", "retention"],
  category_id: "22",
};

function Harness({ initial = metadata }: { initial?: YouTubePublishMetadata }) {
  const [value, setValue] = useState(initial);
  return <YouTubePublishMetadataFields metadata={value} onMetadataChange={setValue} />;
}

describe("YouTubePublishMetadataFields readability and edits", () => {
  it("reuses YouTube Creator inputSx and labelSx", () => {
    const source = readFileSync(FIELDS_SOURCE, "utf8");
    expect(source).toContain("inputSx");
    expect(source).toContain("labelSx");
  });

  it("renders Title, Description, Tags, and Category as enabled editors", () => {
    render(<YouTubePublishMetadataFields metadata={metadata} onMetadataChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /YouTube details/i })).not.toBeNull();
    expect(screen.getByText(/sent when you publish/i)).not.toBeNull();

    for (const label of ["Title", "Description", "Tags", "Category"]) {
      const field = screen.getByLabelText(label);
      expect(field).not.toBeDisabled();
      expect(field).not.toHaveAttribute("readonly");
    }
  });

  it("keeps a trailing comma while typing tags, then saves parsed tags", () => {
    const onMetadataChange = vi.fn();
    render(
      <YouTubePublishMetadataFields metadata={metadata} onMetadataChange={onMetadataChange} />,
    );

    const tags = screen.getByLabelText("Tags");
    fireEvent.focus(tags);
    fireEvent.change(tags, { target: { value: "seo, " } });
    expect(tags).toHaveProperty("value", "seo, ");

    fireEvent.change(tags, { target: { value: "seo, ranking" } });
    expect(onMetadataChange.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([expect.objectContaining({ tags: ["seo", "ranking"] })]),
    );
  });

  it("does not wipe in-progress tags when the parent stores the parsed list", () => {
    render(<Harness />);

    const tags = screen.getByLabelText("Tags");
    fireEvent.focus(tags);
    fireEvent.change(tags, { target: { value: "seo, " } });
    expect(tags).toHaveProperty("value", "seo, ");
  });

  it("reports title, description, and category edits", () => {
    const onMetadataChange = vi.fn();
    render(
      <YouTubePublishMetadataFields metadata={metadata} onMetadataChange={onMetadataChange} />,
    );

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited title" } });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Edited description" },
    });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "27" } });

    expect(onMetadataChange.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Edited title" }),
        expect.objectContaining({ description: "Edited description" }),
        expect.objectContaining({ category_id: "27" }),
      ]),
    );
  });
});
