// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MushafVerse } from "@/domain/quran";
import type { QuranRouteContext } from "@/features/quran-reader/model/quranReaderRoutes";
import { useVerseHighlight } from "./useVerseHighlight";

const mushafData: MushafVerse[] = [
  {
    id: 1,
    jozz: 1,
    page: 2,
    sura_no: 2,
    sura_name_en: "Al-Baqarah",
    sura_name_ar: "البقرة",
    line_start: 1,
    line_end: 1,
    aya_no: 1,
    aya_text: "نص",
    aya_text_emlaey: "نص",
  },
];

interface HookProps {
  routeContext: QuranRouteContext;
  locationKey: string;
}

describe("useVerseHighlight", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("flashes a queued ayah after page navigation and clears it", () => {
    const { result, rerender } = renderHook<
      ReturnType<typeof useVerseHighlight>,
      HookProps
    >(
      ({ routeContext, locationKey }: HookProps) =>
        useVerseHighlight({
          loading: false,
          mushafData,
          routeContext,
          locationKey,
        }),
      {
        initialProps: {
          routeContext: { type: "page", page: 1 },
          locationKey: "first",
        },
      },
    );

    act(() => result.current.queueHighlight("2:1"));
    rerender({
      routeContext: { type: "page", page: 2 },
      locationKey: "second",
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.highlightVerseKey).toBe("2:1");

    act(() => {
      vi.advanceTimersByTime(3_500);
    });
    expect(result.current.highlightVerseKey).toBeNull();
  });

  it("uses an explicit ayah route and discards an older pending highlight", () => {
    const { result, rerender } = renderHook<
      ReturnType<typeof useVerseHighlight>,
      HookProps
    >(
      ({ routeContext, locationKey }: HookProps) =>
        useVerseHighlight({
          loading: false,
          mushafData,
          routeContext,
          locationKey,
        }),
      {
        initialProps: {
          routeContext: { type: "page", page: 1 },
          locationKey: "first",
        },
      },
    );

    act(() => result.current.queueHighlight("stale:selection"));
    rerender({
      routeContext: { type: "ayah", surah: 2, ayah: 1 },
      locationKey: "ayah",
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.highlightVerseKey).toBe("2:1");

    act(() => {
      vi.advanceTimersByTime(3_500);
    });
    expect(result.current.highlightVerseKey).toBeNull();

    rerender({
      routeContext: { type: "page", page: 2 },
      locationKey: "page",
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.highlightVerseKey).toBeNull();
  });
});
