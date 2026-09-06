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
    sessionStorage.clear();
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

  it('load saved analysis for a previous site clears other-site research and notifies the wizard', async () => {
    vi.mocked(websiteUtils.fetchLastAnalysis).mockResolvedValueOnce({
      success: false,
    });
    vi.mocked(websiteUtils.checkExistingAnalysis).mockResolvedValueOnce({
      exists: true,
      analysis: { analysis_id: 99, analysis_date: '2026-09-01' },
    });
    vi.mocked(websiteUtils.loadExistingAnalysis).mockResolvedValueOnce({
      success: true,
      analysis: {
        id: 99,
        website_url: 'https://www.alwrity.com',
        writing_style: { tone: 'alwrity' },
      },
      domainName: 'Alwrity.com',
    });

    localStorage.setItem('website_url', 'https://www.alwrity.com');
    localStorage.setItem('competitor_analysis_url', 'https://www.hexaurum.com');
    localStorage.setItem('competitor_analysis_data', '{"competitors":[{"url":"old"}]}');
    localStorage.setItem('persona_generation_data', '{"core_persona":{"name":"Hexaurum"}}');

    const onLiveWebsiteSessionChange = vi.fn();
    const { result } = renderHook(() =>
      useWebsiteAnalysis({
        setSuccess: mockSetSuccess,
        setError: mockSetError,
        setAnalysisWarning: mockSetAnalysisWarning,
        onLiveWebsiteSessionChange,
      })
    );

    act(() => {
      result.current.setWebsite('https://www.alwrity.com');
    });

    await waitFor(() => {
      expect(result.current.existingAnalysis).toEqual({
        analysis_id: 99,
        analysis_date: '2026-09-01',
      });
    }, { timeout: 500 });

    await act(async () => {
      await result.current.handleLoadExistingConfirm();
    });

    expect(localStorage.getItem('competitor_analysis_data')).toBeNull();
    expect(localStorage.getItem('persona_generation_data')).toBeNull();
    expect(localStorage.getItem('website_url')).toBe('https://www.alwrity.com');
    expect(sessionStorage.getItem('persona_requires_regeneration')).toBe('1');
    expect(onLiveWebsiteSessionChange).toHaveBeenCalledWith({
      website: 'https://www.alwrity.com',
      analysis: expect.objectContaining({ id: 99, website_url: 'https://www.alwrity.com' }),
    });
    expect(mockSetSuccess).toHaveBeenCalled();
  });
});
