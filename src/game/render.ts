import { TILE, clamp, lerp } from './constants';
import { T, TILE_DEFS, isSolid } from './tiles';
import { hash2 } from './rng';
import { makeCanvas } from './art/canvas';
import type { Game } from './Game';
import type { WorldObject } from './world';

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

const SKY: { t: number; top: RGB; hor: RGB }[] = [
  { t: 0.0, top: hex('#120c2e'), hor: hex('#6a3a7a') },
  { t: 0.06, top: hex('#2c2a78'), hor: hex('#c27ad6') },
  { t: 0.5, top: hex('#2f3a8f'), hor: hex('#b48ae8') },
  { t: 0.58, top: hex('#2a1e5c'), hor: hex('#ff8a6b') },
  { t: 0.66, top: hex('#07051a'), hor: hex('#24174a') },
  { t: 0.94, top: hex('#07051a'), hor: hex('#24174a') },
  { t: 1.0, top: hex('#120c2e'), hor: hex('#6a3a7a') },
];

export function skyColors(t: number): { top: RGB; hor: RGB } {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i], b = SKY[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t);
      return { top: mix(a.top, b.top, k), hor: mix(a.hor, b.hor, k) };
    }
  }
  return { top: SKY[0].top, hor: SKY[0].hor };
}

const stars: { x: number; y: number; s: number; p: number }[] = [];
for (let i = 0; i < 160; i++) stars.push({ x: Math.random(), y: Math.random() * 0.7, s: Math.random() < 0.15 ? 2 : 1, p: Math.random() * 6 });

