import { makeCanvas, rect, px, line, outline, poly, Canv, disc } from './canvas';
import { drawText } from '../font';
import { mulberry32 } from '../rng';

export function buildCrashedShip(): Canv {
  const W = 184, H = 76;
  const [c, ctx] = makeCanvas(W, H);
  // main hull — tilted, nose buried on the right
  poly(ctx, [6, 34, 30, 22, 120, 18, 160, 30, 182, 60, 176, 72, 120, 70, 30, 62, 8, 52], '#8d93ab');
  poly(ctx, [10, 50, 30, 60, 120, 68, 176, 70, 180, 74, 30, 66, 8, 54], '#5a5f78');
  poly(ctx, [30, 22, 120, 18, 150, 26, 40, 30], '#b9bed2');
  // panel seams
  for (let x = 40; x < 160; x += 22) line(ctx, x, 21 + (x - 40) * 0.05, x - 4, 64, '#6a6f88');
  line(ctx, 14, 44, 170, 52, '#6a6f88');
  // orange stripe
  poly(ctx, [12, 40, 160, 44, 162, 48, 12, 45], '#ff7a3d');
  // windows (cockpit near nose)
  rect(ctx, 136, 28, 18, 6, '#1b1530');
  rect(ctx, 137, 29, 7, 4, '#43d9ff');
  rect(ctx, 146, 29, 7, 4, '#2aa6d6');
  px(ctx, 138, 29, '#c8f8ff');
  for (let i = 0; i < 5; i++) { rect(ctx, 52 + i * 16, 30, 6, 4, '#1b1530'); px(ctx, 53 + i * 16, 31, i % 2 ? '#43d9ff' : '#2b3a5a'); }
  // engine at the back
  rect(ctx, 0, 34, 10, 18, '#4c5068');
  rect(ctx, 0, 36, 4, 14, '#1b1530');
  rect(ctx, 1, 38, 2, 10, '#ff5a2d');
  // broken wing sticking up
  poly(ctx, [60, 24, 78, 2, 92, 4, 96, 22], '#9aa0b8');
  poly(ctx, [78, 2, 92, 4, 90, 8, 80, 7], '#ff7a3d');
  line(ctx, 70, 14, 88, 14, '#6a6f88');
  // scorch & damage
  const r = mulberry32(42);
  for (let i = 0; i < 120; i++) {
    const x = 20 + Math.floor(r() * 150), y = 20 + Math.floor(r() * 48);
    const d = ctx.getImageData(x, y, 1, 1).data;
    if (d[3] > 0) px(ctx, x, y, r() < 0.5 ? '#2b2d3a' : '#45485c');
  }
  poly(ctx, [100, 40, 112, 36, 118, 46, 108, 54, 98, 50], '#1b1530');
  line(ctx, 102, 44, 114, 42, '#ff9b3d');
  // name
  drawText(ctx, 'ARES-7', 60, 52, { color: '#e8e6f2', shadow: '#3a3d52' });
  return outline(c);
}

export function buildTransmitter(damaged: boolean): Canv {
  const [c, ctx] = makeCanvas(36, 52);
  // base
  rect(ctx, 6, 44, 24, 8, '#4c5068');
  rect(ctx, 6, 44, 24, 1, '#7d839e');
  rect(ctx, 10, 46, 6, 3, '#1b1530');
  px(ctx, 11, 47, damaged ? '#ff3d3d' : '#3dff8a');
  rect(ctx, 20, 46, 6, 3, '#1b1530');
  px(ctx, 21, 47, damaged ? '#552222' : '#43d9ff');
  if (damaged) {
    // bent mast
    line(ctx, 18, 44, 18, 30, '#9aa0b8', 2);
    line(ctx, 18, 30, 26, 20, '#9aa0b8', 2);
    // dish tilted down
    poly(ctx, [22, 18, 34, 16, 34, 30, 28, 30], '#c3c9da');
    poly(ctx, [24, 20, 32, 19, 32, 27, 28, 27], '#8d93ab');
    line(ctx, 12, 36, 16, 40, '#ff7a3d');
    px(ctx, 13, 34, '#ffe08a');
  } else {
    line(ctx, 18, 44, 18, 16, '#9aa0b8', 2);
    line(ctx, 12, 44, 18, 30, '#7d839e');
    line(ctx, 24, 44, 18, 30, '#7d839e');
    // dish pointing up-left
    poly(ctx, [4, 10, 18, 2, 30, 8, 18, 18], '#c3c9da');
    poly(ctx, [8, 10, 18, 5, 26, 9, 18, 15], '#8d93ab');
    line(ctx, 18, 10, 14, 4, '#e8e6f2');
    px(ctx, 14, 3, '#43d9ff');
  }
  return outline(c);
}

export function buildDebris(v: number): Canv {
  const [c, ctx] = makeCanvas(20, 12);
  const r = mulberry32(300 + v);
  poly(ctx, [1, 12, 4, 5, 9, 3, 14, 6, 19, 12], '#5a5f78');
  for (let i = 0; i < 5; i++) {
    const x = 3 + Math.floor(r() * 13), y = 5 + Math.floor(r() * 5);
    line(ctx, x, y, x + 3, y - 2, r() < 0.5 ? '#9aa0b8' : '#c3c9da');
  }
  rect(ctx, 8, 6, 4, 2, '#ff7a3d');
  px(ctx, 6, 4, '#ffffff');
  return outline(c);
}

