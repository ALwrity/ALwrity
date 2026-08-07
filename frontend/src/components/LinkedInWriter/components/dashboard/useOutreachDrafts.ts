import { useCallback, useEffect, useState } from "react";
import {
  draftConnectionOutreach,
  type OutreachDraftInput,
} from "./networkOutreachDraft";

export function useOutreachDrafts(active = true) {
  const [draftingKey, setDraftingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftError, setDraftError] = useState("");

  useEffect(() => {
    if (active) {
      setDrafts({});
      setDraftError("");
      setDraftingKey(null);
    }
  }, [active]);

  const draftForKey = useCallback(
    async (key: string, input: OutreachDraftInput) => {
      setDraftingKey(key);
      setDraftError("");
      try {
        const note = await draftConnectionOutreach(input);
        setDrafts((prev) => ({ ...prev, [key]: note }));
      } catch {
        setDrafts((prev) => ({ ...prev, [key]: input.fallbackNote }));
        setDraftError("AI refinement failed, using suggested note.");
      } finally {
        setDraftingKey(null);
      }
    },
    [],
  );

  return {
    drafts,
    draftingKey,
    draftError,
    draftForKey,
  };
}
