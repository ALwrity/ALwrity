import React, { useCallback } from 'react';
import Joyride, { CallBackProps, STATUS } from 'react-joyride';
import {
  linkedInStudioTourSteps,
  LINKEDIN_STUDIO_TOUR_SEEN_KEY,
} from '../../../../utils/walkthroughs/linkedInStudioTourSteps';

interface LinkedInStudioTourProps {
  run: boolean;
  onRunChange: (run: boolean) => void;
}

const JOYRIDE_STYLES = {
  options: {
    primaryColor: '#0a66c2',
    textColor: '#1e293b',
    backgroundColor: '#ffffff',
    overlayColor: 'rgba(15, 23, 42, 0.55)',
    zIndex: 13000,
    arrowColor: '#ffffff',
    width: 300,
  },
  tooltip: {
    borderRadius: 12,
    padding: '14px 16px',
    boxShadow: '0 16px 48px rgba(10, 102, 194, 0.18)',
    maxWidth: 300,
  },
  tooltipTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
  },
  tooltipContent: {
    fontSize: 13,
    lineHeight: 1.5,
    padding: '2px 0 0',
  },
  buttonNext: {
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    padding: '7px 12px',
  },
  buttonBack: {
    color: '#64748b',
    fontSize: 13,
    marginRight: 8,
  },
  buttonSkip: {
    color: '#64748b',
    fontSize: 12,
  },
  spotlight: {
    borderRadius: 12,
  },
} as const;

export const LinkedInStudioTour: React.FC<LinkedInStudioTourProps> = ({ run, onRunChange }) => {
  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status } = data;
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        localStorage.setItem(LINKEDIN_STUDIO_TOUR_SEEN_KEY, 'true');
        onRunChange(false);
      }
    },
    [onRunChange]
  );

  return (
    <Joyride
      steps={linkedInStudioTourSteps}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep={false}
      disableScrolling
      spotlightPadding={8}
      spotlightClicks={false}
      disableOverlayClose
      floaterProps={{
        options: {
          preventOverflow: {
            boundariesElement: 'viewport',
            padding: 12,
          },
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        skip: 'Skip tour',
      }}
      styles={JOYRIDE_STYLES}
      callback={handleCallback}
    />
  );
};
