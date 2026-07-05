import React from 'react';
import ComponentErrorBoundary from '../../../../components/shared/ComponentErrorBoundary';
import { PeopleYouMayKnowPanel } from './PeopleYouMayKnowPanel';

export const PeopleYouMayKnowTabPanel: React.FC = () => (
  <div
    style={{
      flex: 1,
      overflow: 'auto',
      padding: '24px 32px',
      maxWidth: 1100,
      margin: '0 auto',
      width: '100%',
    }}
  >
    <ComponentErrorBoundary componentName="PeopleYouMayKnowPanel">
      <PeopleYouMayKnowPanel />
    </ComponentErrorBoundary>
  </div>
);
