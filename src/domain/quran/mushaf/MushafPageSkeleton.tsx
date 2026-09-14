import type { CSSProperties } from "react";
import { cn } from "@/shared/lib/utils";
import {
  buildMushafPageItems,
  buildMushafPageItemsForSurah,
  CENTER_ALIGNED_PAGE_LINES,
  isCenterAlignedPage,
  MUSHAF_LINES_PER_PAGE,
  type MushafPageLayout,
} from "../model";
import "./mushaf.css";

interface MushafPageSkeletonProps {
  /** Announced to assistive tech; the placeholder itself carries no text. */
  label: string;
  /**
   * Supply the layout whenever it is known. The placeholder then mirrors the
   * real line and heading positions, so the page text lands exactly where the
   * bars were and nothing moves.
   */
  pageLayout?: MushafPageLayout;
  /** Used when no layout is available yet to pick the page geometry. */
  page?: number;
  /**
   * Line count to draw while the layout is unknown. Defaults to the shape of
   * the requested page; pass a smaller estimate where only part of a page is
   * shown.
   */
  lines?: number;
  surahFilter?: number;
  className?: string;
}

function SkeletonLine({ spreadLayout }: { spreadLayout: boolean }) {
  return (
    <div
      className={cn(
        "mushaf-line",
        spreadLayout && "mushaf-line--full mushaf-line--spread",
      )}
      aria-hidden
    >
      <div
        className={cn(
          spreadLayout ? "mushaf-line__verse" : "mushaf-line__content",
          "mushaf-skeleton-line",
        )}
      >
        <span className="mushaf-skeleton-bar" />
      </div>
    </div>
  );
}

function SkeletonSurahHeader({ headerLines }: { headerLines: number }) {
  const spacerLines = Math.max(0, headerLines - 1);

  return (
    <div
      className="mushaf-surah-header-block"
      style={{ "--mushaf-header-spacer-lines": spacerLines } as CSSProperties}
      aria-hidden
    >
      {spacerLines > 0 ? <div className="mushaf-surah-header__spacer" /> : null}
      <div className="mushaf-surah-header">
        <span className="mushaf-skeleton-bar mushaf-skeleton-bar--heading" />
      </div>
    </div>
  );
}

export function MushafPageSkeleton({
  label,
  pageLayout,
  page,
  lines,
  surahFilter,
  className,
}: MushafPageSkeletonProps) {
  const pageNumber = pageLayout?.page ?? page;
  const centerAligned =
    pageNumber !== undefined && isCenterAlignedPage(pageNumber);
  const spreadLayout = !centerAligned;

  const items = pageLayout
    ? surahFilter === undefined
      ? buildMushafPageItems(pageLayout)
      : buildMushafPageItemsForSurah(pageLayout, surahFilter)
    : null;
  const placeholderLines =
    lines ??
    (centerAligned ? CENTER_ALIGNED_PAGE_LINES : MUSHAF_LINES_PER_PAGE);

  return (
    <div
      className={cn(
        "mushaf-page",
        spreadLayout && "mushaf-page--full",
        "mushaf-page--skeleton",
        className,
      )}
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>

      {items
        ? items.map((item) =>
            item.type === "surah-header" ? (
              <SkeletonSurahHeader
                key={item.key}
                headerLines={item.headerLines}
              />
            ) : (
              <SkeletonLine key={item.key} spreadLayout={spreadLayout} />
            ),
          )
        : [
            // Both centred pages open a surah, so the heading is part of their shape.
            centerAligned ? (
              <SkeletonSurahHeader key="heading" headerLines={1} />
            ) : null,
            ...Array.from({ length: placeholderLines }, (_, index) => (
              <SkeletonLine key={index} spreadLayout={spreadLayout} />
            )),
          ]}
    </div>
  );
}
