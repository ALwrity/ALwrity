/**
 * Performance Pulse — Remarket wedge (performance snapshot + action CTAs).
 */
import React, { useEffect, useState } from "react";
import { DashboardActionModal } from "../DashboardActionModal";
import { colors } from "../../GrowthEngine/styles";
import {
  EngagementConnectPrompt,
  EngagementEmptyPrompt,
  EngagementErrorBanner,
  EngagementLoadingRow,
  EngagementRefreshBar,
} from "../engagementWedgeSharedUi";
import { PerformancePulseEmptyFilter } from "./PerformancePulseEmptyFilter";
import { PerformancePulseFilterTabs } from "./PerformancePulseFilterTabs";
import { getTopSectionLabel } from "./performancePulseFilterConfig";
import { PerformancePulseItemRow } from "./PerformancePulseItemRow";
import { PerformancePulseSectionHeader } from "./PerformancePulseSectionHeader";
import { usePerformancePulseActions } from "./usePerformancePulseActions";
import { usePerformancePulseData } from "./usePerformancePulseData";
import { usePerformancePulseView } from "./usePerformancePulseView";
import type { PerformancePulseFilter } from "./types";
import {
  WEDGE_BACK_LABELS,
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
} from "../wedgeModalUi";

export interface PerformancePulseModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  connected?: boolean;
}

export const PerformancePulseModal: React.FC<PerformancePulseModalProps> = ({
  open,
  onClose,
  onBack,
  connected = true,
}) => {
  const [activeFilter, setActiveFilter] = useState<PerformancePulseFilter>("all");

  const { posts, loading, error, loadedAt, fetchPosts } =
    usePerformancePulseData(open);

  const { counts, topItems, bottomItem, hasItemsForFilter } =
    usePerformancePulseView(posts, activeFilter);

  const {
    boostingId,
    boosted,
    actionError,
    resetActions,
    openItemInQuickCreate,
    openItemTransformTo,
    boostItem,
    acceptBoostInStudio,
  } = usePerformancePulseActions({ onClose });

  useEffect(() => {
    if (!open) return;
    setActiveFilter("all");
    resetActions();
  }, [open, resetActions]);

  const showResults =
    !loading && posts.length > 0 && hasItemsForFilter && topItems.length > 0;

  const showEmptyFilter =
    !loading && posts.length > 0 && !hasItemsForFilter;

  return (
    <DashboardActionModal
      open={open}
      title="Performance Pulse"
      onClose={onClose}
      onBack={onBack}
      {...wedgePostSizeSubModalProps(WEDGE_BACK_LABELS.remarket)}
      modalClassName={wedgePostSizeModalClassName()}
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        Real engagement metrics from your recent LinkedIn content — posts,
        articles, carousels, and videos. Repurpose winners and boost
        underperformers.
      </p>

      {loading && (
        <EngagementLoadingRow message="Loading your content metrics from LinkedIn…" />
      )}
      {error && !actionError && <EngagementErrorBanner msg={error} />}
      {actionError && <EngagementErrorBanner msg={actionError} />}

      {!loading && posts.length === 0 && !connected && !error && (
        <EngagementConnectPrompt message="Connect your LinkedIn account to view engagement metrics for your published content." />
      )}

      {!loading && posts.length === 0 && connected && !error && (
        <EngagementEmptyPrompt
          icon="📊"
          title="No content loaded yet"
          desc="Load your recent LinkedIn posts to see engagement metrics."
          btnLabel="🚀 Load Posts"
          onLoad={() => void fetchPosts(false)}
        />
      )}

      {!loading && posts.length > 0 && (
        <>
          {loadedAt && (
            <EngagementRefreshBar
              cachedAt={loadedAt}
              onRefresh={() => void fetchPosts(true)}
              loading={loading}
            />
          )}

          <PerformancePulseFilterTabs
            activeFilter={activeFilter}
            counts={counts}
            onChange={setActiveFilter}
          />
        </>
      )}

      {showEmptyFilter && (
        <PerformancePulseEmptyFilter
          filter={activeFilter}
          onShowAll={() => setActiveFilter("all")}
        />
      )}

      {showResults && (
        <>
          <PerformancePulseSectionHeader
            icon="🏆"
            label={getTopSectionLabel(activeFilter)}
          />
          {topItems.map((item) => (
            <PerformancePulseItemRow
              key={item.post.id}
              item={item}
              boostedVersion={boosted[item.post.id]?.text}
              isBoosting={boostingId === item.post.id}
              onRepurpose={() => openItemInQuickCreate(item, "repurpose")}
              onWriteMore={() => openItemInQuickCreate(item, "write_more")}
              onBoost={() => void boostItem(item)}
              onAcceptBoost={() => acceptBoostInStudio(item)}
              onTransform={(targetType) =>
                openItemTransformTo(item, targetType)
              }
            />
          ))}

          {bottomItem && (
            <>
              <PerformancePulseSectionHeader
                icon="⬇️"
                label="Needs a Boost"
              />
              <PerformancePulseItemRow
                item={bottomItem}
                boostedVersion={boosted[bottomItem.post.id]?.text}
                isBoosting={boostingId === bottomItem.post.id}
                onRepurpose={() =>
                  openItemInQuickCreate(bottomItem, "repurpose")
                }
                onWriteMore={() =>
                  openItemInQuickCreate(bottomItem, "write_more")
                }
                onBoost={() => void boostItem(bottomItem)}
                onAcceptBoost={() => acceptBoostInStudio(bottomItem)}
                onTransform={(targetType) =>
                  openItemTransformTo(bottomItem, targetType)
                }
                dim
              />
            </>
          )}
        </>
      )}
    </DashboardActionModal>
  );
};
