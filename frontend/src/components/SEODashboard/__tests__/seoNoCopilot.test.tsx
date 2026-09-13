import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const dashSrc = () =>
  readFileSync(resolve(HERE, '../SEODashboard.tsx'), 'utf-8');

// Phase B: Copilot chat is disabled in the SEO dashboard. Its capabilities
// are provided by user-fired tool panels instead (Phases C/D). The Copilot
// files stay on disk; nothing here may mount or sync with them.
describe('Phase B — no Copilot chat in SEO dashboard', () => {
  it('mounts no Copilot components', () => {
    const src = dashSrc();
    expect(src).not.toMatch(/<SEOCopilot[\s/>]/);
    expect(src).not.toMatch(/<SEOCopilotSuggestions[\s/>]/);
    expect(src).not.toMatch(/SEOCopilotKitProvider/);
    expect(src).not.toMatch(/SEOSuggestionsController/);
  });

  it('has no Copilot store sync or imports', () => {
    const src = dashSrc();
    expect(src).not.toMatch(/useSEOCopilotStore/);
    expect(src).not.toMatch(/setCopilotAnalysisData/);
    expect(src).not.toMatch(/CopilotSync/);
    expect(src).not.toMatch(/from '\.\/SEOCopilot'/);
    expect(src).not.toMatch(/from '\.\/index'/);
  });
});
