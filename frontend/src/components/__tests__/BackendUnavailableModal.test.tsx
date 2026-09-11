/**
 * BackendUnavailableModal render tests.
 *
 * Non-blocking status dialog driven by the backend cooldown circuit-breaker:
 * shows once per outage episode with a live retry countdown, is dismissible,
 * and auto-closes when the backend answers again. Only the controlled surface
 * is tested here (context integration is covered by typecheck + manual drill).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import BackendUnavailableModal from '../BackendUnavailableModal';

const renderModal = (
  over: Partial<React.ComponentProps<typeof BackendUnavailableModal>> = {},
) =>
  render(
    <BackendUnavailableModal open={false} onClose={() => {}} retrySeconds={0} {...over} />,
  );

describe('BackendUnavailableModal — backend-down dialog', () => {
  it('renders nothing while closed', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the unavailable title and reason label while open', () => {
    renderModal({ open: true, reason: 'ECONNREFUSED', retrySeconds: 12 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Backend Temporarily Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });

  it('shows the live retry countdown', () => {
    renderModal({ open: true, reason: 'network_error', retrySeconds: 30 });
    expect(screen.getByText('Retrying in 30s')).toBeInTheDocument();
  });

  it('falls back to "Retrying…" when no seconds remain', () => {
    renderModal({ open: true, reason: 'network_error', retrySeconds: 0 });
    expect(screen.getByText('Retrying…')).toBeInTheDocument();
  });

  it('fires onClose from the Dismiss button', () => {
    const onClose = vi.fn();
    renderModal({ open: true, reason: 'ECONNREFUSED', retrySeconds: 5, onClose });
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('suggests the backend readiness banner as a dev hint', () => {
    renderModal({ open: true, reason: 'network_error', retrySeconds: 5 });
    expect(
      screen.getByText(/Backend is Ready to Serve the Frontend/),
    ).toBeInTheDocument();
  });
});