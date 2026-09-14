export const MUSHAF_SCALE_STEPS = [0.85, 1, 1.15, 1.3, 1.5] as const;

export type MushafScale = (typeof MUSHAF_SCALE_STEPS)[number];

export const DEFAULT_MUSHAF_SCALE: MushafScale = 1;

export function normalizeMushafScale(value: number): MushafScale {
  let closest: MushafScale = DEFAULT_MUSHAF_SCALE;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const step of MUSHAF_SCALE_STEPS) {
    const distance = Math.abs(step - value);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = step;
    }
  }

  return closest;
}
