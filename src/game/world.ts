import { WORLD_W, WORLD_H, TILE, clamp, smoothstep } from './constants';
import { T, isSolid } from './tiles';
import { mulberry32, fbm1, noise1, hash2 } from './rng';

export type ObjKind =
  | 'ship' | 'transmitter' | 'debris' | 'relay' | 'terminal' | 'blackbox'
  | 'crate' | 'beacon' | 'datapad';

export interface WorldObject {
  id: string;
  kind: ObjKind;
  /** tile x (left) */
  tx: number;
  /** tile y of the floor the object stands on (object bottom = ty*TILE) */
  ty: number;
  w: number; // px
  h: number; // px
  variant?: number;
}

export const LOC = {
  shipX: 42,
  spawnX: 58,
  transmitterX: 93,
  relayX: 166,
  stationL: 256,
  stationR: 284,
  terminalX: 270,
  blackboxX: 115,
  cacheX: 206,
  peakX: 398,
};

export class World {
  w = WORLD_W;
  h = WORLD_H;
  tiles = new Uint8Array(WORLD_W * WORLD_H);
  base = new Uint8Array(WORLD_W * WORLD_H);
  back = new Uint8Array(WORLD_W * WORLD_H); // 1 = station interior
  surface = new Int16Array(WORLD_W); // generated surface (first ground tile)
  top = new Int16Array(WORLD_W); // live first-solid row per column (for sky light)
  objects: WorldObject[] = [];
  diffs = new Map<number, number>();
  version = 0;

  variant = new Uint8Array(WORLD_W * WORLD_H);

  constructor(public seed: number) {
    this.generate();
    for (let i = 0; i < this.variant.length; i++) this.variant[i] = Math.floor(hash2(i % this.w, Math.floor(i / this.w), seed) * 4);
    this.base.set(this.tiles);
    for (let x = 0; x < this.w; x++) this.recomputeTop(x);
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T.BEDROCK;
    return this.tiles[y * this.w + x];
  }

  solid(x: number, y: number): boolean {
    return isSolid(this.get(x, y));
  }

