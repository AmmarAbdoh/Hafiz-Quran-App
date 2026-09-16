// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { useReaderGestures } from "./useReaderGestures";

let container: HTMLElement;
let onTap: Mock<() => void>;
let onSwipeNext: Mock<() => void>;
let onSwipePrevious: Mock<() => void>;

function mount(options: { swipeEnabled?: boolean; tapEnabled?: boolean } = {}) {
  renderHook(() =>
    useReaderGestures({
      containerRef: { current: container },
      swipeEnabled: options.swipeEnabled ?? true,
      tapEnabled: options.tapEnabled ?? true,
      onTap,
      onSwipeNext,
      onSwipePrevious,
    }),
  );
}

/** jsdom has no PointerEvent, and MouseEvent carries every field used here. */
function pointer(
  type: string,
  init: {
    x: number;
    y: number;
    timeStamp?: number;
    pointerType?: string;
    target?: HTMLElement;
  },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: init.x,
    clientY: init.y,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  Object.defineProperty(event, "pointerType", {
    value: init.pointerType ?? "touch",
  });
  if (init.timeStamp !== undefined) {
    Object.defineProperty(event, "timeStamp", { value: init.timeStamp });
  }
  (init.target ?? container).dispatchEvent(event);
}

function gesture(options: {
  from: [number, number];
  to: [number, number];
  durationMs?: number;
  pointerType?: string;
  target?: HTMLElement;
}) {
  const { from, to, durationMs = 120, pointerType, target } = options;
  pointer("pointerdown", {
    x: from[0],
    y: from[1],
    timeStamp: 1000,
    pointerType,
    target,
  });
  pointer("pointerup", {
    x: to[0],
    y: to[1],
    timeStamp: 1000 + durationMs,
    pointerType,
    target,
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  onTap = vi.fn<() => void>();
  onSwipeNext = vi.fn<() => void>();
  onSwipePrevious = vi.fn<() => void>();
});

describe("useReaderGestures", () => {
  it("maps a leftward swipe to the next page in every UI language", () => {
    mount();
    gesture({ from: [200, 100], to: [100, 100] });
    expect(onSwipeNext).toHaveBeenCalledTimes(1);
    expect(onSwipePrevious).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("maps a rightward swipe to the previous page in every UI language", () => {
    mount();
    gesture({ from: [100, 100], to: [200, 100] });
    expect(onSwipePrevious).toHaveBeenCalledTimes(1);
    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("toggles the chrome on a tap that stayed put", () => {
    mount();
    gesture({ from: [120, 120], to: [123, 118] });
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onSwipePrevious).not.toHaveBeenCalled();
  });

  it("does nothing for a drag too short to turn the page", () => {
    // The case that used to flash the toolbar on every failed swipe.
    mount();
    gesture({ from: [200, 100], to: [160, 100] });
    expect(onTap).not.toHaveBeenCalled();
    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onSwipePrevious).not.toHaveBeenCalled();
  });

  it("does nothing for a vertical scroll", () => {
    mount();
    gesture({ from: [120, 300], to: [124, 80] });
    expect(onTap).not.toHaveBeenCalled();
    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onSwipePrevious).not.toHaveBeenCalled();
  });

  it("ignores a mostly vertical drag even when it is long enough sideways", () => {
    mount();
    gesture({ from: [200, 400], to: [100, 100] });
    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("does not turn the page on a mouse drag, which is a text selection", () => {
    mount();
    gesture({ from: [200, 100], to: [100, 100], pointerType: "mouse" });
    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onSwipePrevious).not.toHaveBeenCalled();
  });

  it("leaves presses that begin on a control alone", () => {
    const button = document.createElement("button");
    container.appendChild(button);
    mount();
    gesture({ from: [10, 10], to: [10, 10], target: button });
    expect(onTap).not.toHaveBeenCalled();
  });

  it("ignores a long press, which is the verse-actions gesture", () => {
    mount();
    gesture({ from: [120, 120], to: [120, 120], durationMs: 900 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it("does not turn the page when swiping is disabled", () => {
    mount({ swipeEnabled: false });
    gesture({ from: [200, 100], to: [100, 100] });
    expect(onSwipeNext).not.toHaveBeenCalled();
  });

  it("does not toggle the chrome when tapping is disabled", () => {
    mount({ tapEnabled: false });
    gesture({ from: [120, 120], to: [121, 120] });
    expect(onTap).not.toHaveBeenCalled();
  });
});
