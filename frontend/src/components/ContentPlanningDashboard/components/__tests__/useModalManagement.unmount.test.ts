/**
 * Phase B #9: useModalManagement fires originalHandleCreateStrategyRef.current()
 * inside a setTimeout after closing the modal. If the component unmounts /
 * navigates within that window the callback must not run. Add an isMountedRef,
 * set false by a cleanup effect, and guard both deferred handlers.
 *
 * Source-reading test — lightweight, no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder/hooks/useModalManagement.ts'),
  'utf-8',
);

describe('useModalManagement — Phase B #9: unmount race guard', () => {
  it('tracks an isMountedRef', () => {
    expect(source).toMatch(/isMountedRef\s*=\s*useRef<boolean>\(true\)/);
  });

  it('sets isMountedRef.current = false in a cleanup effect', () => {
    expect(source).toMatch(/isMountedRef\.current\s*=\s*false/);
    expect(source).toMatch(/return\s*\(\)\s*=>\s*\{/);
  });

  it('guards the deferred callback with the mounted ref', () => {
    expect(source).toMatch(/if\s*\(\s*!?isMountedRef\.current\s*\)\s*return;/);
  });
});