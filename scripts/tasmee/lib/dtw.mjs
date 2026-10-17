/*
 * Dynamic time warping between two sequences of feature vectors.
 *
 * DTW is time-warp invariant by construction, which is what makes it worth
 * trying here: two people reciting the same ayah take different lengths over
 * the same words, and that difference should cost nothing. What it cannot
 * absorb is a different voice, and that is the open question the bench is
 * there to answer.
 */

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Normalised alignment cost, and the cost along the path.
 *
 * `band` restricts how far the path may stray from the diagonal, as a
 * fraction of the longer sequence. It bounds the work and, more usefully,
 * stops the path wandering far enough to "explain" a missing passage as
 * extreme stretching.
 */
export function dtw(a, b, { band = 0.2 } = {}) {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return { cost: Infinity, path: [] };

  const width = Math.max(Math.ceil(Math.max(n, m) * band), Math.abs(n - m) + 1);
  const INF = Infinity;

  let previous = new Float64Array(m + 1).fill(INF);
  const rows = [];
  previous[0] = 0;

  for (let i = 1; i <= n; i += 1) {
    const current = new Float64Array(m + 1).fill(INF);
    const centre = Math.round((i * m) / n);
    const from = Math.max(1, centre - width);
    const to = Math.min(m, centre + width);

    for (let j = from; j <= to; j += 1) {
      const best = Math.min(previous[j], current[j - 1], previous[j - 1]);
      current[j] = best === INF ? INF : best + distance(a[i - 1], b[j - 1]);
    }
    rows.push(current);
    previous = current;
  }

  const total = previous[m];
  if (!Number.isFinite(total)) return { cost: Infinity, path: [] };

  /*
   * Normalised by path length rather than by sequence length: a longer
   * alignment naturally accumulates more cost, and without this a long ayah
   * would always look worse than a short one.
   */
  const path = tracePath(rows, n, m);
  return { cost: total / Math.max(1, path.length), path };
}

function tracePath(rows, n, m) {
  const path = [];
  let i = n;
  let j = m;

  while (i > 0 && j > 0) {
    path.push([i, j]);
    const up = i > 1 ? rows[i - 2][j] : Infinity;
    const left = rows[i - 1][j - 1];
    const diag = i > 1 ? rows[i - 2][j - 1] : Infinity;
    const best = Math.min(up, left, diag);

    if (best === diag) {
      i -= 1;
      j -= 1;
    } else if (best === up) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return path.reverse();
}

/**
 * The worst stretch of the alignment, as a fraction through the recitation.
 *
 * A mistake is local - a dropped word, a wrong ending - so the interesting
 * number is not the average cost but where the alignment is worst and how bad
 * it gets there.
 */
export function worstWindow(a, b, path, windowFrames = 50) {
  if (path.length === 0) return { at: 0, cost: 0 };

  const costs = path.map(([i, j]) => distance(a[i - 1], b[j - 1]));
  let best = { at: 0, cost: 0 };
  let running = 0;

  for (let end = 0; end < costs.length; end += 1) {
    running += costs[end];
    if (end >= windowFrames) running -= costs[end - windowFrames];
    const span = Math.min(end + 1, windowFrames);
    const mean = running / span;
    if (mean > best.cost) {
      best = { at: (end - span / 2) / costs.length, cost: mean };
    }
  }
  return best;
}