export function drawBackground(g: Game, ctx: CanvasRenderingContext2D): void {
  const W = g.W, H = g.H;
  const { top, hor } = skyColors(g.time);
  const storm = g.storm.intensity;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  const st: RGB = [40, 28, 50];
  grad.addColorStop(0, css(mix(top, st, storm * 0.7)));
  grad.addColorStop(1, css(mix(hor, st, storm * 0.7)));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const night = g.nightFactor();
  // stars
  if (night > 0.05) {
    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(g.elapsed * 2 + s.p);
      ctx.globalAlpha = night * tw * (1 - storm);
      ctx.fillStyle = s.s > 1 ? '#c8e6ff' : '#ffffff';
      const x = ((s.x * W * 1.5 - g.camX * 0.02) % W + W) % W;
      ctx.fillRect(Math.round(x), Math.round(s.y * H), s.s, s.s);
    }
    ctx.globalAlpha = 1;
    // aurora
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = night * 0.06 * (1 - storm);
      ctx.fillStyle = i === 1 ? '#6ff3ff' : '#b46cff';
      for (let x = 0; x < W; x += 4) {
        const y = 40 + i * 14 + Math.sin(x * 0.01 + g.elapsed * 0.3 + i) * 12;
        ctx.fillRect(x, Math.round(y), 4, 18);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  // ringed planet and moon in the sky
  const pa = g.assets.skyPlanet;
  ctx.globalAlpha = 0.9 * (1 - storm * 0.8);
  ctx.drawImage(pa, Math.round(W * 0.66 - g.camX * 0.01), Math.round(20 + Math.sin(g.time * Math.PI * 2) * 6));
  ctx.globalAlpha = (0.4 + night * 0.6) * (1 - storm);
  const moonA = g.time * Math.PI * 2;
  ctx.drawImage(g.assets.moon, Math.round(W * 0.2 + Math.cos(moonA) * 60), Math.round(60 - Math.sin(moonA) * 30));
  ctx.globalAlpha = 1;

  // mountain layers
  const factors = [0.12, 0.25, 0.42];
  const surfaceScreen = 46 * TILE - g.camY;
  g.assets.mountains.forEach((m, i) => {
    const f = factors[i];
    const ox = -((g.camX * f) % m.width);
    const y = Math.round(surfaceScreen * (0.25 + f) + H * (0.5 - (0.25 + f) * 0.5) - 150 + i * 14);
    for (let x = ox - m.width; x < W; x += m.width) ctx.drawImage(m, Math.round(x), y);
    const col = ['#2b2357', '#1f1942', '#151130'][i];
    ctx.fillStyle = col;
    if (y + m.height < H) ctx.fillRect(0, y + m.height - 1, W, H - (y + m.height) + 1);
  });
  // atmospheric tint by time of day
  const dusk = g.duskFactor();
  if (dusk > 0) {
    ctx.fillStyle = `rgba(255,120,110,${dusk * 0.12})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = `rgba(10,6,40,${night * 0.35})`;
  ctx.fillRect(0, 0, W, H);
}

export function drawObject(g: Game, ctx: CanvasRenderingContext2D, o: WorldObject, camX: number, camY: number): void {
  const a = g.assets;
  const st = g.objState[o.id] ?? 0;
  const x = Math.round(o.tx * TILE - camX);
  const yb = Math.round(o.ty * TILE - camY);
  switch (o.kind) {
    case 'ship': {
      ctx.drawImage(a.ship, x, yb - a.ship.height + 12);
      // smoke & sparks
      if (Math.random() < 0.35) g.particles.add({ x: o.tx * TILE + 100 + Math.random() * 20, y: o.ty * TILE - 34, vx: 8 + Math.random() * 6, vy: -18 - Math.random() * 10, max: 3, color: Math.random() < 0.5 ? '#3a3552' : '#4d4670', size: 2, fade: true });
      if (Math.random() < 0.05) g.particles.burst(o.tx * TILE + 108, o.ty * TILE - 30, '#ffb347', 4, 50, { glow: true });
      // blinking hull light
      if (Math.floor(g.elapsed * 1.5) % 2 === 0) { ctx.fillStyle = '#ff3d3d'; ctx.fillRect(x + 166, yb - 48, 2, 2); }
      break;
    }
    case 'transmitter': {
      const img = st >= 1 ? a.transmitterFixed : a.transmitterBroken;
      ctx.drawImage(img, x - 10, yb - img.height);
      if (st === 0 && Math.random() < 0.06) g.particles.burst(o.tx * TILE + 4, o.ty * TILE - 16, '#ffe08a', 3, 40, { glow: true });
      if (st >= 2) {
        const pulse = (g.elapsed * 0.8) % 1;
        ctx.strokeStyle = `rgba(111,243,255,${1 - pulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + 4, yb - 48, 6 + pulse * 30, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      break;
    }
    case 'debris': {
      const img = a.debris[(o.variant ?? 0) % 4];
      ctx.globalAlpha = st ? 0.55 : 1;
      ctx.drawImage(img, x - 2, yb - img.height + 1);
      ctx.globalAlpha = 1;
      if (!st && Math.floor(g.elapsed * 3 + o.tx) % 7 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 6, yb - 9, 1, 1); ctx.fillRect(x + 5, yb - 8, 3, 1); }
      break;
    }
    case 'relay': {
      ctx.drawImage(a.relay, x - 5, yb - a.relay.height);
      const on = g.story.day >= 4 || g.story.flags.relayDecoded;
      const glyphCol = on ? `rgba(180,108,255,${0.6 + Math.sin(g.elapsed * 3) * 0.4})` : 'rgba(80,60,120,0.6)';
      ctx.fillStyle = glyphCol;
      for (let gy = 12; gy < 40; gy += 6) ctx.fillRect(x + 5 + 10 - 5, yb - 44 + gy + 1, 6, 1);
      break;
    }
    case 'terminal':
      ctx.drawImage(st ? a.terminalOn : a.terminalOff, x, yb - 22);
      break;
    case 'blackbox':
      if (g.story.flags.blackbox) break;
      ctx.drawImage(a.blackbox, x, yb - 11);
      if (Math.floor(g.elapsed * 2) % 2 === 0) { ctx.fillStyle = '#ff3d3d'; ctx.fillRect(x + 6, yb - 12, 2, 1); }
      break;
    case 'crate':
      ctx.drawImage(st ? a.crateOpen : a.crate, x, yb - 14);
      break;
    case 'datapad':
      ctx.drawImage(a.datapad, x, yb - 8);
      if (!st && Math.floor(g.elapsed * 2) % 2 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, yb - 6, 2, 1); }
      break;
    case 'beacon': {
      ctx.drawImage(st ? a.beaconOn : a.beaconOff, x - 10, yb - 44);
      if (st >= 1) {
        ctx.globalCompositeOperation = 'lighter';
        const w = 4 + Math.sin(g.elapsed * 6) * 1.5;
        ctx.fillStyle = 'rgba(111,243,255,0.25)';
        ctx.fillRect(Math.round(x + 16 - w / 2), 0, Math.round(w), yb - 36);
        ctx.fillStyle = 'rgba(200,250,255,0.5)';
        ctx.fillRect(x + 15, 0, 2, yb - 36);
        ctx.globalCompositeOperation = 'source-over';
      }
      break;
    }
  }
}

