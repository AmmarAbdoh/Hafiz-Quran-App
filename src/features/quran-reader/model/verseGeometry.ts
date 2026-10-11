import {
  mergeBoxes,
  type Box,
} from "@/features/quran-reader/model/followScroll";

const STAGE_SELECTOR = ".mushaf-stage";
const DOCK_SELECTOR = ".mushaf-bottom-dock";

export interface StageGeometry {
  stage: HTMLElement;
  box: Box;
  /** How much of the stage's foot the fixed audio bar covers. */
  bottomInset: number;
}

export function readStageGeometry(
  known?: HTMLElement | null,
): StageGeometry | null {
  const stage =
    known ?? document.querySelector<HTMLElement>(STAGE_SELECTOR) ?? null;
  if (!stage) return null;

  const box = stage.getBoundingClientRect();
  const dock = document.querySelector<HTMLElement>(DOCK_SELECTOR);
  const dockTop = dock?.getBoundingClientRect().top ?? box.bottom;

  return { stage, box, bottomInset: Math.max(0, box.bottom - dockTop) };
}

export function maxScrollTopOf(stage: HTMLElement): number {
  return stage.scrollHeight - stage.clientHeight;
}

/**
 * The box around a verse as it sits on the page, or null if it is not laid
 * out - not mounted yet, or on a page still waiting for its fonts.
 *
 * Every part of the verse is measured rather than the first match, because
 * `data-verse-key` sits on the ayah run as well as on each of its words, and
 * on a full mushaf page the run is `display: contents` and has no box at all.
 * Anything reading only the first match measures {0, 0} and moves the reader
 * to the top of the surah, or - with scrollIntoView - does nothing whatever.
 */
export function measureVerse(root: ParentNode, verseKey: string): Box | null {
  const parts = root.querySelectorAll<HTMLElement>(
    `[data-verse-key="${CSS.escape(verseKey)}"]`,
  );
  return mergeBoxes(Array.from(parts, (part) => part.getBoundingClientRect()));
}
