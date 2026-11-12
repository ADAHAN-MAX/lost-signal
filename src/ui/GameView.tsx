import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, GameEvent, InvSnapshot } from '../game/Game';
import { ITEMS } from '../game/items';
import { getAssets } from '../game/art/assets';
import { SettingsPanel, ControlsPanel, click } from './Panels';

type Overlay = 'none' | 'inventory' | 'pause' | 'settings' | 'controls';

export function GameView({ mode, onQuit, onEnding }: { mode: 'new' | 'continue'; onQuit: () => void; onEnding: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [snap, setSnap] = useState<InvSnapshot | null>(null);
  const [saved, setSaved] = useState(0);
  const [controlsBack, setControlsBack] = useState<'pause' | 'settings'>('pause');
  const overlayRef = useRef<Overlay>('none');
  overlayRef.current = overlay;

  useEffect(() => {
    const g = new Game(ref.current!, mode, (e: GameEvent) => {
      if (e.type === 'overlay') {
        if (e.value === 'inventory') setSnap(g.snapshot());
        if (e.value !== 'none' || overlayRef.current === 'inventory' || overlayRef.current === 'pause') setOverlay(e.value);
      }
      if (e.type === 'inventory' && overlayRef.current === 'inventory') setSnap(g.snapshot());
      if (e.type === 'saved') setSaved(Date.now());
      if (e.type === 'ending') onEnding();
    });
    game.current = g;
    (window as unknown as { __lostSignal?: Game }).__lostSignal = g; // handy for debugging in the console
    const onResize = () => g.resize();
    window.addEventListener('resize', onResize);
    return () => { g.destroy(); window.removeEventListener('resize', onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resume = useCallback(() => {
    setOverlay('none');
    game.current?.closeOverlay();
  }, []);

  // keyboard handling while an overlay is open
  useEffect(() => {
    if (overlay !== 'inventory' && overlay !== 'pause') return;
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || (overlay === 'inventory' && (e.code === 'KeyI' || e.code === 'Tab'))) {
        e.preventDefault();
        resume();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [overlay, resume]);

  const showSaved = Date.now() - saved < 1800;

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <canvas ref={ref} className="cursor-crosshair" aria-label="Lost Signal game view" />
      {showSaved && (
        <div key={saved} className="font-pixel fadein pointer-events-none absolute bottom-3 right-3 text-[9px] text-cyan/80">SAVED ✓</div>
      )}
      {overlay === 'inventory' && snap && game.current && (
        <InventoryOverlay snap={snap} game={game.current} onClose={resume} />
      )}
      {overlay === 'pause' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
          <div className="px-panel fadein flex w-80 flex-col gap-4 p-6">
            <h2 className="font-pixel mb-2 text-center text-lg text-sun">PAUSED</h2>
            <button autoFocus className="px-btn text-xs" onClick={() => { click(); resume(); }}>RESUME</button>
            <button className="px-btn text-xs" onClick={() => { click(); setOverlay('settings'); }}>SETTINGS</button>
            <button className="px-btn text-xs" onClick={() => { click(); setControlsBack('pause'); setOverlay('controls'); }}>CONTROLS</button>
            <button className="px-btn danger text-xs" onClick={() => { click(); game.current?.saveGame(); onQuit(); }}>SAVE & QUIT TO MENU</button>
          </div>
        </div>
      )}
      {overlay === 'settings' && <SettingsPanel onClose={() => setOverlay('pause')} onControls={() => { setControlsBack('settings'); setOverlay('controls'); }} />}
      {overlay === 'controls' && <ControlsPanel onClose={() => setOverlay(controlsBack)} />}
    </div>
  );
}

function InventoryOverlay({ snap, game, onClose }: { snap: InvSnapshot; game: Game; onClose: () => void }) {
  const icons = getAssets().iconUrls;
  const [held, setHeld] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const clickSlot = (i: number) => {
    click();
    if (held === null) {
      if (snap.slots[i]) setHeld(i);
      if (i < 9) game.selectSlot(i);
    } else {
      if (held !== i) game.swapSlots(held, i);
      setHeld(null);
    }
  };
  const info = hover ? ITEMS[hover] : null;
  const count = (id: string) => snap.slots.reduce((n, s) => (s && s.id === id ? n + s.count : n), 0);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="px-panel fadein flex max-h-[94vh] w-full max-w-4xl flex-col gap-5 overflow-y-auto p-5 md:flex-row">
        <section className="flex-1">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-pixel text-base text-sun">INVENTORY</h2>
            <span className="text-xl text-lilac">click two slots to swap</span>
          </div>
          <div className="grid grid-cols-9 gap-1.5">
            {snap.slots.map((s, i) => (
              <button
                key={i}
                onClick={() => clickSlot(i)}
                onMouseEnter={() => setHover(s?.id ?? null)}
                className={`px-slot relative aspect-square ${i < 9 ? 'ring-1 ring-cyan/30' : ''} ${held === i ? 'outline outline-2 outline-sun' : ''} ${i === snap.selected ? 'bg-[#3a2f6b]' : ''}`}
                aria-label={s ? `${ITEMS[s.id].name} x${s.count}` : `Empty slot ${i + 1}`}
              >
                {i < 9 && <span className="font-pixel absolute left-0.5 top-0.5 text-[7px] text-white/40">{i + 1}</span>}
                {s && <img src={icons[s.id]} alt="" className="pixelated absolute inset-[18%] h-[64%] w-[64%]" />}
                {s && s.count > 1 && <span className="font-pixel absolute bottom-0.5 right-1 text-[8px] text-white">{s.count}</span>}
              </button>
            ))}
          </div>
          <div className="mt-3 min-h-[64px] border-t border-white/10 pt-2 text-xl">
            {info ? (<><div className="text-2xl text-cyan">{info.name}</div><div className="text-lilac">{info.desc}</div></>) : <div className="text-white/40">Hover an item to inspect it. The top row is your hotbar (keys 1–9).</div>}
          </div>
        </section>
        <section className="md:w-[340px]">
          <h2 className="font-pixel mb-3 text-base text-sun">CRAFTING</h2>
          <ul className="flex flex-col gap-2">
            {snap.recipes.map((r) => (
              <li key={r.id} className="px-slot flex items-center gap-3 p-2" onMouseEnter={() => setHover(r.out)}>
                <img src={icons[r.out]} alt="" className="pixelated h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="text-2xl leading-6">{ITEMS[r.out].name}{r.qty > 1 ? ` ×${r.qty}` : ''}</div>
                  <div className="flex flex-wrap gap-x-3 text-xl leading-5">
                    {r.locked ? <span className="text-white/40">Unlocks on Day 8</span> : Object.entries(r.needs).map(([id, n]) => (
                      <span key={id} className={count(id) >= n ? 'text-[#7dffb0]' : 'text-alert'}>
                        <img src={icons[id]} alt="" className="pixelated mr-1 inline h-4 w-4 align-[-2px]" />{count(id)}/{n}
                      </span>
                    ))}
                  </div>
                </div>
                <button className="px-btn px-3 py-2 text-[9px]" disabled={!r.can} onClick={() => game.craft(r.id)}>CRAFT</button>
              </li>
            ))}
          </ul>
          <button className="px-btn mt-4 w-full text-xs" onClick={() => { click(); onClose(); }}>CLOSE [I]</button>
        </section>
      </div>
    </div>
  );
}
