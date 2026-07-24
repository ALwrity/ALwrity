import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./blog-dashboard-layout.css";
import { BlogRadialWorkflow } from "./BlogRadialWorkflow";
import { BlogMobileWorkflowGrid } from "./BlogMobileWorkflowGrid";
import { BlogWriterProfileHub } from "./BlogWriterProfileHub";
import { BlogPerformanceModal } from "./BlogPerformanceModal";
import { BlogRefreshCandidatesModal } from "./BlogRefreshCandidatesModal";
import { computeBlogRadialLayout } from "./blogRadialLayout";
import type { BlogWorkflowCardId } from "./blogWorkflowConfig";
import { useBlogWorkflowMetrics } from "./useBlogWorkflowMetrics";
import { useWordPressConnection } from "../../../hooks/useWordPressConnection";
import { useWixConnection } from "../../../hooks/useWixConnection";
import { useGSCBrainstorm } from "../../../hooks/useGSCBrainstorm";

const DESKTOP_MIN_WIDTH_PX = 761;

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`);
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return desktop;
}

interface BlogWorkflowHeroSectionProps {
  /** Falls back to the existing "start writing" behavior when a specific phase isn't available. */
  onStartWriting: () => void;
  /** Existing 5-phase navigation from usePhaseNavigation — wedges reuse it, they don't replace it. */
  navigateToPhase?: (phase: string) => void;
  hasResearch?: boolean;
  /** Restores a saved blog asset into the editor (same mechanism as the Asset Library). */
  onRestoreAsset?: (assetId: number) => void;
  /**
   * When true, the component is rendered as a plain inline flex block instead of a
   * full-width section — intended to be placed inside the existing Blog Writer
   * hero container alongside the headline and CTAs.
   */
  inline?: boolean;
}

/**
 * Blog Writer Radial Workflow Hero (6 wedges) — Plan / Create / Publish /
 * Analysis / Engagement / Remarket. Added as a standalone section on the
 * Blog Writer landing page; does not replace or alter the existing hero,
 * CTAs, or SuperPowers modal above it.
 */
export const BlogWorkflowHeroSection: React.FC<BlogWorkflowHeroSectionProps> = ({
  onStartWriting,
  navigateToPhase,
  hasResearch = false,
  onRestoreAsset,
  inline = false,
}) => {
  const isDesktop = useIsDesktop();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(640);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const readWidth = () => {
      if (el.clientWidth > 0) setContainerWidth(el.clientWidth);
    };
    readWidth();
    const ro = new ResizeObserver(readWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => computeBlogRadialLayout(containerWidth), [containerWidth]);

  // Lifted so connection checks resolve well before a wedge is clicked.
  const wp = useWordPressConnection();
  const wix = useWixConnection();
  const gsc = useGSCBrainstorm();
  const { metrics, summary, loading: metricsLoading } = useBlogWorkflowMetrics();

  const wpConnected = wp.connected && wp.sites.length > 0;
  const wixConnected = wix.connected && wix.sites.length > 0;
  const publishConnected = wpConnected || wixConnected;

  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);

  const goToPhaseOrStart = useCallback(
    (phase: string) => {
      if (navigateToPhase) {
        navigateToPhase(phase);
      } else {
        onStartWriting();
      }
    },
    [navigateToPhase, onStartWriting],
  );

  const handleResumeDraft = useCallback(() => {
    const draft = summary?.most_recent_draft;
    if (draft && onRestoreAsset) {
      onRestoreAsset(draft.asset_id);
      goToPhaseOrStart(draft.phase);
    } else {
      goToPhaseOrStart(hasResearch ? "outline" : "research");
    }
  }, [summary, onRestoreAsset, goToPhaseOrStart, hasResearch]);

  const handleCardAction = useCallback(
    (cardId: BlogWorkflowCardId) => {
      switch (cardId) {
        case "plan":
          goToPhaseOrStart("research");
          break;
        case "create":
          handleResumeDraft();
          break;
        case "publish":
          goToPhaseOrStart(hasResearch ? "publish" : "research");
          break;
        case "analysis":
          goToPhaseOrStart(hasResearch ? "seo" : "research");
          break;
        case "engagement":
          setShowPerformanceModal(true);
          break;
        case "remarket":
          setShowRefreshModal(true);
          break;
        default:
          break;
      }
    },
    [goToPhaseOrStart, handleResumeDraft, hasResearch],
  );

  const handleRefreshPost = useCallback(
    (assetId: number) => {
      if (onRestoreAsset) {
        onRestoreAsset(assetId);
      }
      // After restoring a published post, jump straight into the content editor
      // so the user can refresh it (same UX as "Continue draft" from the Create wedge).
      goToPhaseOrStart("content");
      setShowRefreshModal(false);
    },
    [onRestoreAsset, goToPhaseOrStart],
  );

  const Wrapper = inline ? "div" : "section";

  const heading = (
    <div
      className={!inline ? "blog-workflow-hero-heading" : undefined}
      style={
        inline
          ? {
              textAlign: "center",
              maxWidth: 480,
              margin: "0 0 12px",
            }
          : undefined
      }
    >
      <h2
        style={
          inline
            ? {
                fontSize: "1.25rem",
                fontWeight: 700,
                margin: "0 0 4px",
                background: "linear-gradient(135deg, #1976d2 0%, #9c27b0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }
            : undefined
        }
      >
        Your Blog, at a Glance
      </h2>
      <p
        style={
          inline
            ? {
                margin: 0,
                fontSize: "0.8rem",
                color: "#64748b",
                lineHeight: 1.4,
              }
            : undefined
        }
      >
        Six steps, one view — track research, drafts, SEO score, publishing, search visibility,
        and refresh opportunities as you grow your thought leadership.
      </p>
    </div>
  );

  return (
    <Wrapper
      className={!inline ? "blog-workflow-hero-section" : undefined}
      style={
        inline
          ? {
              flex: "1 1 320px",
              minWidth: "320px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }
          : undefined
      }
      aria-label="Blog Writer workflow overview"
    >
      {heading}

      <div className="blog-workflow-hero-canvas" ref={canvasRef}>
        {isDesktop ? (
          <>
            <BlogRadialWorkflow
              layout={layout}
              onCardAction={handleCardAction}
              connected={publishConnected}
              metrics={metrics}
            />
            <div
              className="blog-workflow-hero-hub"
              style={{ width: layout.hubVisualR * 2 }}
            >
              <BlogWriterProfileHub
                hubSize={layout.hubVisualR * 2}
                onStartWriting={onStartWriting}
                wpConnected={wpConnected}
                wpSiteLabel={wpConnected ? (wp.sites[0].site_name || wp.sites[0].site_url) : null}
                wixConnected={wixConnected}
                wixSiteLabel={wixConnected ? wix.sites[0].blog_url : null}
                isLoading={wp.isLoading || wix.isLoading}
              />
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <BlogWriterProfileHub
              hubSize={180}
              onStartWriting={onStartWriting}
              wpConnected={wpConnected}
              wpSiteLabel={wpConnected ? (wp.sites[0].site_name || wp.sites[0].site_url) : null}
              wixConnected={wixConnected}
              wixSiteLabel={wixConnected ? wix.sites[0].blog_url : null}
              isLoading={wp.isLoading || wix.isLoading}
            />
            <BlogMobileWorkflowGrid
              onCardAction={handleCardAction}
              connected={publishConnected}
              metrics={metrics}
            />
          </div>
        )}
      </div>

      <BlogPerformanceModal
        open={showPerformanceModal}
        onClose={() => setShowPerformanceModal(false)}
        gsc={gsc}
      />

      <BlogRefreshCandidatesModal
        open={showRefreshModal}
        onClose={() => setShowRefreshModal(false)}
        candidates={summary?.refresh_candidates ?? []}
        loading={metricsLoading}
        onRefreshPost={handleRefreshPost}
      />
    </Wrapper>
  );
};
