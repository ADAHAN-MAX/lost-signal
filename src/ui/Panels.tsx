import { useEffect, useState, type ReactNode } from 'react';
import { loadSettings, saveSettings, Settings } from '../game/settings';
import { audio } from '../game/audio';

export function click(): void {
  audio.unlock();
  audio.play('click');
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={`px-panel fadein w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[92vh] overflow-y-auto p-6`}>{children}</div>
    </div>
  );
}

export function SettingsPanel({ onClose, onControls }: { onClose: () => void; onControls: () => void }) {
  const [s, setS] = useState<Settings>(loadSettings());
  const [fs, setFs] = useState<boolean>(!!document.fullscreenElement);
  const [fsError, setFsError] = useState('');
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const update = (patch: Partial<Settings>) => {
    const n = { ...s, ...patch };
    setS(n);
    saveSettings(n);
  };
  const toggleFs = async () => {
    click();
    setFsError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFsError('Fullscreen is blocked in this window. Try opening the game in its own tab.');
    }
  };
  return (
    <Modal onClose={onClose}>
      <h2 className="font-pixel mb-6 text-center text-lg text-sun">SETTINGS</h2>
      <div className="space-y-5 text-2xl">
        <label className="block">
          <div className="mb-2 flex justify-between"><span>Music volume</span><span className="text-cyan">{Math.round(s.music * 100)}%</span></div>
          <input aria-label="Music volume" className="px-range w-full" type="range" min={0} max={100} value={Math.round(s.music * 100)} onChange={(e) => update({ music: Number(e.target.value) / 100 })} />
        </label>
        <label className="block">
          <div className="mb-2 flex justify-between"><span>Sound effects volume</span><span className="text-cyan">{Math.round(s.sfx * 100)}%</span></div>
          <input aria-label="Sound effects volume" className="px-range w-full" type="range" min={0} max={100} value={Math.round(s.sfx * 100)} onChange={(e) => update({ sfx: Number(e.target.value) / 100 })} onMouseUp={() => audio.play('pickup')} />
        </label>
        <div className="flex items-center justify-between">
          <span>Fullscreen</span>
          <button className="px-btn text-xs" onClick={toggleFs}>{fs ? 'ON' : 'OFF'}</button>
        </div>
        {fsError && <p className="text-xl text-alert">{fsError}</p>}
        <button className="px-btn w-full text-xs" onClick={() => { click(); onControls(); }}>SHOW KEYBOARD CONTROLS</button>
        <button className="px-btn w-full text-xs" onClick={() => { click(); onClose(); }}>DONE</button>
      </div>
    </Modal>
  );
}

const CONTROLS: [string, string][] = [
  ['A / D', 'Move left / right'],
  ['W / SPACE', 'Jump'],
  ['SHIFT', 'Sprint (uses energy)'],
  ['E', 'Interact (hold to repair)'],
  ['LEFT MOUSE', 'Mine / attack / place / use'],
  ['RIGHT MOUSE', 'Place block / use item'],
  ['1 - 9 / WHEEL', 'Select hotbar slot'],
  ['I / TAB', 'Inventory & crafting'],
  ['ESC', 'Pause menu'],
];

export function ControlsPanel({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2 className="font-pixel mb-5 text-center text-lg text-sun">CONTROLS</h2>
      <table className="w-full text-2xl">
        <tbody>
          {CONTROLS.map(([k, v]) => (
            <tr key={k} className="border-b border-white/5">
              <td className="py-1.5 pr-4"><span className="font-pixel bg-ink px-2 py-1 text-[10px] text-cyan">{k}</span></td>
              <td className="py-1.5">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xl text-lilac">Survive: keep oxygen up near the ship or in a lit, enclosed shelter. Eat rations. Build before nightfall.</p>
      <button className="px-btn mt-5 w-full text-xs" onClick={() => { click(); onClose(); }}>BACK</button>
    </Modal>
  );
}