  solidAtPx(px: number, py: number): boolean {
    return this.solid(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  set(x: number, y: number, t: number): void {
    if (x <= 0 || y <= 0 || x >= this.w - 1 || y >= this.h - 1) return;
    const i = y * this.w + x;
    this.tiles[i] = t;
    if (this.base[i] === t) this.diffs.delete(i);
    else this.diffs.set(i, t);
    this.recomputeTop(x);
    this.version++;
  }

  recomputeTop(x: number): void {
    let y = 0;
    while (y < this.h && !isSolid(this.tiles[y * this.w + x])) y++;
    this.top[x] = y;
  }

  applyDiffs(list: [number, number][]): void {
    for (const [i, t] of list) {
      if (i < 0 || i >= this.tiles.length) continue;
      this.tiles[i] = t;
      if (this.base[i] !== t) this.diffs.set(i, t);
    }
    for (let x = 0; x < this.w; x++) this.recomputeTop(x);
    this.version++;
  }

  groundY(x: number): number {
    // first solid tile from the top at column x
    return this.top[clamp(x, 0, this.w - 1)];
  }

  // ---------------- generation ----------------
  private generate(): void {
    const W = this.w, H = this.h, seed = this.seed;
    const r = mulberry32(seed);
    const hf = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      let h = 46 + (fbm1(x * 0.025, seed, 4) - 0.5) * 16 + (noise1(x * 0.11, seed + 7) - 0.5) * 3;
      const m = smoothstep(318, 396, x);
      h -= m * 30;
      h -= Math.sin(x * 0.09) * m * 2;
      hf[x] = h;
    }
    const flatten = (a: number, b: number, v: number, soft = 6) => {
      for (let x = a - soft; x <= b + soft; x++) {
        if (x < 0 || x >= W) continue;
        const k = x < a ? 1 - (a - x) / soft : x > b ? 1 - (x - b) / soft : 1;
        hf[x] = hf[x] * (1 - k) + v * k;
      }
    };
    flatten(30, 72, 47, 10);
    flatten(88, 98, 45, 6);
    flatten(LOC.stationL - 4, LOC.stationR + 4, 46, 8);
    const peakH = Math.round(hf[LOC.peakX]);
    flatten(LOC.peakX - 6, LOC.peakX + 6, peakH, 4);
    const hgt = new Int16Array(W);
    for (let x = 0; x < W; x++) hgt[x] = Math.round(hf[x]);
    // keep slopes walkable (max 1 tile per column)
    for (let pass = 0; pass < 4; pass++) {
      for (let x = 1; x < W; x++) if (hgt[x] - hgt[x - 1] > 1) hgt[x] = hgt[x - 1] + 1;
      for (let x = W - 2; x >= 0; x--) if (hgt[x] - hgt[x + 1] > 1) hgt[x] = hgt[x + 1] + 1;
    }
    this.surface.set(hgt);

    // fill terrain
    for (let x = 0; x < W; x++) {
      const soilDepth = 3 + Math.floor(noise1(x * 0.2, seed + 3) * 3);
      const deepLine = 86 + Math.floor(noise1(x * 0.05, seed + 5) * 8);
      for (let y = 0; y < H; y++) {
        let t: number = T.AIR;
        const d = y - hgt[x];
        if (d >= 0) {
          t = d < soilDepth ? T.SOIL : y > deepLine ? T.DEEP : T.STONE;
        }
        if (y >= H - 2 || ((x <= 1 || x >= W - 2) && d >= 0)) t = T.BEDROCK;
        this.tiles[y * W + x] = t;
      }
    }

    const set = (x: number, y: number, t: number) => {
      if (x <= 1 || y <= 0 || x >= W - 2 || y >= H - 2) return;
      this.tiles[y * W + x] = t;
    };
    const get = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? T.BEDROCK : this.tiles[y * W + x]);
    const protectedAt = (x: number, y: number) =>
      (x >= 28 && x <= 104 && y < hgt[x] + 12) ||
      (x >= LOC.stationL - 6 && x <= LOC.stationR + 6 && y < hgt[x] + 8) ||
      (x >= LOC.peakX - 8 && x <= LOC.peakX + 8 && y < hgt[x] + 6);
    const carve = (cx: number, cy: number, rad: number, allowSurface: boolean) => {
      const R = Math.ceil(rad);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > rad * rad) continue;
        const x = Math.round(cx + dx), y = Math.round(cy + dy);
        if (x <= 2 || x >= W - 3 || y >= H - 3) continue;
        if (!allowSurface && y < hgt[x] + 3) continue;
        if (protectedAt(x, y)) continue;
        if (get(x, y) !== T.BEDROCK) set(x, y, T.AIR);
      }
    };

    // worm caves
    for (let i = 0; i < 34; i++) {
      let x = 20 + r() * (W - 40);
      let y = hgt[Math.floor(x)] + 10 + r() * 50;
      let ang = r() * Math.PI * 2;
      const len = 70 + r() * 160;
      for (let s = 0; s < len; s++) {
        const rad = 1.3 + noise1(s * 0.1 + i * 10, seed + 9) * 2.2;
        carve(x, y, rad, false);
        ang += (r() - 0.5) * 0.5;
        ang = ang * 0.97 + (Math.sin(ang) > 0 ? 0 : Math.PI) * 0.0; // gentle drift
        x += Math.cos(ang);
        y += Math.sin(ang) * 0.6;
        if (y > H - 6) ang = -Math.abs(ang);
        if (x < 4 || x > W - 4) break;
      }
    }
    // cave entrances from the surface
    for (const ex of [128, 186, 232, 312, 352]) {
      let x = ex, y = hgt[ex] - 1;
      const dir = r() < 0.5 ? 1 : -1;
      for (let s = 0; s < 40; s++) {
        carve(x, y, 1.6, true);
        x += dir * (0.6 + r() * 0.5);
        y += 0.8;
      }
    }

    // ore blobs
    const blob = (t: number, count: number, minDepth: number, size: number) => {
      for (let i = 0; i < count; i++) {
        const x = 3 + Math.floor(r() * (W - 6));
        const y = hgt[x] + minDepth + Math.floor(r() * (H - hgt[x] - minDepth - 3));
        const n = 2 + Math.floor(r() * size);
        let bx = x, by = y;
        for (let k = 0; k < n; k++) {
          const cur = get(bx, by);
          if (cur === T.STONE || cur === T.DEEP) set(bx, by, t);
          bx += Math.floor(r() * 3) - 1;
          by += Math.floor(r() * 3) - 1;
        }
      }
    };
    blob(T.METAL_ORE, 110, 7, 5);
    blob(T.CRYSTAL, 60, 12, 3);
    // crystals growing on cave walls
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (get(x, y) !== T.STONE) continue;
      if (y < hgt[x] + 8) continue;
      const exposed = get(x, y - 1) === T.AIR || get(x, y + 1) === T.AIR || get(x - 1, y) === T.AIR || get(x + 1, y) === T.AIR;
      if (exposed && hash2(x, y, seed) < 0.03) set(x, y, T.CRYSTAL);
    }

    // ---- tutorial crystal crater near the crash ----
    {
      const cx = 77, g = hgt[cx];
      for (let x = cx - 3; x <= cx + 3; x++) {
        const depth = 3 - Math.floor(Math.abs(x - cx) / 1.5);
        for (let y = g; y < g + depth; y++) set(x, y, T.AIR);
      }
      set(cx - 1, g + 3, T.CRYSTAL);
      set(cx, g + 3, T.CRYSTAL);
      set(cx + 1, g + 3, T.CRYSTAL);
      set(cx + 2, g + 2, T.CRYSTAL);
      set(cx - 2, g + 2, T.STONE);
    }

    // ---- wreck fragments scattered around the crash site ----
    for (const wx of [33, 36, 66, 72, 84, 88, 100, 106, 110]) {
      const g = this.firstSolid(wx);
      set(wx, g - 1, T.WRECK);
      if (wx % 3 === 0) set(wx + 1, g - 1, T.WRECK);
    }

    // ---- relay chamber (Day 4) ----
    {
      const rx = LOC.relayX, top = hgt[rx] + 15;
      for (let x = rx - 5; x <= rx + 5; x++) for (let y = top - 6; y <= top + 2; y++) {
        const edge = x === rx - 5 || x === rx + 5 || y === top - 6 || y === top + 2;
        set(x, y, edge ? T.DEEP : T.AIR);
      }
      for (let x = rx - 5; x <= rx + 5; x++) set(x, top + 1, T.DEEP);
      // tunnel from the surface down to the chamber
      let x = rx - 18, y = hgt[rx - 18] - 1;
      while (x < rx - 4) {
        for (let dy = -1; dy <= 1; dy++) set(Math.round(x), Math.round(y) + dy, T.AIR);
        set(Math.round(x), Math.round(y) + 2, get(Math.round(x), Math.round(y) + 2) === T.AIR ? T.STONE : get(Math.round(x), Math.round(y) + 2));
        x += 1;
        if (y < top - 1) y += 1;
      }
      set(rx - 5, top, T.AIR); set(rx - 5, top - 1, T.AIR); set(rx - 5, top - 2, T.AIR);
      this.objects.push({ id: 'relay', kind: 'relay', tx: rx - 1, ty: top + 1, w: 26, h: 44 });
    }

    // ---- black box hidden chamber (Day 7) ----
    {
      const bx = LOC.blackboxX, top = hgt[bx] + 22;
      for (let x = bx - 6; x <= bx + 6; x++) for (let y = top - 6; y <= top + 3; y++) set(x, y, T.DEEP);
      for (let x = bx - 3; x <= bx + 3; x++) for (let y = top - 3; y <= top; y++) set(x, y, T.AIR);
      set(bx - 3, top - 3, T.CRYSTAL); set(bx + 3, top - 3, T.CRYSTAL);
      this.objects.push({ id: 'blackbox', kind: 'blackbox', tx: bx, ty: top + 1, w: 14, h: 11 });
    }

    // ---- hidden cache ----
    {
      const cx = LOC.cacheX, top = hgt[cx] + 18;
      for (let x = cx - 5; x <= cx + 5; x++) for (let y = top - 5; y <= top + 2; y++) set(x, y, T.DEEP);
      for (let x = cx - 3; x <= cx + 3; x++) for (let y = top - 3; y <= top; y++) set(x, y, T.AIR);
      set(cx - 3, top, T.CRYSTAL); set(cx + 3, top, T.CRYSTAL); set(cx, top - 3, T.CRYSTAL);
      this.objects.push({ id: 'cacheCrate', kind: 'crate', tx: cx - 1, ty: top + 1, w: 16, h: 14 });
      this.objects.push({ id: 'logCache', kind: 'datapad', tx: cx + 1, ty: top + 1, w: 12, h: 8 });
    }

    // ---- abandoned research station (Day 5) ----
    {
      const L = LOC.stationL, R = LOC.stationR, g = hgt[L + 5];
      for (let x = L - 2; x <= R + 2; x++) {
        for (let y = 2; y < g; y++) set(x, y, T.AIR);
        for (let y = g; y < g + 3; y++) set(x, y, y === g ? T.STATION : T.STONE);
      }
      for (let y = g - 9; y < g; y++) { set(L, y, T.STATION); set(R, y, T.STATION); }
      for (let x = L; x <= R; x++) set(x, g - 9, T.STATION);
      // doorways
      for (let y = g - 3; y < g; y++) { set(L, y, T.AIR); set(R, y, T.AIR); }
      // mezzanine
      for (let x = L + 5; x <= L + 11; x++) set(x, g - 5, T.STATION);
      for (let x = L + 1; x < R; x++) for (let y = g - 8; y < g; y++) this.back[y * W + x] = 1;
      this.objects.push({ id: 'terminal', kind: 'terminal', tx: LOC.terminalX, ty: g, w: 18, h: 22 });
      this.objects.push({ id: 'stationCrate1', kind: 'crate', tx: L + 3, ty: g, w: 16, h: 14 });
      this.objects.push({ id: 'stationCrate2', kind: 'crate', tx: R - 4, ty: g, w: 16, h: 14 });
      this.objects.push({ id: 'logStation', kind: 'datapad', tx: L + 8, ty: g - 5, w: 12, h: 8 });
      for (let x = L; x <= R; x++) hgt[x] = g;
    }

    // ---- rescue peak (Day 10) ----
    {
      const px = LOC.peakX, g = this.firstSolid(px);
      for (let x = px - 4; x <= px + 4; x++) {
        for (let y = 2; y < g; y++) set(x, y, T.AIR);
        for (let y = g; y < g + 3; y++) set(x, y, T.STONE);
        hgt[x] = g;
      }
      this.objects.push({ id: 'beacon', kind: 'beacon', tx: px - 1, ty: g, w: 52, h: 44 });
    }

    // ---- trees and plants ----
    const blocked = (x: number) =>
      (x > 28 && x < 104) || (x > LOC.stationL - 6 && x < LOC.stationR + 6) || (x > LOC.peakX - 8 && x < LOC.peakX + 8) || x < 6 || x > W - 6;
    let tx = 8;
    while (tx < W - 8) {
      tx += 6 + Math.floor(r() * 9);
      if (blocked(tx)) continue;
      const g = this.firstSolid(tx);
      if (get(tx, g) !== T.SOIL || this.firstSolid(tx - 1) !== g || this.firstSolid(tx + 1) !== g) continue;
      const th = 4 + Math.floor(r() * 4);
      for (let k = 1; k <= th; k++) set(tx, g - k, T.TRUNK);
      const ty = g - th;
      for (let dy = -3; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy * 1.2 > 6) continue;
        if (get(tx + dx, ty + dy) === T.AIR) set(tx + dx, ty + dy, T.LEAVES);
      }
    }
    for (let x = 3; x < W - 3; x++) {
      if (x > LOC.stationL - 2 && x < LOC.stationR + 2) continue;
      const g = this.firstSolid(x);
      if (get(x, g) === T.SOIL && get(x, g - 1) === T.AIR && hash2(x, 3, seed) < 0.33) set(x, g - 1, T.PLANT);
    }
    // plants in caves
    for (let y = 4; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
      if (get(x, y) === T.AIR && (get(x, y + 1) === T.STONE || get(x, y + 1) === T.SOIL) && y > hgt[x] + 6 && hash2(x, y, seed + 1) < 0.06) set(x, y, T.PLANT);
    }

    // ---- surface objects ----
    const place = (id: string, kind: ObjKind, x: number, w: number, h: number, variant = 0) => {
      const g = this.firstSolid(x);
      this.objects.push({ id, kind, tx: x, ty: g, w, h, variant });
    };
    place('ship', 'ship', LOC.shipX, 184, 76);
    place('transmitter', 'transmitter', LOC.transmitterX, 36, 52);
    place('debris1', 'debris', 38, 20, 12, 0);
    place('debris2', 'debris', 62, 20, 12, 1);
    place('debris3', 'debris', 69, 20, 12, 2);
    place('debris4', 'debris', 103, 20, 12, 3);
    place('logShip', 'datapad', 64, 12, 8);
    // clear space above objects
    for (const o of this.objects) {
      if (o.kind === 'ship') continue;
      const wt = Math.ceil(o.w / TILE), ht = Math.ceil(o.h / TILE);
      for (let x = o.tx; x < o.tx + wt; x++) for (let y = o.ty - ht; y < o.ty; y++) {
        const t = get(x, y);
        if (t !== T.STATION && t !== T.AIR) set(x, y, T.AIR);
      }
    }
    this.surface.set(hgt);
  }

  firstSolid(x: number): number {
    let y = 0;
    while (y < this.h && !isSolid(this.tiles[y * this.w + x])) y++;
    return y;
  }

  isCave(x: number, y: number): boolean {
    return y > this.surface[clamp(x, 0, this.w - 1)] + 1;
  }
}
