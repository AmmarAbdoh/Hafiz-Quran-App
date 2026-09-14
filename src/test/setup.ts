import "@testing-library/jest-dom/vitest";

/**
 * jsdom ships no ResizeObserver, and the reader chrome measures itself with one
 * to reserve scroll space. Nothing in a test asserts on those measurements, so a
 * no-op keeps the components mountable.
 */
if (!("ResizeObserver" in globalThis)) {
  class NoopResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = NoopResizeObserver;
}
