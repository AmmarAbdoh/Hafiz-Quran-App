function rectArea(rect: DOMRect): number {
  return rect.width * rect.height;
}

function elementContainsPoint(
  element: HTMLElement,
  clientX: number,
  clientY: number,
): { contains: boolean; area: number } {
  let area = 0;
  let contains = false;

  for (const rect of element.getClientRects()) {
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      contains = true;
      area += rectArea(rect);
    }
  }

  return { contains, area };
}

/** Pick the mushaf word at a point within one line (RTL overlap safe). */
export function resolveWordElementInLine(
  lineElement: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const words = Array.from(
    lineElement.querySelectorAll<HTMLElement>(".mushaf-word[data-location]"),
  );

  const candidates: { element: HTMLElement; zIndex: number; area: number }[] =
    [];

  for (const element of words) {
    const { contains, area } = elementContainsPoint(
      element,
      clientX,
      clientY,
    );
    if (!contains) continue;

    const zIndex = Number.parseInt(getComputedStyle(element).zIndex, 10) || 0;
    candidates.push({ element, zIndex, area });
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!.element;

  candidates.sort((a, b) => {
    if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
    return a.area - b.area;
  });

  return candidates[0]!.element;
}
