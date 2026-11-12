import { SETTINGS_KEY } from './constants';
import { audio } from './audio';

export interface Settings {
  music: number; // 0..1
  sfx: number; // 0..1
}

const DEFAULTS: Settings = { music: 0.6, sfx: 0.8 };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  audio.setVolumes(s.music, s.sfx);
}
