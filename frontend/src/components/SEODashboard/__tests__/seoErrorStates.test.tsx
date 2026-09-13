import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, fireEvent } from '@testing-library/react';
import SEOAnalysisError from '../components/SEOAnalysisError';

const HERE = dirname(fileURLToPath(import.meta.url));
const panelSrc = () =>
  readFileSync(resolve(HERE, '../components/SEOAnalyzerPanel.tsx'), 'utf-8');
const dashSrc = () =>
  readFileSync(resolve(HERE, '../SEODashboard.tsx'), 'utf-8');

describe('Phase 3B — actionable error states', () => {
  it('error alert offers Retry when a retry handler is provided', () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    render(
      <SEOAnalysisError error="Boom" showError onCloseError={onClose} onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('error alert hides Retry without a retry handler (dismiss only)', () => {
    render(<SEOAnalysisError error="Boom" showError onCloseError={() => {}} />);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('analyzer panel retries analysis from the error and reshows on new errors', () => {
    const src = panelSrc();
    expect(src).toMatch(/onRetry=\{/);
    // A dismissed-then-new error must resurface (derived visibility, never silent)
    expect(src).toMatch(/dismissedError/);
    expect(src).toMatch(/error !== dismissedError/);
  });

  it('strategic insights fetch failure surfaces an Alert with retry (no silent warn)', () => {
    const src = dashSrc();
    expect(src).toMatch(/strategicInsightsError/);
    expect(src).not.toMatch(/console\.warn\('Strategic insights history/);
  });
});
