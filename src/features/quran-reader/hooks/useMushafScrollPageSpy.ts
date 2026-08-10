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

function measureVisiblePage(
  container: HTMLElement,
  sections: HTMLElement[],
): number | null {
  if (sections.length === 0) return null;

  const containerRect = container.getBoundingClientRect();
  const viewCenter = (containerRect.top + containerRect.bottom) / 2;

  let bestPage = Number.parseInt(sections[0]!.dataset.mushafPage ?? "1", 10);
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const section of sections) {
    const page = Number.parseInt(section.dataset.mushafPage ?? "", 10);
    if (!Number.isFinite(page)) continue;

    const rect = section.getBoundingClientRect();
    const visibleTop = Math.max(rect.top, containerRect.top);
    const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
    if (visibleBottom <= visibleTop) continue;

    const sectionCenter = (rect.top + rect.bottom) / 2;
    const distance = Math.abs(sectionCenter - viewCenter);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestPage = page;
    }
  }

  return bestPage;
}

export function useMushafScrollPageSpy(
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  pageSelector: string,
  onVisiblePageChange: (page: number) => void,
  enabled = true,
  scrollLockRef?: MutableRefObject<number | null>,
  contentKey?: string | number,
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

    let frameId: number | null = null;

    const publishVisiblePage = () => {
      const bestPage = measureVisiblePage(container, sections);
      if (bestPage === null) return;

      const lockedPage = scrollLockRef?.current ?? null;
      if (lockedPage !== null) {
        if (bestPage === lockedPage && scrollLockRef) {
          scrollLockRef.current = null;
        }
        return;
      }

      onChangeRef.current(bestPage);
    };

    const schedulePublish = () => {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        publishVisiblePage();
      });
    };

    container.addEventListener("scroll", schedulePublish, { passive: true });
    window.addEventListener("resize", schedulePublish);

    const observer = new ResizeObserver(schedulePublish);
    observer.observe(container);
    for (const section of sections) {
      observer.observe(section);
    }

    schedulePublish();

    return () => {
      container.removeEventListener("scroll", schedulePublish);
      window.removeEventListener("resize", schedulePublish);
      observer.disconnect();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    containerRef,
    contentRef,
    pageSelector,
    enabled,
    scrollLockRef,
    contentKey,
  ]);
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
