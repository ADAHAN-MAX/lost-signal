import { useEffect, useRef, useState } from 'react';
import { MenuScene } from '../game/MenuScene';
import { hasSave, readSave } from '../game/save';
import { audio } from '../game/audio';
import { Modal, SettingsPanel, ControlsPanel, click } from './Panels';

type Dialog = null | 'start' | 'overwrite' | 'settings' | 'controls' | 'exit';

export function MainMenu({ onNewGame, onContinue, onExit }: { onNewGame: () => void; onContinue: () => void; onExit: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [save, setSave] = useState(() => (hasSave() ? readSave() : null));

  useEffect(() => {
    const scene = new MenuScene(ref.current!);
    const onResize = () => scene.resize();
    window.addEventListener('resize', onResize);
    audio.setMusic('menu');
    return () => { scene.destroy(); window.removeEventListener('resize', onResize); };
  }, []);

  const start = () => {
    click();
    const s = hasSave() ? readSave() : null;
    setSave(s);
    if (s) setDialog('start');
    else onNewGame();
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-void">
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <canvas ref={ref} aria-label="Kepler-186f drifting in space" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <nav className="absolute inset-x-0 bottom-[12%] flex flex-col items-center gap-4">
        <button autoFocus className="px-btn pointer-events-auto w-72 max-w-[80vw] text-sm" onClick={start}>START GAME</button>
        <button className="px-btn pointer-events-auto w-72 max-w-[80vw] text-sm" onClick={() => { click(); setDialog('settings'); }}>SETTINGS</button>
        <button className="px-btn danger pointer-events-auto w-72 max-w-[80vw] text-sm" onClick={() => { click(); setDialog('exit'); }}>EXIT GAME</button>
      </nav>
      <div className="font-pixel absolute bottom-3 left-3 text-[8px] text-white/35">v0.9 · KEPLER-186F</div>
      <div className="font-pixel absolute bottom-3 right-3 text-[8px] text-white/35">Original game · not affiliated with any studio</div>

      {dialog === 'start' && save && (
        <Modal onClose={() => setDialog(null)}>
          <h2 className="font-pixel mb-2 text-center text-lg text-sun">SAVE FOUND</h2>
          <p className="mb-6 text-center text-2xl text-lilac">
            Day {save.day}/10 · saved {new Date(save.savedAt).toLocaleString()}
          </p>
          <div className="flex flex-col gap-4">
            <button autoFocus className="px-btn text-xs" onClick={() => { click(); onContinue(); }}>CONTINUE</button>
            <button className="px-btn text-xs" onClick={() => { click(); setDialog('overwrite'); }}>NEW GAME</button>
            <button className="px-btn text-xs" onClick={() => { click(); setDialog(null); }}>BACK</button>
          </div>
        </Modal>
      )}
      {dialog === 'overwrite' && (
        <Modal onClose={() => setDialog('start')}>
          <h2 className="font-pixel mb-4 text-center text-base text-alert">START OVER?</h2>
          <p className="mb-6 text-center text-2xl">Your current save on Day {save?.day} will be erased.</p>
          <div className="flex gap-4">
            <button className="px-btn danger flex-1 text-xs" onClick={() => { click(); onNewGame(); }}>NEW GAME</button>
            <button autoFocus className="px-btn flex-1 text-xs" onClick={() => { click(); setDialog('start'); }}>CANCEL</button>
          </div>
        </Modal>
      )}
      {dialog === 'settings' && <SettingsPanel onClose={() => setDialog(null)} onControls={() => setDialog('controls')} />}
      {dialog === 'controls' && <ControlsPanel onClose={() => setDialog('settings')} />}
      {dialog === 'exit' && (
        <Modal onClose={() => setDialog(null)}>
          <h2 className="font-pixel mb-4 text-center text-base text-sun">LEAVE KEPLER-186F?</h2>
          <p className="mb-6 text-center text-2xl">Your progress is saved automatically.</p>
          <div className="flex gap-4">
            <button className="px-btn danger flex-1 text-xs" onClick={() => { click(); onExit(); }}>EXIT</button>
            <button autoFocus className="px-btn flex-1 text-xs" onClick={() => { click(); setDialog(null); }}>STAY</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ExitScreen({ onBack }: { onBack: () => void }) {
  useEffect(() => { audio.setMusic('none'); audio.setAmbient(0, 0); }, []);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-black p-6 text-center">
      <div className="font-pixel text-2xl text-alert blink">SIGNAL TERMINATED</div>
      <p className="max-w-md text-3xl text-lilac">Thanks for playing LOST SIGNAL: 10 DAYS. Your progress is saved — you can close this tab safely.</p>
      <button className="px-btn text-xs" onClick={() => { click(); onBack(); }}>RETURN TO MENU</button>
    </div>
  );
}
