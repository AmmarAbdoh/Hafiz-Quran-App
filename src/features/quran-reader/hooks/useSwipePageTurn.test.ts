// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSwipePageTurn } from "./useSwipePageTurn";

function createTouchTarget() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

function dispatchSwipe(
  container: HTMLElement,
  startX: number,
  endX: number,
  startY = 0,
  endY = 0,
) {
  container.dispatchEvent(
    new TouchEvent("touchstart", {
      bubbles: true,
      touches: [{ clientX: startX, clientY: startY } as Touch],
    }),
  );
  container.dispatchEvent(
    new TouchEvent("touchend", {
      bubbles: true,
      changedTouches: [{ clientX: endX, clientY: endY } as Touch],
    }),
  );
}

describe("useSwipePageTurn", () => {
  it("maps a leftward swipe to the next page in every UI language", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const container = createTouchTarget();

    renderHook(() =>
      useSwipePageTurn({
        enabled: true,
        containerRef: { current: container },
        onNext,
        onPrevious,
      }),
    );

    dispatchSwipe(container, 200, 100);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it("maps a rightward swipe to the previous page in every UI language", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const container = createTouchTarget();

    renderHook(() =>
      useSwipePageTurn({
        enabled: true,
        containerRef: { current: container },
        onNext,
        onPrevious,
      }),
    );

    dispatchSwipe(container, 100, 200);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});
