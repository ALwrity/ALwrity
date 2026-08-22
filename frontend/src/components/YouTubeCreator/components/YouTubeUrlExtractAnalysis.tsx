import React from "react";

export interface YouTubeExtractedSubpage {
  id?: string;
  title?: string;
  url?: string;
  summary?: string;
  text?: string;
}

export interface YouTubeExtractedPageView {
  title: string;
  text: string;
  summary: string;
  highlights: string[];
  url: string;
  image?: string;
  favicon?: string;
  subpages?: YouTubeExtractedSubpage[];
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 48) || "Website";
  }
}

function truncateAbout(summary: string, text: string): string {
  const raw = (summary || text).trim();
  if (!raw) return "";
  return raw.length > 800 ? `${raw.slice(0, 800)}...` : raw;
}

interface YouTubeUrlExtractAnalysisProps {
  page: YouTubeExtractedPageView;
}

/** Inline content analysis — same sections as WebsitePreviewModal, no nested dialog. */
function YouTubeUrlExtractAnalysis({ page }: YouTubeUrlExtractAnalysisProps) {
  const host = hostFromUrl(page.url);
  const title = page.title.trim();
  const about = truncateAbout(page.summary, page.text);
  const highlights = page.highlights.slice(0, 6);
  const subpages = page.subpages?.slice(0, 4) ?? [];
  const showSiteImage = Boolean(page.image || page.favicon);

  return (
    <div
      className="yt-url-extract-analysis"
      data-testid="yt-url-extract-analysis"
      aria-label={`${host} Content Analysis`}
    >
      <header className="yt-url-extract-analysis__header">
        {page.favicon || page.image ? (
          <img
            className="yt-url-extract-analysis__header-icon"
            src={page.favicon || page.image}
            alt=""
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="yt-url-extract-analysis__header-fallback" aria-hidden>
            🌐
          </span>
        )}
        <div>
          <h3 className="yt-url-extract-analysis__header-title">{host} Content Analysis</h3>
          <p className="yt-url-extract-analysis__header-subtitle">
            Extracted content from your website
          </p>
        </div>
      </header>

      {title ? (
        <section className="yt-url-extract-analysis__section">
          <p className="yt-url-extract-analysis__label">Company / Organization</p>
          <p className="yt-url-extract-analysis__heading">{title}</p>
        </section>
      ) : null}

      {about ? (
        <section className="yt-url-extract-analysis__section">
          <p className="yt-url-extract-analysis__label">About</p>
          <div className="yt-url-extract-analysis__about-box">{about}</div>
        </section>
      ) : null}

      {highlights.length > 0 ? (
        <section className="yt-url-extract-analysis__section">
          <p className="yt-url-extract-analysis__label">Key Highlights</p>
          <ul className="yt-url-extract-analysis__highlights">
            {highlights.map((item, index) => (
              <li key={`${index}-${item.slice(0, 48)}`}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <hr className="yt-url-extract-analysis__divider" />

      <section className="yt-url-extract-analysis__source">
        <span className="yt-url-extract-analysis__source-icon" aria-hidden>
          🌐
        </span>
        <div>
          <p className="yt-url-extract-analysis__label">Source URL</p>
          <p className="yt-url-extract-analysis__source-url">{page.url}</p>
        </div>
      </section>

      {showSiteImage ? (
        <section className="yt-url-extract-analysis__section">
          <p className="yt-url-extract-analysis__label">Site Image</p>
          <div className="yt-url-extract-analysis__site-images">
            {page.favicon ? (
              <img
                className="yt-url-extract-analysis__favicon"
                src={page.favicon}
                alt="Favicon"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            {page.image ? (
              <img
                className="yt-url-extract-analysis__site-image"
                src={page.image}
                alt="Site"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {subpages.length > 0 ? (
        <section className="yt-url-extract-analysis__section">
          <p className="yt-url-extract-analysis__label">
            Subpages ({page.subpages?.length ?? subpages.length})
          </p>
          <ul className="yt-url-extract-analysis__subpages">
            {subpages.map((subpage, index) => (
              <li key={subpage.id || subpage.url || `subpage-${index}`}>
                <p className="yt-url-extract-analysis__subpage-title">
                  {subpage.title || subpage.url || `Page ${index + 1}`}
                </p>
                {subpage.summary ? (
                  <p className="yt-url-extract-analysis__subpage-summary">{subpage.summary}</p>
                ) : null}
                {subpage.url ? (
                  <p className="yt-url-extract-analysis__subpage-url">{subpage.url}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default YouTubeUrlExtractAnalysis;
