import type { GameState, Mood } from '../store/types';
import { samplesCollected, samplesAnalyzed } from './geology';

export interface Objective {
  id: string;
  text: string;
  done: (s: GameState) => boolean;
}

export interface DayDef {
  day: number;
  title: string;
  mission: string;
  briefing: { text: string; mood: Mood }[];
  objectives: Objective[];
  storm?: boolean;
  radiation?: boolean;
  outside: boolean;
}

const solved = (s: GameState, id: keyof GameState['minigames']) => s.minigames[id].solved.length > 0;

export const DAYS: DayDef[] = [
  {
    day: 1, title: 'Lost Signal', mission: 'MISSION 01 — RESTORE THE BASE', outside: false,
    briefing: [
      { text: "That storm damaged several systems. We've lost contact with Earth and our energy is low.", mood: 'worried' },
      { text: "Let's start by checking the Command Center. Walk with A/D or the arrow keys and press E to look at things.", mood: 'happy' },
    ],
    objectives: [
      { id: 'cc', text: 'Explore the Command Center: check the central computer', done: (s) => !!s.flags.ccComputer },
      { id: 'energy', text: 'Check the energy reserves', done: (s) => !!s.flags.energyChecked },
      { id: 'nova', text: 'Talk to NOVA', done: (s) => !!s.flags.talkedNova },
      { id: 'accept', text: 'Begin the first repair: accept a mission on the Mission Board', done: (s) => s.accepted.includes('m-oxygen') || s.completed.includes('m-oxygen') },
    ],
  },
  {
    day: 2, title: 'System Check', mission: 'MISSION 02 — CATCH YOUR BREATH', outside: false,
    briefing: [
      { text: 'Good morning! Our oxygen is still leaking. That is the most important thing to fix today.', mood: 'worried' },
      { text: 'The Oxygen Generator is in the Life Support room, to the right of the Power Room.', mood: 'curious' },
    ],
    objectives: [
      { id: 'oxy', text: 'Repair the oxygen system in Life Support', done: (s) => solved(s, 'oxygen') },
    ],
  },
  {
    day: 3, title: 'Power Down', mission: 'MISSION 03 — POWER DOWN', outside: false,
    briefing: [
      { text: "Half the base is still dark. The cables in the Power Room are a mess!", mood: 'thinking' },
      { text: 'If we reconnect the circuit, we can spend energy to light up the greenhouse.', mood: 'happy' },
    ],
    objectives: [
      { id: 'circuit', text: 'Fix the circuit in the Power Room', done: (s) => solved(s, 'circuit') },
      { id: 'lights', text: 'Use energy to turn on the Greenhouse lights', done: (s) => !!s.upgrades['greenhouse-lights'] },
    ],
  },
  {
    day: 4, title: 'Dust on the Horizon', mission: 'MISSION 04 — DUST ON THE HORIZON', outside: true,
    briefing: [
      { text: "Our solar panels are covered in red Martian dust. Time for your first trip outside!", mood: 'surprised' },
      { text: 'Collect your gear first: suit, oxygen, battery, radio and scanner. The Airlock checklist shows where they are.', mood: 'thinking' },
    ],
    objectives: [
      { id: 'gear', text: 'Collect all 5 pieces of expedition gear', done: (s) => ['spacesuit', 'o2tank', 'battery', 'radio', 'scanner'].every((k) => (s.inventory[k] ?? 0) > 0) },
      { id: 'solar', text: 'Clean and align the solar panels outside', done: (s) => solved(s, 'solar') },
      { id: 'sample', text: 'Make a first discovery: collect a rock or soil sample outside', done: (s) => samplesCollected(s) > 0 },
    ],
  },
  {
    day: 5, title: 'The Long Storm', mission: 'MISSION 05 — THE LONG STORM', outside: false, storm: true,
    briefing: [
      { text: "Look out the window! A huge dust storm is here. The panels won't get sunlight today.", mood: 'worried' },
      { text: "We have to choose carefully where our energy goes. Life support always comes first.", mood: 'thinking' },
    ],
    objectives: [
      { id: 'plan', text: 'Choose a storm power plan at the Power Console', done: (s) => !!s.flags.stormPlan },
      { id: 'seal', text: 'Seal the Airlock door', done: (s) => !!s.flags.airlockSealed },
    ],
  },
  {
    day: 6, title: 'Water Under Pressure', mission: 'MISSION 06 — WATER UNDER PRESSURE', outside: true,
    briefing: [
      { text: 'The storm is over! But our water tank is getting low, and the plants are hungry.', mood: 'curious' },
      { text: 'Grow some food in the greenhouse, then decide how we get more water.', mood: 'happy' },
    ],
    objectives: [
      { id: 'grow', text: 'Grow a plant in the Greenhouse Challenge', done: (s) => solved(s, 'greenhouse') },
      { id: 'water', text: 'Decide how to get water (Greenhouse water tank)', done: (s) => !!s.decisions.water },
    ],
  },
  {
    day: 7, title: 'Radiation Warning', mission: 'MISSION 07 — RADIATION WARNING', outside: false, radiation: true,
    briefing: [
      { text: "Alert! Scientists watching the Sun spotted a flare. A storm of tiny fast particles is coming.", mood: 'surprised' },
      { text: 'Water is great at blocking radiation. Carry 3 water containers into the Shelter, then power its shield.', mood: 'thinking' },
    ],
    objectives: [
      { id: 'tanks', text: 'Carry 3 water containers to the Shelter walls', done: (s) => Number(s.flags.tanksPlaced ?? 0) >= 3 },
      { id: 'shield', text: 'Power the Shelter shield', done: (s) => !!s.upgrades['shelter-shield'] },
      { id: 'cover', text: 'Take cover on the Shelter bench', done: (s) => !!s.flags.shelterDone },
    ],
  },
  {
    day: 8, title: 'Reading the Rocks', mission: 'MISSION 08 — READING THE ROCKS', outside: true,
    briefing: [
      { text: 'The particle storm has passed. Today is a science day!', mood: 'celebrating' },
      { text: 'Rocks on Mars hold clues about its past. Collect samples outside, then analyze them in the Science Lab. Good scientists study a site without spoiling it.', mood: 'curious' },
    ],
    objectives: [
      { id: 'rocks', text: 'Analyze 3 rock samples in the Rock Analyzer', done: (s) => samplesAnalyzed(s) >= 3 },
    ],
  },
  {
    day: 9, title: 'The Final Repair', mission: 'MISSION 09 — THE FINAL REPAIR', outside: true,
    briefing: [
      { text: 'Everything is ready for the big one: the antenna!', mood: 'happy' },
      { text: 'Power up the Comm Room at the far right of the base, then tune the radio to Earth.', mood: 'thinking' },
    ],
    objectives: [
      { id: 'comm', text: 'Power up the Comm Room door', done: (s) => !!s.upgrades['comm-power'] },
      { id: 'antenna', text: 'Restore the antenna signal', done: (s) => solved(s, 'antenna') },
    ],
  },
  {
    day: 10, title: 'Home Signal', mission: 'MISSION 10 — HOME SIGNAL', outside: true,
    briefing: [
      { text: 'Day ten! The antenna works and Earth is listening.', mood: 'celebrating' },
      { text: 'The big transmitter needs 40 energy. When you are ready, send the home signal!', mood: 'happy' },
    ],
    objectives: [
      { id: 'tx', text: 'Power the transmitter (40 energy)', done: (s) => !!s.upgrades.transmitter },
      { id: 'send', text: 'Send the home signal', done: (s) => !!s.flags.finalSignal },
    ],
  },
];

export function dayDef(day: number): DayDef {
  return DAYS[Math.max(1, Math.min(10, day)) - 1];
}
