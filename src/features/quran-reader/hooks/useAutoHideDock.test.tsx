// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoHideDock } from "./useAutoHideDock";

describe("useAutoHideDock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("cancels the initial hide when the dock is shown again", () => {
    const { result } = renderHook(() => useAutoHideDock());
    expect(result.current.expanded).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1_000);
      result.current.show();
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.expanded).toBe(true);

    act(() => {
      result.current.scheduleHide();
      vi.advanceTimersByTime(2_800);
    });
    expect(result.current.expanded).toBe(false);
  });
});
