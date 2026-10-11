export interface Box {
  top: number;
  bottom: number;
}

/**
 * Where a verse should sit once the reader is taken to it.
 *
 * Not centred: a reader following a recitation needs to see what is coming,
 * so the verse being recited sits in the upper third and the rest of the page
 * stays visible below it.
 */
const TARGET_FROM_TOP = 0.28;

/**
 * How much of the stage, at each edge, does not count as comfortably visible.
 *
 * A verse touching the very bottom edge is technically on screen and useless
 * to read from, so it counts as out of view and gets scrolled to.
 */
const EDGE_MARGIN = 0.12;

/**
 * The part of the stage the reader can actually see.
 *
 * The audio bar is fixed over the foot of the stage, so the stage's own box
 * runs on behind it and its last `bottomInset` pixels show nothing. Measured
 * on a phone that is 120px against a 103px edge margin, so a verse could land
 * behind the bar and still be called comfortably visible.
 */
function visibleStage(stage: Box, bottomInset: number): Box {
  return { top: stage.top, bottom: stage.bottom - Math.max(0, bottomInset) };
}

export function isComfortablyVisible(
  verse: Box,
  stage: Box,
  bottomInset = 0,
): boolean {
  const visible = visibleStage(stage, bottomInset);
  const height = visible.bottom - visible.top;
  if (height <= 0) return true;

  const margin = height * EDGE_MARGIN;
  return (
    verse.top >= visible.top + margin && verse.bottom <= visible.bottom - margin
  );
}

/**
 * The scrollTop that puts the verse where {@link TARGET_FROM_TOP} wants it.
 *
 * A verse taller than the stage is pinned to the top instead - scrolling to
 * put its start a third of the way down would push its end off the bottom.
 */
export function scrollTopForVerse(
  verse: Box,
  stage: Box,
  currentScrollTop: number,
  maxScrollTop: number,
  bottomInset = 0,
): number {
  const visible = visibleStage(stage, bottomInset);
  const stageHeight = visible.bottom - visible.top;
  const verseHeight = verse.bottom - verse.top;
  const offsetWithinStage = verse.top - visible.top;

  const desiredFromTop =
    verseHeight >= stageHeight * (1 - TARGET_FROM_TOP)
      ? stageHeight * EDGE_MARGIN
      : stageHeight * TARGET_FROM_TOP;

  const next = currentScrollTop + offsetWithinStage - desiredFromTop;
  return Math.max(0, Math.min(next, Math.max(0, maxScrollTop)));
}

/**
 * One box around every laid-out part of a verse.
 *
 * A verse is not one element: `data-verse-key` sits on the run wrapper and on
 * every word inside it, and on a full mushaf page the wrapper is `display:
 * contents`, so it has no box at all and measures as {0, 0}. Taking the first
 * match measured nothing on 13 of 16 ayat and sent the reader to the top of
 * the surah. The boxes with no height are those wrappers; what is left is the
 * words, and the verse is their union - which also spans a verse running over
 * several lines.
 */
export function mergeBoxes(boxes: readonly Box[]): Box | null {
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const box of boxes) {
    if (box.bottom <= box.top) continue;
    top = Math.min(top, box.top);
    bottom = Math.max(bottom, box.bottom);
  }

  return bottom > top ? { top, bottom } : null;
}
