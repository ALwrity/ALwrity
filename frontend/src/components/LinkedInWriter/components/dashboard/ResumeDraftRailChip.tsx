import React, { useState, useCallback } from 'react';
import { DashboardRailIconButton } from './DashboardRailIconButton';
import { DashboardActionModal } from './DashboardActionModal';

interface ResumeDraftRailChipProps {
  draft: string;
  onResumeDraft?: () => void;
  onClear?: () => void;
}

export const ResumeDraftRailChip: React.FC<ResumeDraftRailChipProps> = ({
  draft,
  onResumeDraft,
  onClear,
}) => {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleContinue = useCallback(() => {
    setOpen(false);
    onResumeDraft?.();
  }, [onResumeDraft]);

  const handleDiscard = useCallback(() => {
    setOpen(false);
    onClear?.();
  }, [onClear]);

  if (!draft) return null;

  const preview =
    draft
      .split('\n')[0]
      .replace(/^#\s*/, '')
      .substring(0, 120) || 'Untitled draft';

  return (
    <>
      <DashboardRailIconButton
        label="Resume"
        icon="resume"
        alwaysShowLabel
        iconLeading
        onClick={() => setOpen(true)}
        title="Resume your saved draft"
        ariaExpanded={open}
        open={open}
      />

      <DashboardActionModal
        open={open}
        title="Resume Draft"
        onClose={handleClose}
        maxWidth={420}
        maxHeight="min(90vh, 360px)"
      >
        <p className="linkedin-resume-modal-lead">
          Pick up where you left off with your saved LinkedIn draft.
        </p>
        <div className="linkedin-resume-modal-preview">{preview}</div>
        <div className="linkedin-resume-modal-actions">
          <button type="button" className="linkedin-resume-modal-btn linkedin-resume-modal-btn--primary" onClick={handleContinue}>
            Continue editing →
          </button>
          <button type="button" className="linkedin-resume-modal-btn linkedin-resume-modal-btn--secondary" onClick={handleDiscard}>
            Discard
          </button>
        </div>
      </DashboardActionModal>
    </>
  );
};
