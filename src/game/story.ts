import { TILE } from './constants';
import { LOC } from './world';
import type { Game } from './Game';

export interface Objective {
  text: (g: Game) => string;
  done: (g: Game) => boolean;
  target?: (g: Game) => { x: number; y: number } | null;
  onStart?: (g: Game) => void;
  onDone?: (g: Game) => void;
}

export interface DayDef {
  title: string;
  mission: string;
  intro: string[];
  objectives: Objective[];
  complete: string[];
  noSleep?: boolean;
}

const objPos = (g: Game, id: string) => {
  const o = g.world.objects.find((x) => x.id === id);
  return o ? { x: o.tx * TILE + o.w / 2, y: o.ty * TILE - o.h / 2 } : null;
};
const flag = (g: Game, k: string) => g.story.flags[k];
const num = (g: Game, k: string) => Number(g.story.flags[k] ?? 0);
const near = (g: Game, id: string, tiles: number) => {
  const p = objPos(g, id);
  if (!p) return false;
  return Math.abs(g.player.cx - p.x) < tiles * TILE && Math.abs(g.player.cy - p.y) < (tiles + 2) * TILE;
};
const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export const DAYS: DayDef[] = [
  // DAY 1
  {
    title: 'THE CRASH',
    mission: 'MISSION 01: SEND SOS',
    intro: [],
    objectives: [
      {
        text: () => 'Find the damaged transmitter',
        done: (g) => !!flag(g, 'foundTransmitter'),
        target: (g) => objPos(g, 'transmitter'),
        onDone: (g) => {
          g.robot.scan();
          g.say('There it is - the long-range transmitter. Scanning...', 'B-07');
          g.say('It needs 3 metal scraps and 2 energy crystals. Search the debris [E] and mine crystals in the crater nearby.', 'B-07');
        },
      },
      {
        text: (g) => `Collect materials: metal ${Math.min(3, g.inv.count('metal'))}/3, crystals ${Math.min(2, g.inv.count('crystal'))}/2`,
        done: (g) => g.inv.count('metal') >= 3 && g.inv.count('crystal') >= 2,
        target: (g) => {
          if (g.inv.count('metal') < 3) {
            const d = g.world.objects.filter((o) => o.kind === 'debris' && !g.objState[o.id]);
            if (d.length) {
              d.sort((a, b) => Math.abs(a.tx * TILE - g.player.cx) - Math.abs(b.tx * TILE - g.player.cx));
              return objPos(g, d[0].id);
            }
          }
          if (g.inv.count('crystal') < 2) return { x: 77 * TILE + 8, y: (g.world.surface[77] + 2) * TILE };
          return null;
        },
        onDone: (g) => g.say('That should do it. Return to the transmitter and hold [E] to repair it.', 'B-07'),
      },
      {
        text: () => 'Repair the transmitter (hold E)',
        done: (g) => (g.objState.transmitter ?? 0) >= 1,
        target: (g) => objPos(g, 'transmitter'),
      },
      {
        text: () => 'Send an SOS signal (press E)',
        done: (g) => !!flag(g, 'sosDone'),
        target: (g) => objPos(g, 'transmitter'),
      },
    ],
    complete: [
      'Survival protocol: your oxygen drains outside. The ship\'s life support refills it - stay close.',
      'Press [I] to craft. A shelter before the second night would be wise, Captain.',
    ],
  },
  // DAY 2
  {
    title: 'FIRST SHELTER',
    mission: 'MISSION 02: FIRST SHELTER',
    intro: [
      'Good morning, Captain. Nights here are cold, and the air is thin.',
      'Let\'s build a shelter: craft a pickaxe, then shelter walls and a light source. Walls on both sides, and a roof.',
    ],
    objectives: [
      { text: () => 'Craft a pickaxe [I]', done: (g) => g.inv.has('pickaxe') || !!flag(g, 'hadPickaxe') },
      { text: (g) => `Place shelter walls (${Math.min(8, num(g, 'wallsPlaced'))}/8)`, done: (g) => num(g, 'wallsPlaced') >= 8 },
      { text: () => 'Place a light source inside', done: (g) => num(g, 'lightsPlaced') >= 1 },
      { text: () => 'Stand inside an enclosed, lit shelter', done: (g) => g.sheltered },
    ],
    complete: [
      'Shelter sealed. Inside, your suit recharges oxygen and energy.',
      'At night you can sleep here - press [E] at your light source.',
    ],
  },
  // DAY 3
  {
    title: 'FIRST CONTACT',
    mission: 'MISSION 03: FIRST CONTACT',
    intro: [
      'Captain... my sensors are picking up movement. Something is out there.',
      'Hostile lifeforms. Left-click to strike them. A pickaxe hits harder than the multitool.',
    ],
    objectives: [
      { text: (g) => `Defeat hostile creatures (${Math.min(3, num(g, 'kills'))}/3)`, done: (g) => num(g, 'kills') >= 3, target: (g) => g.nearestHostile() },
      { text: () => 'Craft a repair kit [I]', done: (g) => g.inv.has('repairkit') || !!flag(g, 'craftedRepair') },
    ],
    complete: ['Threat contained - for now. Keep a repair kit handy. Use it from your hotbar to heal.'],
  },
  // DAY 4
  {
    title: 'UNKNOWN SIGNAL',
    mission: 'MISSION 04: UNKNOWN SIGNAL',
    intro: [
      'Captain! I\'m detecting a transmission. It isn\'t ours... and it isn\'t from Earth.',
      'The source is underground, east of the crash site. There\'s a tunnel leading down.',
    ],
    objectives: [
      { text: () => 'Trace the unknown signal', done: (g) => near(g, 'relay', 3), target: (g) => objPos(g, 'relay'), onDone: (g) => g.robot.scan() },
      { text: () => 'Decode the alien relay [E]', done: (g) => !!flag(g, 'relayDecoded'), target: (g) => objPos(g, 'relay') },
    ],
    complete: ['The relay pointed to coordinates far to the east. Something built by humans.'],
  },
  // DAY 5
  {
    title: 'ABANDONED STATION',
    mission: 'MISSION 05: ABANDONED STATION',
    intro: [
      'Those coordinates lead to a research station, far east. Kepler Outpost.',
      'If we can restore its power, it could give us air and supplies.',
    ],
    objectives: [
      {
        text: () => 'Reach the abandoned research station',
        done: (g) => g.player.cx > LOC.stationL * TILE && g.player.cx < LOC.stationR * TILE,
        target: (g) => objPos(g, 'terminal'),
      },
      {
        text: (g) => `Restore station power: crystals ${Math.min(3, g.inv.count('crystal'))}/3 [E]`,
        done: (g) => (g.objState.terminal ?? 0) >= 1,
        target: (g) => objPos(g, 'terminal'),
      },
    ],
    complete: ['Life support online. The station refills your oxygen now.'],
  },
  // DAY 6
  {
    title: 'THE STORM',
    mission: 'MISSION 06: THE STORM',
    noSleep: true,
    intro: [
      'Captain, atmospheric pressure is dropping fast. A massive storm is coming.',
      'Get inside a shelter before it hits. The debris will shred your suit out in the open.',
    ],
    objectives: [
      {
        text: (g) => {
          if (g.storm.active) return `Survive the storm - stay sheltered (${fmt(g.storm.remaining)})`;
          if (flag(g, 'stormSurvived')) return 'Storm passed';
          return `Find shelter - storm arrives in ${fmt(g.storm.startsIn)}`;
        },
        done: (g) => !!flag(g, 'stormSurvived'),
      },
    ],
    complete: ['The storm has passed. Readings are stable again. Well done, Captain.'],
  },
  // DAY 7
  {
    title: 'HIDDEN TRUTH',
    mission: 'MISSION 07: HIDDEN TRUTH',
    intro: [
      'I\'ve been analyzing the crash data... Captain, we didn\'t just fall.',
      'The flight recorder was flung clear on impact. Its ping is deep underground, east of the ship. We\'ll have to dig.',
    ],
    objectives: [
      { text: () => 'Locate the flight recorder (dig down)', done: (g) => near(g, 'blackbox', 3) || !!flag(g, 'blackbox'), target: (g) => objPos(g, 'blackbox') },
      { text: () => 'Recover the flight recorder [E]', done: (g) => !!flag(g, 'blackbox'), target: (g) => objPos(g, 'blackbox') },
    ],
    complete: [],
  },
  // DAY 8
  {
    title: 'FINAL PREPARATIONS',
    mission: 'MISSION 08: FINAL PREPARATIONS',
    intro: [
      'Rescue is two days out. The shuttle will need a homing beacon to land.',
      'Let\'s build a Beacon Core - and upgrade your suit\'s oxygen tank while we\'re at it.',
    ],
    objectives: [
      { text: () => 'Craft a Beacon Core [I]', done: (g) => g.inv.has('beaconcore') || !!flag(g, 'craftedCore') },
      { text: () => 'Craft a Suit Upgrade [I]', done: (g) => !!flag(g, 'suitUpgraded') },
    ],
    complete: ['Suit upgraded: oxygen capacity increased. We\'re almost ready.'],
  },
  // DAY 9
  {
    title: 'THE LONGEST NIGHT',
    mission: 'MISSION 09: THE LONGEST NIGHT',
    noSleep: true,
    intro: [
      'Captain... the creatures are gathering. Tonight will be the longest night yet.',
      'Fortify your shelter, stock up on supplies, and hold out until dawn.',
    ],
    objectives: [
      { text: (g) => (g.isNight() ? 'Survive the longest night - hold out until dawn' : 'Prepare for the longest night'), done: (g) => !!flag(g, 'survived9') },
    ],
    complete: [],
  },
  // DAY 10
  {
    title: 'RESCUE',
    mission: 'MISSION 10: RESCUE',
    intro: [
      'Captain! The rescue shuttle has entered orbit!',
      'The landing zone is the highest peak, far east. Install the Beacon Core there and hold on until it lands.',
    ],
    objectives: [
      { text: () => 'Climb to the rescue peak (far east)', done: (g) => near(g, 'beacon', 5), target: (g) => objPos(g, 'beacon') },
      {
        text: (g) => (g.inv.has('beaconcore') ? 'Install the Beacon Core [E]' : 'Craft a Beacon Core [I], then install it [E]'),
        done: (g) => (g.objState.beacon ?? 0) >= 1,
        target: (g) => objPos(g, 'beacon'),
      },
      {
        text: (g) => `Defend the beacon until the shuttle lands (${Math.ceil(Math.max(0, g.rescueRemaining()))}s)`,
        done: (g) => !!flag(g, 'shuttleLanded'),
        target: (g) => objPos(g, 'beacon'),
      },
    ],
    complete: [],
  },
];

