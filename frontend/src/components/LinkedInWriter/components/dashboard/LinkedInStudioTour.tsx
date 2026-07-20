import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Joyride, { ACTIONS, CallBackProps, EVENTS, STATUS } from 'react-joyride';
import {
  ALWRITY_JOYRIDE_LOCALE,
  cleanupJoyrideOverlay,
  focusJoyrideTooltip,
  getAlwrityJoyrideStyles,
  getTourViewportVariant,
  isTourCompactViewport,
  markTourFinished,
  markTourSkipped,
} from '../../../../utils/walkthroughs/alwrityJoyrideTheme';
import { LI_Z_TOUR } from '../../utils/linkedInStudioZIndex';
import {
  LINKEDIN_STUDIO_TOUR_SEEN_KEY,
  buildLinkedInStudioTourSteps,
} from '../../../../utils/walkthroughs/linkedInStudioTourSteps';
import {
  MOBILE_STUDIO_MAX_WIDTH_PX,
  TOUR_PHONE_MAX_WIDTH_PX,
} from './dashboardLayoutConstants';

interface LinkedInStudioTourProps {
  run: boolean;
  onRunChange: (run: boolean) => void;
  storageKey?: string;
  connected?: boolean;
}

function scrollTourTargetIntoView(target: string | HTMLElement | undefined) {
  if (!target || typeof target !== 'string') return;
  const el = document.querySelector(target);
  el?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
}

export const LinkedInStudioTour: React.FC<LinkedInStudioTourProps> = ({
  run,
  onRunChange,
  storageKey,
  connected = false,
}) => {
  const key = storageKey ?? LINKEDIN_STUDIO_TOUR_SEEN_KEY;
  const [tourVariant, setTourVariant] = useState(getTourViewportVariant);
  const [compactViewport, setCompactViewport] = useState(isTourCompactViewport);
  const [tourInstance, setTourInstance] = useState(0);

  const stopTour = useCallback(
    (markSeen: 'finished' | 'skipped' | null) => {
      if (markSeen === 'finished') {
        markTourFinished(key);
      } else if (markSeen === 'skipped') {
        markTourSkipped(key);
      }
      onRunChange(false);
      cleanupJoyrideOverlay();
      setTourInstance((current) => current + 1);
    },
    [key, onRunChange],
  );

  useEffect(() => {
    if (!run) {
      cleanupJoyrideOverlay();
    }
  }, [run]);

  useEffect(() => {
    const mobileMq = window.matchMedia(`(max-width: ${TOUR_PHONE_MAX_WIDTH_PX}px)`);
    const tabletMq = window.matchMedia(`(max-width: ${MOBILE_STUDIO_MAX_WIDTH_PX}px)`);
    const sync = () => {
      setTourVariant(getTourViewportVariant());
      setCompactViewport(tabletMq.matches);
    };
    sync();
    mobileMq.addEventListener('change', sync);
    tabletMq.addEventListener('change', sync);
    return () => {
      mobileMq.removeEventListener('change', sync);
      tabletMq.removeEventListener('change', sync);
    };
  }, []);

  const steps = useMemo(
    () => buildLinkedInStudioTourSteps({ connected, variant: tourVariant }),
    [connected, tourVariant],
  );

  const joyrideStyles = useMemo(
    () => getAlwrityJoyrideStyles(tourVariant, { primaryColor: '#0a66c2', zIndex: LI_Z_TOUR }),
    [tourVariant],
  );

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, action, step } = data;

      if (action === ACTIONS.CLOSE) {
        stopTour('skipped');
        return;
      }

      if (compactViewport && type === EVENTS.STEP_BEFORE && action !== ACTIONS.SKIP) {
        scrollTourTargetIntoView(step.target);
      }

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TOOLTIP) {
        focusJoyrideTooltip();
      }

      if (status === STATUS.FINISHED) {
        stopTour('finished');
      } else if (status === STATUS.SKIPPED) {
        stopTour('skipped');
      }
    },
    [compactViewport, stopTour],
  );

  return (
    <Joyride
      key={`${tourInstance}-${tourVariant}-${connected ? 'linked' : 'guest'}`}
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep={compactViewport}
      disableScrolling={!compactViewport}
      disableCloseOnEsc={false}
      spotlightPadding={8}
      spotlightClicks={false}
      disableOverlayClose
      floaterProps={{
        options: {
          preventOverflow: {
            boundariesElement: 'viewport',
            padding: compactViewport ? 16 : 12,
          },
        },
      }}
      locale={ALWRITY_JOYRIDE_LOCALE}
      styles={joyrideStyles}
      callback={handleCallback}
    />
  );
};
