/**
 * Lightweight statistics helpers for the compare view.
 * All inputs are proportions in [0,1] or already-fitted ATE values.
 *
 * We deliberately avoid pulling in a stats package — only normal-approx CIs
 * and z-test p-values are needed for the dashboard.
 */

const SQRT2 = Math.SQRT2;

/** Abramowitz & Stegun 7.1.26 approximation of erf. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y =
    1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

/** Two-sided p-value from a z statistic. */
export function twoSidedPFromZ(z: number): number {
  if (!isFinite(z)) return NaN;
  const p = 1 - erf(Math.abs(z) / SQRT2);
  return Math.max(0, Math.min(1, p));
}

/** Standard error for a single proportion p with sample size n. */
export function proportionSE(p: number, n: number): number {
  if (!isFinite(p) || !isFinite(n) || n <= 0) return NaN;
  const v = (p * (1 - p)) / n;
  return v > 0 ? Math.sqrt(v) : 0;
}

/** Wald 95% CI for a single proportion. */
export function proportionCI(
  p: number,
  n: number,
  z = 1.96
): { low: number; high: number } | null {
  const se = proportionSE(p, n);
  if (!isFinite(se)) return null;
  return { low: Math.max(0, p - z * se), high: Math.min(1, p + z * se) };
}

/**
 * Two-proportion z-test for the difference p1 − p2.
 * Returns the difference, its SE, 95% CI, and a two-sided p-value.
 */
export function diffOfProportions(
  p1: number,
  n1: number,
  p2: number,
  n2: number
): {
  diff: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  z: number;
  p: number;
} | null {
  if (![p1, p2, n1, n2].every(Number.isFinite) || n1 <= 0 || n2 <= 0) return null;
  const se1Sq = (p1 * (1 - p1)) / n1;
  const se2Sq = (p2 * (1 - p2)) / n2;
  const se = Math.sqrt(Math.max(0, se1Sq + se2Sq));
  const diff = p1 - p2;
  if (se === 0) {
    return { diff, se: 0, ciLow: diff, ciHigh: diff, z: 0, p: 1 };
  }
  const z = diff / se;
  const p = twoSidedPFromZ(z);
  return {
    diff,
    se,
    ciLow: diff - 1.96 * se,
    ciHigh: diff + 1.96 * se,
    z,
    p,
  };
}

/**
 * Recover a z statistic and p-value for an ATE that already has a
 * 95% CI attached. SE = (high − low) / (2 · 1.96).
 */
export function ateZAndP(
  ate: number,
  ciLow: number | null | undefined,
  ciHigh: number | null | undefined
): { se: number; z: number; p: number } | null {
  if (
    !Number.isFinite(ate) ||
    ciLow === null ||
    ciLow === undefined ||
    ciHigh === null ||
    ciHigh === undefined ||
    !Number.isFinite(ciLow) ||
    !Number.isFinite(ciHigh)
  )
    return null;
  const se = (ciHigh - ciLow) / (2 * 1.96);
  if (!Number.isFinite(se) || se <= 0) {
    return { se: 0, z: 0, p: 1 };
  }
  const z = ate / se;
  return { se, z, p: twoSidedPFromZ(z) };
}

/**
 * Difference of two ATEs assuming independence: SE = sqrt(se1^2 + se2^2).
 */
export function diffOfAtes(
  a: { ate: number; se: number },
  b: { ate: number; se: number }
): { diff: number; se: number; ciLow: number; ciHigh: number; z: number; p: number } | null {
  if (![a.ate, b.ate, a.se, b.se].every(Number.isFinite)) return null;
  const se = Math.sqrt(a.se * a.se + b.se * b.se);
  const diff = b.ate - a.ate;
  if (se === 0) return { diff, se: 0, ciLow: diff, ciHigh: diff, z: 0, p: 1 };
  const z = diff / se;
  return { diff, se, ciLow: diff - 1.96 * se, ciHigh: diff + 1.96 * se, z, p: twoSidedPFromZ(z) };
}

/** Format a p-value with the conventional "< 0.001" cutoff. */
export function formatP(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  if (p < 0.001) return "< 0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
}

/** Significance asterisks following the usual ***, **, *, ns convention. */
export function sigStars(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "";
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "ns";
}
