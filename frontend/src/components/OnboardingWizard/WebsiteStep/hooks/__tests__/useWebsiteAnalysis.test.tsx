import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWebsiteAnalysis } from '../useWebsiteAnalysis';
import * as websiteUtils from '../../utils/websiteUtils';

// Mock the website utilities
vi.mock('../../utils/websiteUtils', () => ({
  fixUrlFormat: vi.fn((url) => url),
  checkExistingAnalysis: vi.fn(),
  loadExistingAnalysis: vi.fn(),
  fetchLastAnalysis: vi.fn(),
  extractDomainName: vi.fn((url) => 'Example.com'),
}));

describe('useWebsiteAnalysis hook', () => {
  const mockSetSuccess = vi.fn();
  const mockSetError = vi.fn();
  const mockSetAnalysisWarning = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('silently loads active session analysis on mount (silent pre-fill hydration)', async () => {
    const mockAnalysis = { id: 456, writing_style: { tone: 'Friendly' } };
    vi.mocked(websiteUtils.fetchLastAnalysis).mockResolvedValueOnce({
      success: true,
      website: 'https://mysite.com',
      analysis: mockAnalysis,
      domainName: 'MySite',
    });

    const { result } = renderHook(() =>
      useWebsiteAnalysis({
        setSuccess: mockSetSuccess,
        setError: mockSetError,
        setAnalysisWarning: mockSetAnalysisWarning,
      })
    );

    // Wait for async fetch on mount
    await waitFor(() => {
      expect(result.current.website).toBe('https://mysite.com');
      expect(result.current.analysis).toEqual(mockAnalysis);
      expect(result.current.domainName).toBe('MySite');
    });

    // Ensure it was done silently (no success message or dialog shown)
    expect(mockSetSuccess).not.toHaveBeenCalled();
    expect(result.current.existingAnalysis).toBeNull();
  });

  it('clears active analysis and warning when typing a new website URL', async () => {
    vi.mocked(websiteUtils.fetchLastAnalysis).mockResolvedValueOnce({
      success: false,
    });

    const { result } = renderHook(() =>
      useWebsiteAnalysis({
        setSuccess: mockSetSuccess,
        setError: mockSetError,
        setAnalysisWarning: mockSetAnalysisWarning,
      })
    );

    // Manually trigger setting analysis (as if it was already loaded)
    act(() => {
      result.current.setWebsite('https://mysite.com');
    });

    act(() => {
      result.current.setWebsite('https://newsite.com');
    });

    expect(result.current.analysis).toBeNull();
    expect(result.current.existingAnalysis).toBeNull();
  });

  it('performs debounce check for existing analysis and shows inline alert banner if found', async () => {
    vi.mocked(websiteUtils.fetchLastAnalysis).mockResolvedValueOnce({
      success: false,
    });

    const mockExisting = { exists: true, analysis: { analysis_id: 123, analysis_date: '2026-09-03' } };
    vi.mocked(websiteUtils.checkExistingAnalysis).mockResolvedValueOnce(mockExisting);

    const { result } = renderHook(() =>
      useWebsiteAnalysis({
        setSuccess: mockSetSuccess,
        setError: mockSetError,
        setAnalysisWarning: mockSetAnalysisWarning,
      })
    );

    act(() => {
      result.current.setWebsite('https://mysite.com');
    });

    // Wait for the 300ms debounce to fire checkExistingAnalysis
    await waitFor(() => {
      expect(websiteUtils.checkExistingAnalysis).toHaveBeenCalledWith('https://mysite.com');
      expect(result.current.existingAnalysis).toEqual(mockExisting.analysis);
    }, { timeout: 500 });
  });

  it('clears all session data, state, and localStorage on handleStartFresh', async () => {
    vi.mocked(websiteUtils.fetchLastAnalysis).mockResolvedValueOnce({
      success: false,
    });

    const { result } = renderHook(() =>
      useWebsiteAnalysis({
        setSuccess: mockSetSuccess,
        setError: mockSetError,
        setAnalysisWarning: mockSetAnalysisWarning,
      })
    );

    localStorage.setItem('website_url', 'https://mysite.com');
    localStorage.setItem('website_analysis_data', '{}');

    act(() => {
      result.current.handleStartFresh();
    });

    expect(result.current.website).toBe('');
    expect(result.current.analysis).toBeNull();
    expect(result.current.crawlResult).toBeNull();
    expect(result.current.domainName).toBe('');
    expect(result.current.existingAnalysis).toBeNull();
    expect(localStorage.getItem('website_url')).toBeNull();
    expect(localStorage.getItem('website_analysis_data')).toBeNull();
  });
});
