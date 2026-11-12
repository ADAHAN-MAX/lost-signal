export const TILE = 16;
export const VIEW_H = 360;
export const WORLD_W = 420;
export const WORLD_H = 120;

/** Seconds of real time for one full in-game day (day + night). */
export const DAY_SECONDS = 300;
/** Day-fraction at which a new game starts (early morning). */
export const START_TIME = 0.07;
/** Day-fraction after which it's considered dusk / night. */
export const DUSK_START = 0.55;
export const NIGHT_START = 0.63;
export const DAWN_START = 0.95;

export const SAVE_KEY = 'lostsignal_save_v1';
export const SETTINGS_KEY = 'lostsignal_settings_v1';

export const REACH = 4.6 * TILE;

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
