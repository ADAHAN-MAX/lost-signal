import { T } from './tiles';

export type ItemKind = 'tool' | 'block' | 'resource' | 'consumable' | 'quest';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  tile?: number;
  desc: string;
  stack: number;
}

export const ITEMS: Record<string, ItemDef> = {
  multitool: { id: 'multitool', name: 'Multitool', kind: 'tool', desc: 'Standard-issue cutter. Slow, but it works.', stack: 1 },
  pickaxe: { id: 'pickaxe', name: 'Pickaxe', kind: 'tool', desc: 'Mines twice as fast. Breaks deep rock and metal ore.', stack: 1 },
  metal: { id: 'metal', name: 'Metal Scraps', kind: 'resource', desc: 'Salvaged hull plating and ore.', stack: 99 },
  stone: { id: 'stone', name: 'Alien Stone', kind: 'block', tile: T.STONE, desc: 'Dense violet rock. Can be placed.', stack: 99 },
  soil: { id: 'soil', name: 'Alien Soil', kind: 'block', tile: T.SOIL, desc: 'Loose purple soil. Can be placed.', stack: 99 },
  crystal: { id: 'crystal', name: 'Energy Crystal', kind: 'resource', desc: 'Hums with stored energy.', stack: 99 },
  organic: { id: 'organic', name: 'Organic Material', kind: 'resource', desc: 'Fibrous alien plant matter.', stack: 99 },
  wall: { id: 'wall', name: 'Shelter Wall', kind: 'block', tile: T.WALL, desc: 'Reinforced panel for shelters.', stack: 99 },
  light: { id: 'light', name: 'Light Source', kind: 'block', tile: T.LIGHT, desc: 'Crystal lamp. Lights and powers a shelter.', stack: 99 },
  repairkit: { id: 'repairkit', name: 'Repair Kit', kind: 'consumable', desc: 'Patches your suit. Restores 45 health.', stack: 20 },
  o2refill: { id: 'o2refill', name: 'Oxygen Refill', kind: 'consumable', desc: 'Restores 50 oxygen.', stack: 20 },
  ration: { id: 'ration', name: 'Ration', kind: 'consumable', desc: 'Processed alien plant paste. Restores 35 hunger.', stack: 20 },
  beaconcore: { id: 'beaconcore', name: 'Beacon Core', kind: 'quest', desc: 'Guides the rescue shuttle to your position.', stack: 1 },
  suitupgrade: { id: 'suitupgrade', name: 'Suit Upgrade', kind: 'quest', desc: 'Installed automatically.', stack: 1 },
  blackbox: { id: 'blackbox', name: 'Flight Recorder', kind: 'quest', desc: "The ARES-7's black box.", stack: 1 },
};

export interface Recipe {
  id: string;
  out: string;
  qty: number;
  needs: Record<string, number>;
  minDay?: number;
}

export const RECIPES: Recipe[] = [
  { id: 'pickaxe', out: 'pickaxe', qty: 1, needs: { metal: 3, stone: 2 } },
  { id: 'wall', out: 'wall', qty: 4, needs: { stone: 2, metal: 1 } },
  { id: 'light', out: 'light', qty: 1, needs: { crystal: 1, metal: 1 } },
  { id: 'ration', out: 'ration', qty: 1, needs: { organic: 2 } },
  { id: 'o2refill', out: 'o2refill', qty: 1, needs: { crystal: 2, organic: 1 } },
  { id: 'repairkit', out: 'repairkit', qty: 1, needs: { metal: 2, organic: 1, crystal: 1 } },
  { id: 'beaconcore', out: 'beaconcore', qty: 1, needs: { metal: 6, crystal: 4 }, minDay: 8 },
  { id: 'suitupgrade', out: 'suitupgrade', qty: 1, needs: { metal: 4, crystal: 3, organic: 2 }, minDay: 8 },
];

export interface Slot {
  id: string;
  count: number;
}

export const SLOT_COUNT = 36;

export class Inventory {
  slots: (Slot | null)[] = new Array(SLOT_COUNT).fill(null);
  selected = 0;

  add(id: string, n: number): number {
    const def = ITEMS[id];
    if (!def) return n;
    for (let i = 0; i < SLOT_COUNT && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < def.stack) {
        const take = Math.min(def.stack - s.count, n);
        s.count += take;
        n -= take;
      }
    }
    for (let i = 0; i < SLOT_COUNT && n > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(def.stack, n);
        this.slots[i] = { id, count: take };
        n -= take;
      }
    }
    return n; // leftover
  }

  count(id: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  has(id: string, n = 1): boolean {
    return this.count(id) >= n;
  }

  remove(id: string, n: number): boolean {
    if (this.count(id) < n) return false;
    for (let i = SLOT_COUNT - 1; i >= 0 && n > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, n);
        s.count -= take;
        n -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return true;
  }

  canCraft(r: Recipe): boolean {
    return Object.entries(r.needs).every(([id, n]) => this.count(id) >= n);
  }

  swap(a: number, b: number): void {
    const t = this.slots[a];
    this.slots[a] = this.slots[b];
    this.slots[b] = t;
  }

  selectedItem(): Slot | null {
    return this.slots[this.selected];
  }

  bestTool(): 'pickaxe' | 'multitool' {
    return this.has('pickaxe') ? 'pickaxe' : 'multitool';
  }

  serialize(): (Slot | null)[] {
    return this.slots.map((s) => (s ? { ...s } : null));
  }

  load(data: (Slot | null)[]): void {
    this.slots = new Array(SLOT_COUNT).fill(null);
    data.slice(0, SLOT_COUNT).forEach((s, i) => {
      if (s && ITEMS[s.id]) this.slots[i] = { id: s.id, count: s.count };
    });
  }
}
