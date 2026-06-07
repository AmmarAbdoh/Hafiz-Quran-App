import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";

export function getAdjacentPageInSequence(
  pageSequence: number[],
  currentPage: number,
  direction: "prev" | "next",
): number | null {
  if (pageSequence.length === 0) return null;

  const delta = direction === "next" ? 1 : -1;
  const index = pageSequence.indexOf(currentPage);

  if (index === -1) {
    if (direction === "next") {
      return pageSequence.find((page) => page > currentPage) ?? null;
    }
    for (let i = pageSequence.length - 1; i >= 0; i -= 1) {
      if (pageSequence[i]! < currentPage) return pageSequence[i]!;
    }
    return null;
  }

  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= pageSequence.length) return null;
  return pageSequence[nextIndex]!;
}

export function useMushafScrollPageSpy(
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  pageSelector: string,
  onVisiblePageChange: (page: number) => void,
  enabled = true,
  scrollLockRef?: MutableRefObject<number | null>,
) {
  const onChangeRef = useRef(onVisiblePageChange);
  onChangeRef.current = onVisiblePageChange;

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const sections = Array.from(
      content.querySelectorAll<HTMLElement>(pageSelector),
    );
    if (sections.length === 0) return;

    const visibleRatios = new Map<number, number>();

    const pickVisiblePage = () => {
      let bestPage = Number.parseInt(
        sections[0]?.dataset.mushafPage ?? "1",
        10,
      );
      let bestRatio = -1;

      for (const [page, ratio] of visibleRatios) {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestPage = page;
        }
      }

      if (bestRatio < 0) return;

      const lockedPage = scrollLockRef?.current ?? null;
      if (lockedPage !== null) {
        if (bestPage === lockedPage && scrollLockRef) {
          scrollLockRef.current = null;
        }
        return;
      }

      onChangeRef.current(bestPage);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number.parseInt(
            (entry.target as HTMLElement).dataset.mushafPage ?? "",
            10,
          );
          if (!Number.isFinite(page)) continue;
          visibleRatios.set(page, entry.intersectionRatio);
        }
        pickVisiblePage();
      },
      {
        root: container,
        threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
      },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, [containerRef, contentRef, pageSelector, enabled, scrollLockRef]);
}

export function scrollMushafToPage(
  contentRef: RefObject<HTMLElement | null>,
  containerRef: RefObject<HTMLElement | null>,
  page: number,
  behavior: ScrollBehavior = "smooth",
) {
  const target = contentRef.current?.querySelector<HTMLElement>(
    `[data-mushaf-page="${page}"]`,
  );
  const container = containerRef.current;

  if (!target) return;

  if (!container) {
    target.scrollIntoView({ behavior, block: "start" });
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const top = container.scrollTop + (targetRect.top - containerRect.top);

  container.scrollTo({ top: Math.max(0, top), behavior });
}
