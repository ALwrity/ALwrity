import React from "react";

export interface YouTubeExtractedPageView {
  title: string;
  text: string;
  summary: string;
  highlights: string[];
  url: string;
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 48);
  }
}

interface YouTubeUrlExtractAnalysisProps {
  page: YouTubeExtractedPageView;
}

/** Inline extract summary — not a nested dialog. */
function YouTubeUrlExtractAnalysis({ page }: YouTubeUrlExtractAnalysisProps) {
  const host = hostFromUrl(page.url);
  const about = (page.summary || page.text.slice(0, 800)).trim();

  return (
    <div className="yt-url-extract-analysis" data-testid="yt-url-extract-analysis">
      <p className="yt-url-extract-analysis__kicker">Extracted article</p>
      <h4 className="yt-url-extract-analysis__title">{page.title.trim() || host}</h4>
      {host ? (
        <p className="yt-url-extract-analysis__host">{host}</p>
      ) : null}
      {about ? (
        <p className="yt-url-extract-analysis__about">{about}</p>
      ) : null}
      {page.highlights.length > 0 ? (
        <ul className="yt-url-extract-analysis__highlights">
          {page.highlights.slice(0, 6).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default YouTubeUrlExtractAnalysis;
