/**
 * Tests for useUndoRedo (Story Writer + LinkedIn Assistive Editor).
 * Covers enableKeyboardShortcuts and undo/redo return values used by Wave 1.
 */

import { act, renderHook } from "@testing-library/react";
import { useUndoRedo } from "../useUndoRedo";

describe("useUndoRedo", () => {
  it("exports a named function", () => {
    expect(typeof useUndoRedo).toBe("function");
    expect(useUndoRedo.name).toBe("useUndoRedo");
  });

  it("tracks present value and enables undo after setValue", () => {
    const { result } = renderHook(() =>
      useUndoRedo("a", { limit: 30, enableKeyboardShortcuts: false }),
    );

    expect(result.current.value).toBe("a");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.setValue("ab");
    });

    expect(result.current.value).toBe("ab");
    expect(result.current.canUndo).toBe(true);
  });

  it("undo returns restored present and enables redo", () => {
    const { result } = renderHook(() =>
      useUndoRedo("start", { enableKeyboardShortcuts: false }),
    );

    act(() => {
      result.current.setValue("next");
    });

    let restored: string | undefined;
    act(() => {
      restored = result.current.undo();
    });

    expect(restored).toBe("start");
    expect(result.current.value).toBe("start");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("redo restores future present after undo", () => {
    const { result } = renderHook(() =>
      useUndoRedo("a", { enableKeyboardShortcuts: false }),
    );

    act(() => {
      result.current.setValue("b");
    });
    act(() => {
      result.current.undo();
    });

    let restored: string | undefined;
    act(() => {
      restored = result.current.redo();
    });

    expect(restored).toBe("b");
    expect(result.current.value).toBe("b");
    expect(result.current.canRedo).toBe(false);
  });

  it("reset clears past and future", () => {
    const { result } = renderHook(() =>
      useUndoRedo("a", { enableKeyboardShortcuts: false }),
    );

    act(() => {
      result.current.setValue("b");
      result.current.reset("fresh");
    });

    expect(result.current.value).toBe("fresh");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("does not register keyboard shortcuts when disabled", () => {
    const addSpy = jest.spyOn(window, "addEventListener");

    renderHook(() =>
      useUndoRedo("", { enableKeyboardShortcuts: false }),
    );

    const keydownHandlers = addSpy.mock.calls.filter(
      ([eventName]: [string, ...unknown[]]) => eventName === "keydown",
    );
    expect(keydownHandlers).toHaveLength(0);

    addSpy.mockRestore();
  });
});