export function drawBackTiles(g: Game, ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const a = g.assets;
  const w = g.world;
  const x0 = Math.floor(camX / TILE) - 1, x1 = Math.ceil((camX + g.W) / TILE) + 1;
  const y0 = Math.floor(camY / TILE) - 1, y1 = Math.ceil((camY + g.H) / TILE) + 1;
  // background walls (caves & station)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
    const t = w.tiles[y * w.w + x];
    if (isSolid(t)) continue;
    const sx = x * TILE - camX, sy = y * TILE - camY;
    if (w.back[y * w.w + x] === 1) ctx.drawImage(a.stationBg, Math.round(sx), Math.round(sy));
    else if (w.isCave(x, y)) ctx.drawImage(a.caveBg[w.variant[y * w.w + x]], Math.round(sx), Math.round(sy));
  }
}

export function drawTiles(g: Game, ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const a = g.assets;
  const w = g.world;
  const x0 = Math.floor(camX / TILE) - 1, x1 = Math.ceil((camX + g.W) / TILE) + 1;
  const y0 = Math.floor(camY / TILE) - 1, y1 = Math.ceil((camY + g.H) / TILE) + 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
    const t = w.tiles[y * w.w + x];
    if (t === T.AIR) continue;
    const v = w.variant[y * w.w + x];
    const sx = Math.round(x * TILE - camX), sy = Math.round(y * TILE - camY);
    const img = a.tiles[t][t === T.PLANT ? (hash2(x, y, 9) * 4) | 0 : v];
    if (t === T.PLANT || t === T.LEAVES) {
      const sway = Math.round(Math.sin(g.elapsed * 1.8 + x * 0.7 + y) * (g.storm.intensity * 2 + 1));
      ctx.drawImage(img, 0, 0, 16, 9, sx + sway, sy, 16, 9);
      ctx.drawImage(img, 0, 9, 16, 7, sx, sy + 9, 16, 7);
      continue;
    }
    ctx.drawImage(img, sx, sy);
    if (!isSolid(t)) continue;
    // exposed edges
    const up = w.get(x, y - 1), dn = w.get(x, y + 1), lf = w.get(x - 1, y), rt = w.get(x + 1, y);
    ctx.fillStyle = 'rgba(10,6,22,0.55)';
    if (!isSolid(lf)) ctx.fillRect(sx, sy, 1, 16);
    if (!isSolid(rt)) ctx.fillRect(sx + 15, sy, 1, 16);
    if (!isSolid(dn)) ctx.fillRect(sx, sy + 15, 16, 1);
    if (!isSolid(up)) {
      if (t === T.SOIL) ctx.drawImage(a.grass[v], sx, sy - 3);
      else { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx, sy, 16, 1); }
    }
  }
}

// ---------------- lighting ----------------
let lightCanvas: HTMLCanvasElement | null = null;
let lightCtx: CanvasRenderingContext2D | null = null;
let lightBuf = new Float32Array(0);
let lightImg: ImageData | null = null;

