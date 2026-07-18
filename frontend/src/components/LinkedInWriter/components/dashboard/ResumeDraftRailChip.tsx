import React, { useState, useCallback } from 'react';
import { DashboardRailIconButton } from './DashboardRailIconButton';
import { DashboardActionModal } from './DashboardActionModal';
import { useMobileHeaderNav } from '../../hooks/useMobileHeaderNav';
import { STUDIO_TAB_ACTION_MODAL_CLASS } from './dashboardLayoutConstants';

interface ResumeDraftRailChipProps {
  draft: string;
  onResumeDraft?: () => void;
  onClear?: () => void;
  /** main = dashboard toolbar; tab = mobile header tab bar */
  variant?: 'main' | 'tab';
}

export const ResumeDraftRailChip: React.FC<ResumeDraftRailChipProps> = ({
  draft,
  onResumeDraft,
  onClear,
  variant = 'main',
}) => {
  const [open, setOpen] = useState(false);
  const isMobileHeaderNav = useMobileHeaderNav();
  const isTab = variant === 'tab';
  const useCenteredModal = isTab && isMobileHeaderNav;

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
        label={isTab ? 'Resume Work' : 'Resume Draft'}
        stackedLabel={isTab ? (['Resume', 'Work'] as const) : undefined}
        icon="resume"
        alwaysShowLabel
        iconLeading={!isTab}
        layout={isTab ? 'tab' : 'pill'}
        showBadge
        onClick={() => setOpen(true)}
        title="Resume your saved draft"
        ariaExpanded={open}
        open={open}
      />

      <DashboardActionModal
        open={open}
        title={isTab ? 'Resume Work' : 'Resume Draft'}
        onClose={handleClose}
        maxWidth={420}
        maxHeight="min(85dvh, 360px)"
        modalClassName={useCenteredModal ? STUDIO_TAB_ACTION_MODAL_CLASS : undefined}
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
