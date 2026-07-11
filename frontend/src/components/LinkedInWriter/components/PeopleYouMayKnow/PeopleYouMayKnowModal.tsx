import React from 'react';
import ComponentErrorBoundary from '../../../../components/shared/ComponentErrorBoundary';
import { DashboardActionModal } from '../dashboard/DashboardActionModal';
import { PYMK_MODAL_SIZE } from '../dashboard/pymkModalLayout';
import { PeopleYouMayKnowPanel } from './PeopleYouMayKnowPanel';

interface PeopleYouMayKnowModalProps {
  open: boolean;
  onClose: () => void;
}

export const PeopleYouMayKnowModal: React.FC<PeopleYouMayKnowModalProps> = ({ open, onClose }) => (
  <DashboardActionModal
    open={open}
    title="People You May Know"
    onClose={onClose}
    width={PYMK_MODAL_SIZE.width}
    maxWidth={PYMK_MODAL_SIZE.maxWidth}
    height={PYMK_MODAL_SIZE.height}
    maxHeight={PYMK_MODAL_SIZE.maxHeight}
  >
    <ComponentErrorBoundary componentName="PeopleYouMayKnowPanel">
      <PeopleYouMayKnowPanel />
    </ComponentErrorBoundary>
  </DashboardActionModal>
);
