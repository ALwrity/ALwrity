import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingCompletionCTA from '../OnboardingCompletionCTA';

describe('OnboardingCompletionCTA', () => {
  const mockOnCreateStrategy = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when onboarding complete and no strategy', () => {
    render(
      <OnboardingCompletionCTA
        hasCompletedOnboarding={true}
        hasActiveStrategy={false}
        onCreateStrategy={mockOnCreateStrategy}
        onDismiss={mockOnDismiss}
      />
    );
    
    expect(screen.getByText(/Your Marketing OS is ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Create your first content strategy/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Content Strategy/i })).toBeInTheDocument();
  });

  it('does not render when strategy exists', () => {
    const { container } = render(
      <OnboardingCompletionCTA
        hasCompletedOnboarding={true}
        hasActiveStrategy={true}
        onCreateStrategy={mockOnCreateStrategy}
        onDismiss={mockOnDismiss}
      />
    );
    
    expect(screen.queryByText(/Your Marketing OS is ready/i)).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('does not render when onboarding not complete', () => {
    const { container } = render(
      <OnboardingCompletionCTA
        hasCompletedOnboarding={false}
        hasActiveStrategy={false}
        onCreateStrategy={mockOnCreateStrategy}
        onDismiss={mockOnDismiss}
      />
    );
    
    expect(screen.queryByText(/Your Marketing OS is ready/i)).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('calls onCreateStrategy on "Create Content Strategy" button click', () => {
    render(
      <OnboardingCompletionCTA
        hasCompletedOnboarding={true}
        hasActiveStrategy={false}
        onCreateStrategy={mockOnCreateStrategy}
        onDismiss={mockOnDismiss}
      />
    );
    
    const createButton = screen.getByRole('button', { name: /Create Content Strategy/i });
    fireEvent.click(createButton);
    
    expect(mockOnCreateStrategy).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss on "Maybe later" button click', () => {
    render(
      <OnboardingCompletionCTA
        hasCompletedOnboarding={true}
        hasActiveStrategy={false}
        onCreateStrategy={mockOnCreateStrategy}
        onDismiss={mockOnDismiss}
      />
    );
    
    const dismissButton = screen.getByRole('button', { name: /Maybe later/i });
    fireEvent.click(dismissButton);
    
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    expect(mockOnCreateStrategy).not.toHaveBeenCalled();
  });

  it('has correct styling and displays info alert', () => {
    const { container } = render(
      <OnboardingCompletionCTA
        hasCompletedOnboarding={true}
        hasActiveStrategy={false}
        onCreateStrategy={mockOnCreateStrategy}
        onDismiss={mockOnDismiss}
      />
    );
    
    // Check for MUI Alert component (it renders with role="alert")
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    
    // Check for info styling (MUI adds class based on severity)
    const alertDiv = container.querySelector('.MuiAlert-standardInfo');
    expect(alertDiv).toBeTruthy();
  });

  it('displays the correct messaging for content strategy creation', () => {
    render(
      <OnboardingCompletionCTA
        hasCompletedOnboarding={true}
        hasActiveStrategy={false}
        onCreateStrategy={mockOnCreateStrategy}
        onDismiss={mockOnDismiss}
      />
    );
    
    expect(screen.getByText(/plan your first 30 days of content/i)).toBeInTheDocument();
    expect(screen.getByText(/first content strategy/i)).toBeInTheDocument();
  });
});