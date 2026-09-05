import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WebsiteUrlActionBar from '../WebsiteUrlActionBar';

describe('WebsiteUrlActionBar', () => {
  it('renders Analyze when no analysis exists', () => {
    render(
      <WebsiteUrlActionBar
        website="https://example.com"
        setWebsite={vi.fn()}
        loading={false}
        hasAnalysis={false}
        onAnalyze={vi.fn()}
        onAnalyzeNewWebsite={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-analyze/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /analyze new website/i })).not.toBeInTheDocument();
  });

  it('renders Re-Analyze and Analyze New Website when analysis exists', () => {
    render(
      <WebsiteUrlActionBar
        website="https://example.com"
        setWebsite={vi.fn()}
        loading={false}
        hasAnalysis={true}
        onAnalyze={vi.fn()}
        onAnalyzeNewWebsite={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /re-analyze/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze new website/i })).toBeInTheDocument();
  });

  it('renders compact variant with URL field and actions only', () => {
    render(
      <WebsiteUrlActionBar
        website="https://www.alwrity.com"
        setWebsite={vi.fn()}
        loading={false}
        hasAnalysis={true}
        onAnalyze={vi.fn()}
        onAnalyzeNewWebsite={vi.fn()}
        variant="compact"
      />
    );

    expect(screen.getByTestId('website-url-action-bar')).toHaveAttribute('data-variant', 'compact');
    expect(screen.queryByTestId('analyzed-website-label')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('https://www.alwrity.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze new website/i })).toBeInTheDocument();
  });

  it('renders Re-Analyze with blue-indigo-violet gradient styling', () => {
    render(
      <WebsiteUrlActionBar
        website="https://example.com"
        setWebsite={vi.fn()}
        loading={false}
        hasAnalysis={true}
        onAnalyze={vi.fn()}
        onAnalyzeNewWebsite={vi.fn()}
      />
    );

    const reAnalyzeButton = screen.getByTestId('re-analyze-button');
    expect(reAnalyzeButton).toHaveAttribute(
      'data-button-gradient',
      'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #7C3AED 100%)'
    );
  });

  it('calls action handlers from the URL bar buttons', () => {
    const onAnalyze = vi.fn();
    const onAnalyzeNewWebsite = vi.fn();

    render(
      <WebsiteUrlActionBar
        website="https://example.com"
        setWebsite={vi.fn()}
        loading={false}
        hasAnalysis={true}
        onAnalyze={onAnalyze}
        onAnalyzeNewWebsite={onAnalyzeNewWebsite}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /re-analyze/i }));
    fireEvent.click(screen.getByRole('button', { name: /analyze new website/i }));

    expect(onAnalyze).toHaveBeenCalledTimes(1);
    expect(onAnalyzeNewWebsite).toHaveBeenCalledTimes(1);
  });
});
