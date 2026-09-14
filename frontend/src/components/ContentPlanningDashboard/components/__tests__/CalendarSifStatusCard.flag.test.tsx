/**
 * R3.1 — the rollout flag must actually gate the card.
 *
 * - the flag function's value is passed as the hook's `enabled` option
 *   (flag off → no authenticated status call), while the card unmounts;
 *   flag on → a request-firing hook;
 * - the hook is still called unconditionally (no conditional-hook order).
 *
 * Config module itself is mocked here (its env lookup runs at import time);
 * behavioural flag coverage lives here, default-value is asserted in the
 * config test file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('../../../../hooks/useCalendarSifStatus', () => ({
  useCalendarSifStatus: vi.fn(),
}));

vi.mock('../../../../services/contentPlanningApi', () => ({
  contentPlanningApi: {
    searchCalendarSif: vi.fn(),
  },
}));

const flagMock = vi.fn(() => true);

vi.mock('../../../../config/strategySifConfig', () => ({
  CALENDAR_SIF_CARD_ENABLED: true,
  isCalendarSifCardEnabled: () => flagMock(),
}));

import CalendarSifStatusCard from '../CalendarSifStatusCard';
import { useCalendarSifStatus } from '../../../../hooks/useCalendarSifStatus';
import { CalendarSifStatus } from '../../../../hooks/useCalendarSifStatus';

const mockHook = vi.mocked(useCalendarSifStatus);

const hookState = (): ReturnType<typeof useCalendarSifStatus> => ({
  data: null as CalendarSifStatus | null,
  loading: false,
  refreshing: false,
  error: null as string | null,
  refresh: vi.fn(),
});

describe('CalendarSifStatusCard — flag gating (R3.1)', () => {
  beforeEach(() => {
    mockHook.mockReset();
    mockHook.mockReturnValue(hookState());
    flagMock.mockReturnValue(true);
  });

  it('flag on: hook receives enabled=true', () => {
    flagMock.mockReturnValue(true);

    render(<CalendarSifStatusCard />);

    expect(mockHook).toHaveBeenCalledWith({ enabled: true });
  });

  it('flag off: hook receives enabled=false and nothing renders', () => {
    flagMock.mockReturnValue(false);

    const { container } = render(<CalendarSifStatusCard />);

    expect(mockHook).toHaveBeenCalledWith({ enabled: false });
    expect(container.firstChild).toBeNull();
  });
});