export function buildRelay(): Canv {
  const [c, ctx] = makeCanvas(26, 44);
  poly(ctx, [4, 44, 7, 8, 13, 0, 19, 8, 22, 44], '#2a2745');
  poly(ctx, [7, 44, 9, 10, 13, 3, 13, 44], '#39355c');
  for (let y = 12; y < 40; y += 6) { rect(ctx, 10, y, 6, 1, '#1b1530'); px(ctx, 12, y + 2, '#1b1530'); }
  rect(ctx, 2, 40, 22, 4, '#1f1c36');
  return outline(c);
}

export function buildTerminal(powered: boolean): Canv {
  const [c, ctx] = makeCanvas(18, 22);
  rect(ctx, 2, 6, 14, 16, '#4a5470');
  rect(ctx, 2, 6, 14, 1, '#65708f');
  rect(ctx, 4, 8, 10, 7, '#0d0b14');
  if (powered) {
    rect(ctx, 5, 9, 8, 5, '#0f3a3a');
    for (let i = 0; i < 3; i++) rect(ctx, 6, 10 + i * 1.5, 3 + i * 2, 1, '#3dff8a');
  } else px(ctx, 6, 10, '#3a1d2a');
  rect(ctx, 4, 17, 10, 2, '#2f364a');
  px(ctx, 5, 17, powered ? '#3dff8a' : '#ff3d3d');
  line(ctx, 9, 6, 12, 1, '#7d839e');
  px(ctx, 12, 0, powered ? '#43d9ff' : '#552222');
  return outline(c);
}

export function buildBlackBox(): Canv {
  const [c, ctx] = makeCanvas(14, 11);
  rect(ctx, 1, 2, 12, 9, '#ff7a3d');
  rect(ctx, 1, 2, 12, 1, '#ffb27a');
  rect(ctx, 1, 6, 12, 1, '#b8501f');
  rect(ctx, 4, 0, 6, 2, '#5a5f78');
  px(ctx, 3, 4, '#1b1530'); px(ctx, 10, 4, '#1b1530');
  return outline(c);
}

export function buildCrate(open: boolean): Canv {
  const [c, ctx] = makeCanvas(16, 14);
  rect(ctx, 1, open ? 5 : 3, 14, open ? 9 : 11, '#5d6680');
  rect(ctx, 1, open ? 5 : 3, 14, 1, '#8f99b3');
  line(ctx, 1, 6, 15, 13, '#454c63');
  rect(ctx, 6, 7, 4, 3, '#e8c547');
  if (open) { poly(ctx, [1, 5, 4, 0, 16, 0, 15, 5], '#6d7690'); }
  return outline(c);
}

export function buildDatapad(): Canv {
  const [c, ctx] = makeCanvas(12, 8);
  rect(ctx, 1, 1, 10, 7, '#2e3448');
  rect(ctx, 2, 2, 8, 4, '#43d9ff');
  rect(ctx, 3, 3, 4, 1, '#c8f8ff');
  return outline(c);
}

export function buildBeaconPad(active: boolean): Canv {
  const [c, ctx] = makeCanvas(52, 44);
  rect(ctx, 2, 36, 48, 8, '#4a5470');
  rect(ctx, 2, 36, 48, 1, '#8c96b3');
  for (let x = 4; x < 50; x += 8) line(ctx, x, 42, x + 4, 38, '#e8c547');
  // tower
  rect(ctx, 22, 12, 8, 24, '#5d6680');
  rect(ctx, 22, 12, 1, 24, '#8f99b3');
  line(ctx, 16, 36, 22, 22, '#7d839e');
  line(ctx, 36, 36, 30, 22, '#7d839e');
  rect(ctx, 20, 6, 12, 7, '#2e3448');
  if (active) {
    disc(ctx, 26, 9, 3, '#6ff3ff');
    px(ctx, 25, 8, '#ffffff');
  } else {
    rect(ctx, 23, 8, 6, 3, '#120e22');
  }
  return outline(c);
}

export function buildShuttle(): Canv {
  const [c, ctx] = makeCanvas(72, 40);
  poly(ctx, [4, 26, 14, 12, 52, 8, 68, 18, 70, 28, 54, 34, 12, 34], '#e8e6f2');
  poly(ctx, [4, 26, 70, 28, 54, 34, 12, 34], '#b5b0c9');
  rect(ctx, 50, 13, 12, 6, '#1b1530');
  rect(ctx, 51, 14, 10, 4, '#43d9ff');
  px(ctx, 52, 14, '#c8f8ff');
  poly(ctx, [10, 22, 60, 22, 60, 24, 10, 24], '#3a7bff');
  rect(ctx, 14, 34, 3, 5, '#5a5f78');
  rect(ctx, 52, 34, 3, 5, '#5a5f78');
  rect(ctx, 11, 38, 9, 2, '#3a3d52');
  rect(ctx, 49, 38, 9, 2, '#3a3d52');
  drawText(ctx, 'UNSC', 22, 13, { color: '#3a3d52', shadow: null });
  return outline(c);
}

/** Flying ship for the intro cutscene. */
export function buildFlyingShip(): Canv {
  const [c, ctx] = makeCanvas(64, 26);
  poly(ctx, [8, 8, 40, 5, 60, 12, 62, 15, 40, 21, 8, 18], '#b9bed2');
  poly(ctx, [8, 13, 62, 14, 40, 21, 8, 18], '#8d93ab');
  poly(ctx, [20, 7, 30, 0, 38, 0, 34, 7], '#9aa0b8');
  poly(ctx, [20, 19, 30, 26, 38, 26, 34, 19], '#7d839e');
  rect(ctx, 46, 9, 9, 4, '#1b1530');
  rect(ctx, 47, 10, 7, 2, '#43d9ff');
  rect(ctx, 10, 12, 44, 1, '#ff7a3d');
  rect(ctx, 4, 9, 5, 9, '#4c5068');
  return outline(c);
}
