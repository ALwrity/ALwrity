import React from 'react';
import { OutlineProgressModal } from '../OutlineProgressModal';

interface PollingState {
  isPolling: boolean;
  currentStatus: string;
  progressMessages: { message: string }[];
  error?: string | null;
}

interface TaskProgressModalsProps {
  showOutlineModal: boolean;
  outlinePolling: PollingState;
  showModal: boolean;
  rewritePolling: PollingState;
  mediumPolling: PollingState;
  onCloseOutlineModal?: () => void;
  onCloseContentModal?: () => void;
}

const TaskProgressModals: React.FC<TaskProgressModalsProps> = ({
  showOutlineModal,
  outlinePolling,
  showModal,
  rewritePolling,
  mediumPolling,
  onCloseOutlineModal,
  onCloseContentModal,
}) => {
  return (
    <>
      <OutlineProgressModal
        isVisible={showOutlineModal}
        status={outlinePolling.currentStatus}
        progressMessages={outlinePolling.progressMessages.map(m => m.message)}
        latestMessage={outlinePolling.progressMessages.length > 0 ? outlinePolling.progressMessages[outlinePolling.progressMessages.length - 1].message : ''}
        error={outlinePolling.error ?? null}
        onClose={onCloseOutlineModal}
      />

      <OutlineProgressModal
        isVisible={showModal}
        status={rewritePolling.isPolling ? rewritePolling.currentStatus : mediumPolling.currentStatus}
        progressMessages={rewritePolling.isPolling ? rewritePolling.progressMessages.map(m => m.message) : mediumPolling.progressMessages.map(m => m.message)}
        latestMessage={rewritePolling.isPolling ? (
          rewritePolling.progressMessages.length > 0 ? rewritePolling.progressMessages[rewritePolling.progressMessages.length - 1].message : ''
        ) : (
          mediumPolling.progressMessages.length > 0 ? mediumPolling.progressMessages[mediumPolling.progressMessages.length - 1].message : ''
        )}
        error={(rewritePolling.isPolling ? rewritePolling.error : mediumPolling.error) ?? null}
        titleOverride={rewritePolling.isPolling ? '🔄 Rewriting Your Blog' : '📝 Generating Your Blog Content'}
        onClose={onCloseContentModal}
      />
    </>
  );
};

export default TaskProgressModals;
