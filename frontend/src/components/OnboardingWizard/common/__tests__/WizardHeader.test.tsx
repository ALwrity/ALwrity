import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { WizardHeader } from '../WizardHeader';

vi.mock('../../../shared/UserBadge', () => ({
  default: () => <div data-testid="mock-user-badge" />,
}));

vi.mock('../EmailBadgePopover', () => ({
  EmailBadgePopover: () => <div data-testid="mock-email-badge" />,
}));

const theme = createTheme();

describe('WizardHeader', () => {
  it('renders Background Tasks before the help button', () => {
    render(
      <ThemeProvider theme={theme}>
        <WizardHeader
          stepHeaderContent={{ title: 'Build Your Brand Engine', description: 'Test' }}
          showProgressMessage={false}
          progressMessage=""
          showHelp={false}
          isMobile={false}
          onHelpToggle={vi.fn()}
          email="test@example.com"
          onEmailChange={vi.fn()}
          backgroundTasks={{
            tasks: { full_site_seo_audit: { status: 'running', progress_pct: 50 } },
            total: 1,
            completed_count: 0,
            failed_count: 0,
          }}
          onViewBackgroundResults={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/Background Tasks/i)).toBeInTheDocument();
    const helpButton = screen.getByRole('button', { name: /get help/i });
    const bgTasks = screen.getByText(/Background Tasks/i);
    expect(
      bgTasks.compareDocumentPosition(helpButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
