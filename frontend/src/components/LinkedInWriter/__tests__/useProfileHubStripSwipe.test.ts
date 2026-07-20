/**
 * Unit tests for mobile profile hub swipe helpers.
 * Run manually: npx jest useProfileHubStripSwipe.test.ts
 */

import {
  clampProfileHubSwipeOffset,
  deriveProfileHubAvatarShift,
  deriveProfileHubComboLayout,
  deriveProfileHubSwipeIntent,
  resolveProfileHubSwipeAction,
} from '../hooks/profileHubStripSwipeUtils';

const disconnected = {
  connected: false,
  hasConnect: true,
  hasDisconnect: true,
  isConnecting: false,
  isDisconnecting: false,
};

const connected = {
  connected: true,
  hasConnect: true,
  hasDisconnect: true,
  isConnecting: false,
  isDisconnecting: false,
};

describe('profile hub swipe helpers', () => {
  test('resolveProfileHubSwipeAction triggers connect on right swipe', () => {
    expect(resolveProfileHubSwipeAction(80, disconnected)).toBe('connect');
  });

  test('resolveProfileHubSwipeAction triggers disconnect on left swipe', () => {
    expect(resolveProfileHubSwipeAction(-80, connected)).toBe('disconnect');
  });

  test('resolveProfileHubSwipeAction ignores short swipes', () => {
    expect(resolveProfileHubSwipeAction(40, disconnected)).toBeNull();
    expect(resolveProfileHubSwipeAction(-40, connected)).toBeNull();
  });

  test('clampProfileHubSwipeOffset blocks wrong-direction swipes', () => {
    expect(clampProfileHubSwipeOffset(80, connected)).toBe(0);
    expect(clampProfileHubSwipeOffset(-80, disconnected)).toBe(0);
  });

  test('deriveProfileHubSwipeIntent exposes visual feedback direction', () => {
    expect(deriveProfileHubSwipeIntent(20)).toBe('connect');
    expect(deriveProfileHubSwipeIntent(-20)).toBe('disconnect');
    expect(deriveProfileHubSwipeIntent(5)).toBeNull();
  });

  test('deriveProfileHubComboLayout swaps label and avatar order during swipe', () => {
    expect(deriveProfileHubComboLayout(false, 0)).toBe('disconnected-rest');
    expect(deriveProfileHubComboLayout(false, 20)).toBe('connect-swipe');
    expect(deriveProfileHubComboLayout(true, 0)).toBe('connected-rest');
    expect(deriveProfileHubComboLayout(true, -5)).toBe('connected-rest');
    expect(deriveProfileHubComboLayout(true, -20)).toBe('disconnect-swipe');
  });

  test('resolveProfileHubSwipeAction blocks actions while busy', () => {
    expect(
      resolveProfileHubSwipeAction(80, { ...disconnected, isConnecting: true })
    ).toBeNull();
    expect(
      resolveProfileHubSwipeAction(-80, { ...connected, isDisconnecting: true })
    ).toBeNull();
  });

  test('clampProfileHubSwipeOffset blocks swipes without handlers', () => {
    expect(
      clampProfileHubSwipeOffset(80, { ...disconnected, hasConnect: false })
    ).toBe(0);
    expect(
      clampProfileHubSwipeOffset(-80, { ...connected, hasDisconnect: false })
    ).toBe(0);
  });

  test('deriveProfileHubAvatarShift follows swipe direction', () => {
    expect(deriveProfileHubAvatarShift(40, 'connect-swipe')).toBeGreaterThan(0);
    expect(deriveProfileHubAvatarShift(-40, 'disconnect-swipe')).toBeLessThan(0);
    expect(deriveProfileHubAvatarShift(40, 'disconnected-rest')).toBe(0);
  });
});
