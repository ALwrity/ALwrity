import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Guards the Wizard → WizardStepContent prop chain that unlocks folder tabs
 * for returning Connect Platforms users.
 */
describe('Wizard renderStepContent — isConnectStepOfficiallyComplete wiring', () => {
  it('passes isConnectStepOfficiallyComplete into WizardStepContent', () => {
    const wizardSource = readFileSync(
      resolve(__dirname, '../../Wizard.tsx'),
      'utf-8'
    );

    const renderBlock = wizardSource.slice(
      wizardSource.indexOf('const renderStepContent'),
      wizardSource.indexOf('// Show loading state if loading')
    );

    expect(renderBlock).toContain('isConnectStepOfficiallyComplete={isConnectStepOfficiallyComplete}');
  });
});
