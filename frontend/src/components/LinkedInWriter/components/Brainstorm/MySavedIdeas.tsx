/**
 * My Saved Ideas — saved brainstorm library (Plan wedge drill-down + Create stack).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "../../../../api/client";
import { DashboardActionModal } from "../dashboard/DashboardActionModal";
import { StudioModalCloseButton } from "../dashboard/StudioModalCloseButton";
import {
  WEDGE_BACK_LABELS,
  wedgeSubModalClassName,
  wedgeSubModalShellProps,
} from "../dashboard/wedgeModalUi";
import type { QuickCreateReturnTarget } from "../dashboard/workflowWedgeNavigation";
import {
  CREATE_WEDGE_NESTED_BACKDROP,
  CREATE_WEDGE_NESTED_MODAL_SIZE,
  nestedModalZIndex,
} from "../../utils/createWedgeNestedModalLayout";
import { MySavedIdeasBody } from "./MySavedIdeasBody";

export interface SavedBrainstormIdea {
  id: string;
  prompt: string;
  rationale?: string | null;
  tags?: string;
  source_seed?: string | null;
  created_at: string;
  updated_at: string;
}

interface MySavedIdeasProps {
  open: boolean;
  onClose: () => void;
  onAfterDelete?: () => void;
  onUseInCopilot?: (prompt: string) => void;
  /** Return to parent wedge (e.g. Plan grid). */
  onBack?: () => void;
  backLabel?: string;
  /** Passed to Quick Create when user taps Create Post from a saved idea. */
  quickCreateReturnTo?: QuickCreateReturnTarget;
  /** Stack above Quick Create — keeps legacy nested layout. */
  stacked?: boolean;
}

const DEFAULT_PANEL_STYLE: React.CSSProperties = {
  background: "#ffffff",
  width: 720,
  maxWidth: "100%",
  maxHeight: "80vh",
  borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const STACKED_PANEL_STYLE: React.CSSProperties = {
  background: "#ffffff",
  width: CREATE_WEDGE_NESTED_MODAL_SIZE.width,
  maxWidth: CREATE_WEDGE_NESTED_MODAL_SIZE.maxWidth,
  height: CREATE_WEDGE_NESTED_MODAL_SIZE.height,
  maxHeight: CREATE_WEDGE_NESTED_MODAL_SIZE.maxHeight,
  borderRadius: CREATE_WEDGE_NESTED_MODAL_SIZE.borderRadius,
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const LEGACY_HEADER_STYLE: React.CSSProperties = {
  padding: "14px 18px",
  background: "#0a66c2",
  color: "#ffffff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

async function loadSavedIdeas(): Promise<{
  ideas: SavedBrainstormIdea[];
  total: number;
}> {
  const res = await apiClient.get("/api/brainstorm/saved-ideas", {
    params: { limit: 100, offset: 0 },
  });
  return {
    ideas: Array.isArray(res.data?.ideas) ? res.data.ideas : [],
    total: Number(res.data?.total) || 0,
  };
}

async function deleteSavedIdea(id: string): Promise<void> {
  await apiClient.delete(
    `/api/brainstorm/saved-ideas/${encodeURIComponent(id)}`,
  );
}

function formatRelative(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const MySavedIdeas: React.FC<MySavedIdeasProps> = ({
  open,
  onClose,
  onAfterDelete,
  onUseInCopilot,
  onBack,
  backLabel = WEDGE_BACK_LABELS.plan,
  quickCreateReturnTo,
  stacked = false,
}) => {
  const useWedgeShell = Boolean(onBack && !stacked);
  const [ideas, setIdeas] = useState<SavedBrainstormIdea[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const panelStyle = useMemo(
    () => (stacked ? STACKED_PANEL_STYLE : DEFAULT_PANEL_STYLE),
    [stacked],
  );
  const backdropStyle = useMemo(
    () => ({
      position: "fixed" as const,
      inset: 0,
      background: stacked
        ? CREATE_WEDGE_NESTED_BACKDROP.background
        : "rgba(0, 0, 0, 0.4)",
      backdropFilter: stacked ? CREATE_WEDGE_NESTED_BACKDROP.backdropFilter : undefined,
      WebkitBackdropFilter: stacked
        ? CREATE_WEDGE_NESTED_BACKDROP.WebkitBackdropFilter
        : undefined,
      display: "flex" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      zIndex: nestedModalZIndex(stacked),
      padding: stacked
        ? CREATE_WEDGE_NESTED_MODAL_SIZE.backdropPadding
        : 20,
    }),
    [stacked],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadSavedIdeas();
      setIdeas(result.ideas);
      setTotal(result.total);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Failed to load saved ideas",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const handleCopy = useCallback(async (idea: SavedBrainstormIdea) => {
    try {
      await navigator.clipboard.writeText(idea.prompt);
      setCopiedId(idea.id);
      window.setTimeout(
        () => setCopiedId((prev) => (prev === idea.id ? null : prev)),
        1800,
      );
    } catch (e) {
      console.error("Copy failed", e);
    }
  }, []);

  const handleDelete = useCallback(
    async (idea: SavedBrainstormIdea) => {
      const ok = window.confirm(
        `Delete this saved idea?\n\n"${idea.prompt.slice(0, 80)}${idea.prompt.length > 80 ? "..." : ""}"`,
      );
      if (!ok) return;
      setDeletingId(idea.id);
      try {
        await deleteSavedIdea(idea.id);
        await refresh();
        onAfterDelete?.();
      } catch (e: any) {
        setError(
          e?.response?.data?.detail || e?.message || "Failed to delete idea",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [refresh, onAfterDelete],
  );

  const body = (
    <MySavedIdeasBody
      ideas={ideas}
      loading={loading}
      error={error}
      copiedId={copiedId}
      deletingId={deletingId}
      onUseInCopilot={onUseInCopilot}
      onClose={onClose}
      onCopy={handleCopy}
      onDelete={handleDelete}
      quickCreateReturnTo={quickCreateReturnTo}
      formatRelative={formatRelative}
    />
  );

  const countLabel = loading
    ? "Loading…"
    : `${total} saved idea${total === 1 ? "" : "s"}`;

  if (!open) return null;

  if (useWedgeShell) {
    return (
      <DashboardActionModal
        open={open}
        title="My Saved Ideas"
        onClose={onClose}
        onBack={onBack}
        {...wedgeSubModalShellProps(backLabel)}
        modalClassName={wedgeSubModalClassName("linkedin-plan-saved-ideas-modal")}
        maxWidth={720}
        maxHeight="min(90vh, 720px)"
      >
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 13,
            color: "#64748b",
            lineHeight: 1.45,
          }}
        >
          {countLabel} — copy, create a post, or open in Co-Pilot.
        </p>
        {body}
      </DashboardActionModal>
    );
  }

  return createPortal(
    <div style={backdropStyle} onClick={onClose}>
      <div
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="My Saved Brainstorm Ideas"
      >
        <div style={LEGACY_HEADER_STYLE}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>
              📚 My Saved Ideas
            </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>{countLabel}</div>
          </div>
          <StudioModalCloseButton
            onClick={onClose}
            ariaLabel="Close saved ideas"
            variant="dark"
          />
        </div>
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 18,
            background: "#f8fafc",
          }}
        >
          {body}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MySavedIdeas;
