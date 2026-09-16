// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useListNavigation } from "./useListNavigation";

function press(key: string) {
  return { key, preventDefault: vi.fn() } as never;
}

describe("useListNavigation", () => {
  it("wraps in both directions", () => {
    const { result } = renderHook(() =>
      useListNavigation({ count: 3, onSelect: vi.fn() }),
    );

    act(() => result.current.onKeyDown(press("ArrowUp")));
    expect(result.current.activeIndex).toBe(2);

    act(() => result.current.onKeyDown(press("ArrowDown")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("jumps to the ends", () => {
    const { result } = renderHook(() =>
      useListNavigation({ count: 5, onSelect: vi.fn() }),
    );

    act(() => result.current.onKeyDown(press("End")));
    expect(result.current.activeIndex).toBe(4);

    act(() => result.current.onKeyDown(press("Home")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("selects the active option on Enter", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNavigation({ count: 3, onSelect }),
    );

    act(() => result.current.onKeyDown(press("ArrowDown")));
    act(() => result.current.onKeyDown(press("Enter")));

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("does nothing on an empty list rather than selecting nothing", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNavigation({ count: 0, onSelect }),
    );

    act(() => result.current.onKeyDown(press("Enter")));
    act(() => result.current.onKeyDown(press("ArrowDown")));

    expect(onSelect).not.toHaveBeenCalled();
    expect(result.current.activeIndex).toBe(0);
  });

  it("dismisses only when there is somewhere to dismiss to", () => {
    const onDismiss = vi.fn();
    const { result, rerender } = renderHook(
      ({ dismiss }: { dismiss?: () => void }) =>
        useListNavigation({ count: 3, onSelect: vi.fn(), onDismiss: dismiss }),
      { initialProps: { dismiss: undefined as (() => void) | undefined } },
    );

    act(() => result.current.onKeyDown(press("Escape")));
    expect(onDismiss).not.toHaveBeenCalled();

    rerender({ dismiss: onDismiss });
    act(() => result.current.onKeyDown(press("Escape")));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  /*
   * Filtering can remove the option that was active. Reporting an index past
   * the end would have the caller read undefined and select nothing.
   */
  it("never points past the end of a list that just shrank", () => {
    const { result, rerender } = renderHook(
      ({ count }: { count: number }) =>
        useListNavigation({ count, onSelect: vi.fn() }),
      { initialProps: { count: 5 } },
    );

    act(() => result.current.onKeyDown(press("End")));
    expect(result.current.activeIndex).toBe(4);

    rerender({ count: 2 });
    expect(result.current.activeIndex).toBe(1);
  });

  it("returns to the top when the list is refiltered", () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useListNavigation({ count: 5, onSelect: vi.fn(), resetKey: key }),
      { initialProps: { key: "a" } },
    );

    act(() => result.current.onKeyDown(press("End")));
    expect(result.current.activeIndex).toBe(4);

    rerender({ key: "ab" });
    expect(result.current.activeIndex).toBe(0);
  });
});
