import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WizardStepper } from '../WizardStepper';
import { OnboardingResumeToast } from '../OnboardingResumeToast';

const steps = [
  { label: 'Connect Platforms', description: 'Connect', icon: '🌐' },
  { label: 'Research', description: 'Research', icon: '🔍' },
  { label: 'Personalization', description: 'Personalize', icon: '⚙️' },
  { label: 'Finish', description: 'Finish', icon: '✅' },
];

describe('WizardStepper resume toast placement', () => {
  it('renders resume toast below the progress ring on the right', () => {
    render(
      <WizardStepper
        activeStep={0}
        completedFrontier={0}
        furthestAccessibleStep={1}
        isMobile={false}
        steps={steps}
        onStepClick={vi.fn()}
        progress={50}
        resumeToast="Welcome back! You're 50% through setup — continue at Personalization."
        onDismissResumeToast={vi.fn()}
      />
    );

    const anchor = screen.getByTestId('wizard-resume-toast-anchor');
    expect(anchor).toBeInTheDocument();
    expect(anchor).toHaveAttribute('data-placement', 'below-progress-ring-right');
    expect(screen.getByTestId('onboarding-resume-toast')).toHaveTextContent(
      /Welcome back/i
    );
  });

  it('does not render resume toast anchor when message is absent', () => {
    render(
      <WizardStepper
        activeStep={0}
        completedFrontier={0}
        furthestAccessibleStep={0}
        isMobile={false}
        steps={steps}
        onStepClick={vi.fn()}
        progress={0}
        resumeToast={null}
        onDismissResumeToast={vi.fn()}
      />
    );

    expect(screen.queryByTestId('wizard-resume-toast-anchor')).not.toBeInTheDocument();
  });
});

describe('OnboardingResumeToast', () => {
  it('uses a compact white background sized to content', () => {
    render(
      <OnboardingResumeToast
        message="Welcome back! You're 50% through setup — continue at Personalization."
        onDismiss={vi.fn()}
      />
    );

    const toast = screen.getByTestId('onboarding-resume-toast');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveTextContent(/Welcome back/i);
  });
});
