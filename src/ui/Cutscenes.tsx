import { useEffect, useRef, useState } from 'react';
import { IntroScene } from '../game/IntroScene';
import { EndingScene } from '../game/EndingScene';
import { click } from './Panels';

export function IntroView({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useRef<IntroScene | null>(null);
  useEffect(() => {
    const s = new IntroScene(ref.current!, onDone);
    scene.current = s;
    const r = () => s.resize();
    window.addEventListener('resize', r);
    return () => { s.destroy(); window.removeEventListener('resize', r); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      <canvas ref={ref} aria-label="Introduction cutscene" />
      <button className="px-btn absolute bottom-5 right-5 text-[10px]" onClick={() => scene.current?.skip()}>SKIP INTRO ▸</button>
    </div>
  );
}

export function EndingView({ onMenu }: { onMenu: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const s = new EndingScene(ref.current!, () => setDone(true));
    const r = () => s.resize();
    window.addEventListener('resize', r);
    return () => { s.destroy(); window.removeEventListener('resize', r); };
  }, []);
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      <canvas ref={ref} aria-label="Ending cutscene and credits" />
      <button className={`px-btn absolute bottom-5 right-5 text-[10px] ${done ? '' : 'opacity-60'}`} onClick={() => { click(); onMenu(); }}>
        {done ? 'RETURN TO MENU' : 'SKIP ▸'}
      </button>
    </div>
  );
}
