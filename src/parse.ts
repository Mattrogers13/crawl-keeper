// Helpers for reading untrusted data (scene and room metadata: any client or
// extension can write it). No React or SDK imports: the rules modules and the
// background page use them.

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// A whole number in [min, max], else null.
export const intIn = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;

// A counter (rounds, crawl rounds): 0 to MAX_COUNT. Over the cap clamps, so
// a long game never resets its count; anything else is 0.
export const MAX_COUNT = 9999;
export const parseCount = (v: unknown): number => Math.min(intIn(v, 0, Infinity) ?? 0, MAX_COUNT);
