import { SAVE_KEY } from './constants';
import type { Slot } from './items';

export interface SaveData {
  version: 1;
  seed: number;
  day: number;
  time: number;
  player: { x: number; y: number; hp: number; o2: number; hunger: number; energy: number; maxO2: number };
  inventory: (Slot | null)[];
  selected: number;
  story: { day: number; objIndex: number; dayComplete: boolean; flags: Record<string, number | boolean> };
  diffs: [number, number][];
  objectState: Record<string, number>;
  savedAt: number;
}

export function hasSave(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw) as SaveData;
    return d && d.version === 1;
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    return d.version === 1 ? d : null;
  } catch {
    return null;
  }
}

export function writeSave(d: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
