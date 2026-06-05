export function measureLineOverflowFit(
  verses: NodeListOf<HTMLElement>,
): number {
  let fit = 1;

  for (const verse of verses) {
    if (verse.childElementCount === 0) continue;

    const lineWidth = verse.clientWidth;
    const contentWidth = verse.scrollWidth;

    if (contentWidth > lineWidth + 1 && lineWidth > 0) {
      fit = Math.min(fit, lineWidth / contentWidth);
    }
  }

  return fit;
}
