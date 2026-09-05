import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SystemStatusChip from '../SystemStatusChip';

const theme = createTheme();

describe('SystemStatusChip compact', () => {
  it('renders hover panel in a portal popover above surrounding chrome', async () => {
    render(
      <ThemeProvider theme={theme}>
        <SystemStatusChip
          variant="compact"
          activeTasks={1}
          totalTasks={2}
          tasks={{
            full_site_seo_audit: { status: 'running', progress_pct: 40 },
            market_trends: { status: 'completed', progress_pct: 100 },
          }}
          onViewResults={vi.fn()}
        />
      </ThemeProvider>
    );

    fireEvent.mouseEnter(screen.getByText(/Background Tasks/i));

    await waitFor(() => {
      expect(screen.getByTestId('background-tasks-popover')).toBeInTheDocument();
    });
  });
});
