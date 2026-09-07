import { describe, it, expect } from 'vitest';
import { URL_INPUT_AUTOFILL_OVERRIDES } from './websiteUrlAutofillStyles';

describe('websiteUrlAutofillStyles', () => {
  it('overrides webkit autofill background to match the URL field surface', () => {
    const autofill = URL_INPUT_AUTOFILL_OVERRIDES['& .MuiInputBase-input:-webkit-autofill'] as Record<
      string,
      string
    >;

    expect(autofill).toBeDefined();
    expect(autofill.WebkitBoxShadow).toContain('#F8FAFC');
    expect(autofill.WebkitTextFillColor).toBe('#1E293B');
  });

  it('keeps autofill styling consistent on hover and focus', () => {
    const hover = URL_INPUT_AUTOFILL_OVERRIDES[
      '& .MuiInputBase-input:-webkit-autofill:hover'
    ] as Record<string, string>;
    const focus = URL_INPUT_AUTOFILL_OVERRIDES[
      '& .MuiInputBase-input:-webkit-autofill:focus'
    ] as Record<string, string>;

    expect(hover.WebkitBoxShadow).toContain('#F8FAFC');
    expect(focus.WebkitBoxShadow).toContain('#FFFFFF');
  });
});
