import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WizardStepContent, type WizardStepContentProps } from '../WizardStepContent';

const websiteStepSpy = vi.fn();

vi.mock('../../WebsiteStep', () => ({
  default: (props: Record<string, unknown>) => {
    websiteStepSpy(props);
    return <div data-testid="mock-website-step" />;
  },
}));

vi.mock('../../LinkedInConnectStep', () => ({
  default: () => <div data-testid="mock-linkedin-connect" />,
}));

vi.mock('../../CompetitorAnalysisStep', () => ({
  default: () => <div data-testid="mock-competitor-step" />,
}));

vi.mock('../../LinkedInResearchStep', () => ({
  default: () => <div data-testid="mock-linkedin-research" />,
}));

vi.mock('../../PersonalizationStep', () => ({
  default: () => <div data-testid="mock-personalization-step" />,
}));

vi.mock('../../FinalStep', () => ({
  default: () => <div data-testid="mock-final-step" />,
}));

function buildBaseProps(
  overrides: Partial<WizardStepContentProps> = {}
): WizardStepContentProps {
  return {
    step: 0,
    direction: 'right',
    onboardingType: 'website',
    websiteSessionKey: 'test-session',
    stepData: { website: 'https://brand-a.com' },
    email: 'user@example.com',
    backgroundTasks: null,
    successMessage: null,
    setSuccessMessage: vi.fn(),
    completedFrontier: 0,
    isConnectStepOfficiallyComplete: false,
    personaOnboardingData: {},
    personaStepData: {},
    handleNext: vi.fn(),
    handleBack: vi.fn(),
    handleComplete: vi.fn(),
    handleViewBackgroundResults: vi.fn(),
    updateHeaderContent: vi.fn(),
    onStep0Valid: vi.fn(),
    onStep1Valid: vi.fn(),
    onStep2Valid: vi.fn(),
    handleWebsiteDataReady: vi.fn(),
    handleCompetitorDataReady: vi.fn(),
    handleStepDataChange: vi.fn(),
    backendResearchData: null,
    backendConnectWebsite: 'https://brand-a.com',
    ...overrides,
  };
}

describe('WizardStepContent — connect step completion wiring', () => {
  beforeEach(() => {
    websiteStepSpy.mockClear();
    localStorage.clear();
  });

  it('passes isConnectStepCompleted=true to WebsiteStep when connect step is officially complete', () => {
    render(
      <WizardStepContent
        {...buildBaseProps({ isConnectStepOfficiallyComplete: true, completedFrontier: 0 })}
      />
    );

    expect(screen.getByTestId('mock-website-step')).toBeInTheDocument();
    expect(websiteStepSpy).toHaveBeenCalled();
    const props = websiteStepSpy.mock.calls[0][0];
    expect(props.isConnectStepCompleted).toBe(true);
  });

  it('passes isConnectStepCompleted=false to WebsiteStep for first-time connect step visitors', () => {
    render(
      <WizardStepContent
        {...buildBaseProps({ isConnectStepOfficiallyComplete: false, completedFrontier: -1 })}
      />
    );

    const props = websiteStepSpy.mock.calls[0][0];
    expect(props.isConnectStepCompleted).toBe(false);
  });
});