export function drawLighting(g: Game, ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const w = g.world;
  const M = 10;
  const x0 = Math.floor(camX / TILE) - M, y0 = Math.floor(camY / TILE) - M;
  const RW = Math.ceil(g.W / TILE) + M * 2 + 1, RH = Math.ceil(g.H / TILE) + M * 2 + 1;
  if (!lightCanvas || lightCanvas.width !== RW || lightCanvas.height !== RH) {
    [lightCanvas, lightCtx] = makeCanvas(RW, RH);
    lightBuf = new Float32Array(RW * RH);
    lightImg = lightCtx.createImageData(RW, RH);
  }
  const L = lightBuf;
  const amb = g.ambientLight();
  for (let j = 0; j < RH; j++) for (let i = 0; i < RW; i++) {
    const wx = x0 + i, wy = y0 + j;
    let v = 0;
    if (wx >= 0 && wx < w.w && wy >= 0 && wy < w.h) {
      const t = w.tiles[wy * w.w + wx];
      if (wy < w.top[wx]) v = amb;
      const e = TILE_DEFS[t].light;
      if (e) v = Math.max(v, t === T.CRYSTAL ? e * (0.85 + 0.15 * Math.sin(g.elapsed * 2 + wx)) : e);
      if (w.back[wy * w.w + wx] === 1 && (g.objState.terminal ?? 0) >= 1) v = Math.max(v, 0.55);
    } else if (wy < 0) v = amb;
    L[j * RW + i] = v;
  }
  const addLight = (px: number, py: number, val: number) => {
    const i = Math.floor(px / TILE) - x0, j = Math.floor(py / TILE) - y0;
    if (i >= 0 && j >= 0 && i < RW && j < RH) L[j * RW + i] = Math.max(L[j * RW + i], val);
  };
  // helmet lamp + robot light
  addLight(g.player.cx, g.player.cy, 0.78);
  addLight(g.robot.x, g.robot.y, 0.62);
  for (const o of w.objects) {
    const st = g.objState[o.id] ?? 0;
    const cx = o.tx * TILE + 8, cy = o.ty * TILE - 10;
    if (o.kind === 'transmitter' && st >= 1) addLight(cx, cy - 30, 0.8);
    if (o.kind === 'ship') addLight(o.tx * TILE + 140, o.ty * TILE - 30, 0.7);
    if (o.kind === 'relay') addLight(cx, cy - 10, g.story.day >= 4 ? 0.85 : 0.4);
    if (o.kind === 'terminal' && st) addLight(cx, cy, 0.8);
    if (o.kind === 'blackbox' && !g.story.flags.blackbox) addLight(cx, cy, 0.5);
    if (o.kind === 'beacon' && st) addLight(cx + 16, cy - 20, 1);
    if (o.kind === 'datapad' && !st) addLight(cx, cy, 0.4);
  }
  for (const c of g.creatures) if (c.kind === 'glimmer' && c.state !== 'dead') addLight(c.body.x + 5, c.body.y + 4, 0.45);
  if (g.lightningFlash > 0) for (let k = 0; k < L.length; k++) L[k] = Math.max(L[k], g.lightningFlash * 0.9);
  // propagate
  const solidAt = (i: number, j: number) => {
    const wx = x0 + i, wy = y0 + j;
    return wx < 0 || wy < 0 || wx >= w.w || wy >= w.h ? wy >= 0 : isSolid(w.tiles[wy * w.w + wx]);
  };
  const decay = new Float32Array(RW * RH);
  for (let j = 0; j < RH; j++) for (let i = 0; i < RW; i++) decay[j * RW + i] = solidAt(i, j) ? 0.2 : 0.072;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < RH; j++) {
      for (let i = 1; i < RW; i++) { const k = j * RW + i; const n = L[k - 1] - decay[k]; if (n > L[k]) L[k] = n; }
      for (let i = RW - 2; i >= 0; i--) { const k = j * RW + i; const n = L[k + 1] - decay[k]; if (n > L[k]) L[k] = n; }
    }
    for (let i = 0; i < RW; i++) {
      for (let j = 1; j < RH; j++) { const k = j * RW + i; const n = L[k - RW] - decay[k]; if (n > L[k]) L[k] = n; }
      for (let j = RH - 2; j >= 0; j--) { const k = j * RW + i; const n = L[k + RW] - decay[k]; if (n > L[k]) L[k] = n; }
    }
  }
  const d = lightImg!.data;
  for (let k = 0; k < L.length; k++) {
    const dark = Math.pow(1 - clamp(L[k], 0, 1), 1.25) * 0.97;
    d[k * 4] = 6; d[k * 4 + 1] = 3; d[k * 4 + 2] = 18; d[k * 4 + 3] = dark * 255;
  }
  lightCtx!.putImageData(lightImg!, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCanvas!, Math.round(x0 * TILE - camX + 8 - 8), Math.round(y0 * TILE - camY), RW * TILE, RH * TILE);
  ctx.imageSmoothingEnabled = false;

  // additive glows
  ctx.globalCompositeOperation = 'lighter';
  const vis0x = Math.floor(camX / TILE) - 2, vis1x = Math.ceil((camX + g.W) / TILE) + 2;
  const vis0y = Math.floor(camY / TILE) - 2, vis1y = Math.ceil((camY + g.H) / TILE) + 2;
  const glowK = clamp(1.1 - amb * 0.8, 0.25, 1);
  for (let y = vis0y; y <= vis1y; y++) for (let x = vis0x; x <= vis1x; x++) {
    const t = w.get(x, y);
    const def = TILE_DEFS[t];
    if (!def.glow) continue;
    if (t === T.LEAVES && hash2(x, y, 4) > 0.3) continue;
    if (t === T.PLANT && hash2(x, y, 5) > 0.6) continue;
    if (t === T.CRYSTAL && isSolid(w.get(x, y - 1)) && isSolid(w.get(x, y + 1)) && isSolid(w.get(x - 1, y)) && isSolid(w.get(x + 1, y))) continue;
    const gs = g.assets.glow[def.glow];
    const pulse = 0.75 + 0.25 * Math.sin(g.elapsed * 2.2 + x * 1.3 + y);
    ctx.globalAlpha = glowK * pulse;
    ctx.drawImage(gs, Math.round(x * TILE + 8 - gs.width / 2 - camX), Math.round(y * TILE + 8 - gs.height / 2 - camY));
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
