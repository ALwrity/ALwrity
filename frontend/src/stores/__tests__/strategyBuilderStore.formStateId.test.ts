/**
 * Phase D item 15 (#13): formData must never carry a strategy `id`.
 *
 * History: `formData.id` was observed as a STALE field (the plan's wording).
 * Investigation shows formData can only receive an `id` through the raw
 * `setFormData(data)` setter (no component calls it today) or through legacy
 * zustand-persisted state — while `formData.id` is the FORM-STATE id, not a
 * backend strategy id, and leaking it into submissions confused consumers
 * (console.log('FormData ID: ...')) and payloads alike.
 *
 * Shipped fix (completes the ActionButtons payload strip):
 * - setFormData strips `id` defensively on write, so no caller — including
 *   a future strategy-load path spreading a DB row — can re-inject it.
 * - The store documents WHY formData must not carry `id`.
 *
 * Source-reading guard test — same convention as the race-control test.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const storeSource = readFileSync(
  resolve(__dirname, '../strategyBuilderStore.ts'),
  'utf-8',
);

describe('strategyBuilderStore — formData must not carry a strategy id (#13)', () => {
  it('documents the id-is-not-a-strategy-id rule on the form state', () => {
    expect(storeSource).toMatch(/formData must NEVER carry a strategy `id`/);
  });

  it('setFormData strips id defensively on write', () => {
    expect(storeSource).toMatch(/const \{ id:\s*_ignoredFormStateId, \.\.\.sanitized \} = data/);
  });
});
