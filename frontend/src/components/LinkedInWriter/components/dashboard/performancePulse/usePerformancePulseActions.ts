/**
 * Performance Pulse item actions — Quick Create routing and boost (Phases 2–4).
 */
import { useCallback, useState } from "react";
import type { LinkedInDraftContentType } from "../../../utils/linkedInDraftLibraryUtils";
import { pushDraftToStudio } from "../engagementWedgeDraftUtils";
import { REMARKET_RETURN } from "../remarketWedgeNavigation";
import { boostPerformanceContent } from "./boostPerformanceContent";
import { isPerformancePulseTransformLocked } from "./performancePulseTransformFormats";
import { openPerformanceContentInQuickCreate } from "./openPerformanceContentInQuickCreate";
import type { PerformancePulseCreateMode } from "./payload";
import type {
  PerformanceContentType,
  PerformancePulseItem,
} from "./types";

export interface BoostedDraft {
  text: string;
  contentType: LinkedInDraftContentType;
}

export interface UsePerformancePulseActionsOptions {
  onClose: () => void;
}

export interface UsePerformancePulseActionsResult {
  boostingId: string | null;
  boosted: Record<string, BoostedDraft>;
  actionError: string;
  clearActionError: () => void;
  resetActions: () => void;
  openItemInQuickCreate: (
    item: PerformancePulseItem,
    mode: PerformancePulseCreateMode,
  ) => void;
  openItemTransformTo: (
    item: PerformancePulseItem,
    targetType: PerformanceContentType,
  ) => void;
  boostItem: (item: PerformancePulseItem) => Promise<void>;
  acceptBoostInStudio: (item: PerformancePulseItem) => void;
}

export function usePerformancePulseActions({
  onClose,
}: UsePerformancePulseActionsOptions): UsePerformancePulseActionsResult {
  const [boostingId, setBoostingId] = useState<string | null>(null);
  const [boosted, setBoosted] = useState<Record<string, BoostedDraft>>({});
  const [actionError, setActionError] = useState("");

  const resetActions = useCallback(() => {
    setBoostingId(null);
    setBoosted({});
    setActionError("");
  }, []);

  const clearActionError = useCallback(() => setActionError(""), []);

  const openQuickCreateWithPayload = useCallback(
    (
      item: PerformancePulseItem,
      mode: PerformancePulseCreateMode,
      targetType: PerformanceContentType,
    ) => {
      openPerformanceContentInQuickCreate(
        item.post,
        mode,
        targetType,
        REMARKET_RETURN.pulse,
      );
      onClose();
    },
    [onClose],
  );

  const openItemInQuickCreate = useCallback(
    (item: PerformancePulseItem, mode: PerformancePulseCreateMode) => {
      openQuickCreateWithPayload(item, mode, item.contentType);
    },
    [openQuickCreateWithPayload],
  );

  const openItemTransformTo = useCallback(
    (item: PerformancePulseItem, targetType: PerformanceContentType) => {
      if (isPerformancePulseTransformLocked(targetType)) return;
      openQuickCreateWithPayload(item, "repurpose", targetType);
    },
    [openQuickCreateWithPayload],
  );

  const boostItem = useCallback(async (item: PerformancePulseItem) => {
    setBoostingId(item.post.id);
    setActionError("");
    const result = await boostPerformanceContent(item.post, item.contentType);
    if (result.success && result.content) {
      setBoosted((prev) => ({
        ...prev,
        [item.post.id]: {
          text: result.content!,
          contentType: item.contentType,
        },
      }));
    } else {
      setActionError(
        result.error ?? "Could not boost this content. Please try again.",
      );
    }
    setBoostingId(null);
  }, []);

  const acceptBoostInStudio = useCallback(
    (item: PerformancePulseItem) => {
      const draft = boosted[item.post.id];
      if (!draft?.text) return;
      pushDraftToStudio(draft.text, draft.contentType);
      onClose();
    },
    [boosted, onClose],
  );

  return {
    boostingId,
    boosted,
    actionError,
    clearActionError,
    resetActions,
    openItemInQuickCreate,
    openItemTransformTo,
    boostItem,
    acceptBoostInStudio,
  };
}