export class Story {
  day = 1;
  objIndex = 0;
  dayComplete = false;
  flags: Record<string, number | boolean> = {};

  get def(): DayDef {
    return DAYS[Math.min(this.day, 10) - 1];
  }

  current(): Objective | null {
    return this.dayComplete ? null : this.def.objectives[this.objIndex] ?? null;
  }

  update(g: Game): void {
    if (this.dayComplete) return;
    let guard = 0;
    while (!this.dayComplete && guard++ < 6) {
      const o = this.def.objectives[this.objIndex];
      if (!o) { this.finishDay(g); break; }
      if (!o.done(g)) break;
      o.onDone?.(g);
      this.objIndex++;
      g.onObjectiveDone();
      const next = this.def.objectives[this.objIndex];
      if (!next) this.finishDay(g);
      else next.onStart?.(g);
    }
  }

  private finishDay(g: Game): void {
    this.dayComplete = true;
    g.onDayComplete();
  }

  serialize() {
    return { day: this.day, objIndex: this.objIndex, dayComplete: this.dayComplete, flags: { ...this.flags } };
  }

  load(d: { day: number; objIndex: number; dayComplete: boolean; flags: Record<string, number | boolean> }): void {
    this.day = d.day;
    this.objIndex = d.objIndex;
    this.dayComplete = d.dayComplete;
    this.flags = { ...d.flags };
  }
}
