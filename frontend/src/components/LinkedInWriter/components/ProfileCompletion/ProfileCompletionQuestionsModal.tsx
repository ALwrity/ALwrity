/**
 * Landing-page profile questionnaire as a real modal overlay (#169).
 * Reuses DashboardActionModal (same 60vw pattern as Comment Assistant)
 * so the form no longer sits inside the hero hub over the avatar/ring.
 */
import React, { useEffect, useState } from "react";

import type { LinkedInCompletionQuestion } from "../../../../api/linkedinSocial";
import { DashboardActionModal } from "../dashboard/DashboardActionModal";
import { ProfileCompletionForm } from "./ProfileCompletionForm";

const MODAL_TITLE = "Help us understand you better.";

export interface ProfileCompletionQuestionsModalProps {
  questions: LinkedInCompletionQuestion[];
  onSubmit: (answers: Record<string, string | string[]>) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
}

export const ProfileCompletionQuestionsModal: React.FC<
  ProfileCompletionQuestionsModalProps
> = ({ questions, onSubmit, isSubmitting = false, error = null }) => {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // New question set (e.g. after reconnect) → show the modal again.
    if (questions.length > 0) {
      setOpen(true);
    }
  }, [questions]);

  if (questions.length === 0) {
    return null;
  }

  return (
    <>
      <DashboardActionModal
        open={open}
        title={MODAL_TITLE}
        onClose={() => setOpen(false)}
        width="60vw"
        maxWidth="60vw"
        maxHeight="80vh"
        titleSize="lg"
        elevated
      >
        <ProfileCompletionForm
          variant="plain"
          questions={questions}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          error={error}
        />
      </DashboardActionModal>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open profile questions"
          style={{
            marginTop: 10,
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid rgba(10, 102, 194, 0.35)",
            background: "rgba(255, 255, 255, 0.92)",
            color: "#0A66C2",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
            whiteSpace: "nowrap",
          }}
        >
          Complete profile questions
        </button>
      )}
    </>
  );
};
