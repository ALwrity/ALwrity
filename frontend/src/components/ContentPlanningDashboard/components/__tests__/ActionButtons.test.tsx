/**
 * A3 (#1 distinct actions): "Create Strategy with AI" (outlined, polling,
 * disabled < 20% + review gate) vs "Save Draft" (contained, synchronous,
 * no AI, floor < 10%). The UI component is props-only, so no store/Clerk
 * mocking is needed.
 *
 * Phase E updates:
 * - #25: Save Draft is now ALSO gated on the required fields (the builder
 *   store is read reactively), so tests that expect Save to be enabled must
 *   seed the required fields first.
 * - #23: the in-flight Create label is "Generating…" — the educational modal
 *   is the single progress surface, so the button no longer claims
 *   "Creating...".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import ActionButtons from '../ContentStrategyBuilder/components/ActionButtons';
import { useStrategyBuilderStore, STRATEGIC_INPUT_FIELDS } from '../../../../stores/strategyBuilderStore';

// Seed valid values for every required field so the #25 gate passes.
const fillRequiredFields = () => {
  const formData: Record<string, any> = {};
  STRATEGIC_INPUT_FIELDS.forEach((f) => {
    if (!f.required) return;
    formData[f.id] =
      f.type === 'multiselect' ? ['Argon'] :
      f.type === 'boolean' ? true :
      f.type === 'number' ? 10 :
      'Seeded value';
  });
  useStrategyBuilderStore.setState({ formData });
};

beforeEach(() => {
  useStrategyBuilderStore.setState({ formData: {}, formErrors: {} });
});

afterEach(() => {
  cleanup();
  useStrategyBuilderStore.setState({ formData: {}, formErrors: {} });
});

const baseProps = {
  aiGenerating: false,
  saving: false,
  reviewProgressPercentage: 25,
  onCreateStrategy: vi.fn(),
  onSaveStrategy: vi.fn(),
};

describe('ActionButtons — A3: Create with AI vs Save Draft', () => {
  it('renders distinct labels "Create Strategy with AI" and "Save Draft"', () => {
    render(<ActionButtons {...baseProps} />);
    expect(screen.getByRole('button', { name: /Create Strategy with AI/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Save Draft/i })).toBeTruthy();
  });

  it('disables both buttons below the 10% floor', () => {
    render(<ActionButtons {...baseProps} reviewProgressPercentage={5} />);
    expect(
      (screen.getByRole('button', { name: /Create Strategy with AI/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: /Save Draft/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('disables Create below 20% but enables Save Draft between 10-20% (required fields filled)', () => {
    fillRequiredFields();
    render(<ActionButtons {...baseProps} reviewProgressPercentage={15} />);
    expect(
      (screen.getByRole('button', { name: /Create Strategy with AI/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: /Save Draft/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('enables both buttons at or above 20% (required fields filled)', () => {
    fillRequiredFields();
    render(<ActionButtons {...baseProps} reviewProgressPercentage={25} />);
    expect(
      (screen.getByRole('button', { name: /Create Strategy with AI/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByRole('button', { name: /Save Draft/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('Save Draft stays disabled when required fields are missing (#25)', () => {
    render(<ActionButtons {...baseProps} reviewProgressPercentage={25} />);
    expect(
      (screen.getByRole('button', { name: /Save Draft/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows in-flight labels: Create is "Generating…" (modal owns progress), Save is "Saving..."', () => {
    fillRequiredFields();
    render(<ActionButtons {...baseProps} aiGenerating saving />);
    expect(screen.getByRole('button', { name: /Generating…/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Saving.../i })).toBeTruthy();
  });

  it('Create tooltip explains the AI deep-dive', async () => {
    render(<ActionButtons {...baseProps} />);
    const createButton = screen.getByRole('button', { name: /Create Strategy with AI/i });
    fireEvent.mouseOver(createButton);
    expect(await screen.findByText(/AI deep-dive/i)).toBeTruthy();
  });

  it('Save Draft tooltip says "without AI generation"', async () => {
    fillRequiredFields();
    render(<ActionButtons {...baseProps} />);
    const saveButton = screen.getByRole('button', { name: /Save Draft/i });
    fireEvent.mouseOver(saveButton);
    expect(await screen.findByText(/without AI generation/i)).toBeTruthy();
  });
});
