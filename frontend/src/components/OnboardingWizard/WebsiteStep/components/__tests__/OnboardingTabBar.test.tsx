import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OnboardingTabBar from '../OnboardingTabBar';

const baseProps = {
  activeTab: 'website' as const,
  setActiveTab: vi.fn(),
  hasWebsiteAnalysis: false,
  linkedinConnected: false,
  youtubeConnected: false,
  hasInput: false,
  backgroundTasks: null,
};

describe('OnboardingTabBar', () => {
  it('renders Website label instead of Website Analysis', () => {
    render(<OnboardingTabBar {...baseProps} />);
    expect(screen.getByText('Website')).toBeInTheDocument();
    expect(screen.queryByText('Website Analysis')).not.toBeInTheDocument();
  });

  it('renders LinkedIn and YouTube platform tabs', () => {
    render(<OnboardingTabBar {...baseProps} />);
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
  });
});
