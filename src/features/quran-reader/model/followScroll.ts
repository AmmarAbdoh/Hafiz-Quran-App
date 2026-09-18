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

export function isComfortablyVisible(verse: Box, stage: Box): boolean {
  const height = stage.bottom - stage.top;
  if (height <= 0) return true;

  const margin = height * EDGE_MARGIN;
  return (
    verse.top >= stage.top + margin && verse.bottom <= stage.bottom - margin
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
): number {
  const stageHeight = stage.bottom - stage.top;
  const verseHeight = verse.bottom - verse.top;
  const offsetWithinStage = verse.top - stage.top;

  const desiredFromTop =
    verseHeight >= stageHeight * (1 - TARGET_FROM_TOP)
      ? stageHeight * EDGE_MARGIN
      : stageHeight * TARGET_FROM_TOP;

  const next = currentScrollTop + offsetWithinStage - desiredFromTop;
  return Math.max(0, Math.min(next, Math.max(0, maxScrollTop)));
}
