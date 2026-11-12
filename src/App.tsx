import { useEffect, useState } from 'react';
import { MainMenu, ExitScreen } from './ui/MainMenu';
import { GameView } from './ui/GameView';
import { IntroView, EndingView } from './ui/Cutscenes';
import { audio } from './game/audio';
import { loadSettings } from './game/settings';
import { clearSave } from './game/save';

type Screen = 'menu' | 'intro' | 'game' | 'ending' | 'exit';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<'new' | 'continue'>('new');
  const [runId, setRunId] = useState(0);

  // Browsers only allow audio after a user gesture: unlock on the first one.
  useEffect(() => {
    const s = loadSettings();
    const unlock = () => {
      audio.unlock();
      audio.setVolumes(s.music, s.sfx);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (screen === 'menu') audio.setMusic('menu');
  }, [screen]);

  return (
    <div className="h-full w-full">
      {screen === 'menu' && (
        <MainMenu
          onNewGame={() => { clearSave(); setMode('new'); setScreen('intro'); }}
          onContinue={() => { setMode('continue'); setRunId((r) => r + 1); setScreen('game'); }}
          onExit={() => setScreen('exit')}
        />
      )}
      {screen === 'intro' && <IntroView onDone={() => { setRunId((r) => r + 1); setScreen('game'); }} />}
      {screen === 'game' && (
        <GameView key={runId} mode={mode} onQuit={() => setScreen('menu')} onEnding={() => setScreen('ending')} />
      )}
      {screen === 'ending' && <EndingView onMenu={() => setScreen('menu')} />}
      {screen === 'exit' && <ExitScreen onBack={() => setScreen('menu')} />}
    </div>
  );
}
