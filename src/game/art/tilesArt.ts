import { makeCanvas, rect, px, Canv, line } from './canvas';
import { mulberry32 } from '../rng';
import { T } from '../tiles';

type Ctx = CanvasRenderingContext2D;

function speckle(ctx: Ctx, r: () => number, base: string, cols: string[], n: number): void {
  rect(ctx, 0, 0, 16, 16, base);
  for (let i = 0; i < n; i++) {
    const c = cols[Math.floor(r() * cols.length)];
    const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
    px(ctx, x, y, c);
    if (r() < 0.4) px(ctx, x + 1, y, c);
  }
}

function stoneBase(ctx: Ctx, r: () => number, deep = false): void {
  const base = deep ? '#2a2745' : '#3d3a63';
  const dark = deep ? '#1f1c36' : '#2e2b4d';
  const light = deep ? '#39355c' : '#514d7d';
  speckle(ctx, r, base, [dark, dark, light], 40);
  // a few rock "chunks"
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(r() * 12), y = Math.floor(r() * 12);
    rect(ctx, x, y, 3, 2, light);
    rect(ctx, x, y + 2, 3, 1, dark);
  }
  if (r() < 0.6) line(ctx, Math.floor(r() * 16), Math.floor(r() * 16), Math.floor(r() * 16), Math.floor(r() * 16), dark);
}

function drawTile(id: number, v: number): Canv {
  const [c, ctx] = makeCanvas(16, 16);
  const r = mulberry32(id * 1000 + v * 77 + 13);
  switch (id) {
    case T.SOIL:
      speckle(ctx, r, '#4a2f5c', ['#3b2449', '#3b2449', '#5d3c70', '#6b4a80'], 46);
      for (let i = 0; i < 2; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 14); rect(ctx, x, y, 2, 2, '#6b5a8a'); px(ctx, x, y, '#8c7aae'); }
      break;
    case T.STONE:
      stoneBase(ctx, r);
      break;
    case T.DEEP:
      stoneBase(ctx, r, true);
      break;
    case T.METAL_ORE:
      stoneBase(ctx, r, true);
      for (let i = 0; i < 4; i++) {
        const x = 2 + Math.floor(r() * 11), y = 2 + Math.floor(r() * 11);
        rect(ctx, x, y, 3, 2, '#8f8aa8');
        px(ctx, x, y, '#e6e2f2');
        px(ctx, x + 2, y + 1, '#d1793b');
      }
      break;
    case T.CRYSTAL: {
      stoneBase(ctx, r);
      const shards = 3;
      for (let i = 0; i < shards; i++) {
        const x = 2 + Math.floor(r() * 11), y = 4 + Math.floor(r() * 9);
        const h = 4 + Math.floor(r() * 4);
        const col = i === 1 ? '#6ff3ff' : '#b46cff';
        const hi = i === 1 ? '#d6fdff' : '#f0c8ff';
        line(ctx, x, y, x + 1, y - h, col, 2);
        px(ctx, x + 1, y - h, hi);
        px(ctx, x, y - 1, hi);
      }
      break;
    }
    case T.WRECK:
      rect(ctx, 0, 0, 16, 16, '#4c5068');
      rect(ctx, 0, 0, 16, 1, '#7d839e');
      rect(ctx, 0, 15, 16, 1, '#2b2d3a');
      rect(ctx, 0, 7, 16, 1, '#2b2d3a');
      rect(ctx, 0, 9, 16, 2, '#ff7a3d');
      px(ctx, 2, 3, '#9aa0b8'); px(ctx, 13, 3, '#9aa0b8'); px(ctx, 2, 13, '#9aa0b8'); px(ctx, 13, 13, '#9aa0b8');
      for (let i = 0; i < 10; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#2b2d3a');
      break;
    case T.WALL:
      rect(ctx, 0, 0, 16, 16, '#6d7690');
      rect(ctx, 0, 0, 16, 1, '#8f99b3');
      rect(ctx, 0, 0, 1, 16, '#8f99b3');
      rect(ctx, 15, 0, 1, 16, '#454c63');
      rect(ctx, 0, 15, 16, 1, '#454c63');
      rect(ctx, 3, 3, 10, 10, '#5d6680');
      rect(ctx, 3, 7, 10, 2, v % 2 ? '#43d9ff' : '#3ab8d8');
      px(ctx, 2, 2, '#c3c9da'); px(ctx, 13, 2, '#c3c9da'); px(ctx, 2, 13, '#c3c9da'); px(ctx, 13, 13, '#c3c9da');
      break;
    case T.STATION:
      rect(ctx, 0, 0, 16, 16, '#4a5470');
      rect(ctx, 0, 0, 16, 1, '#65708f');
      rect(ctx, 0, 15, 16, 1, '#2f364a');
      rect(ctx, 7, 0, 1, 16, '#2f364a');
      if (v === 2) for (let i = 0; i < 16; i += 4) { line(ctx, i, 12, i + 3, 9, '#e8c547'); }
      px(ctx, 2, 2, '#8c96b3'); px(ctx, 12, 2, '#8c96b3');
      for (let i = 0; i < 6; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), '#3c4560');
      break;
    case T.BEDROCK:
      speckle(ctx, r, '#15121f', ['#221d33', '#0d0b14'], 60);
      break;
    case T.TRUNK:
      rect(ctx, 4, 0, 8, 16, '#5b3a6b');
      rect(ctx, 4, 0, 1, 16, '#432a52');
      rect(ctx, 11, 0, 1, 16, '#3a2347');
      for (let y = 1; y < 16; y += 4) px(ctx, 6 + (y % 3), y, '#432a52');
      if (v % 2 === 0) { px(ctx, 8, 5, '#ff6fd8'); px(ctx, 8, 6, '#ff6fd8'); px(ctx, 9, 11, '#ff9ae6'); }
      break;
    case T.LEAVES:
      for (let i = 0; i < 26; i++) {
        const x = 1 + Math.floor(r() * 13), y = 1 + Math.floor(r() * 13);
        rect(ctx, x, y, 3, 3, r() < 0.5 ? '#2b6f7a' : '#3fa3a0');
      }
      for (let i = 0; i < 8; i++) px(ctx, 1 + Math.floor(r() * 14), 1 + Math.floor(r() * 14), '#1f4f5c');
      for (let i = 0; i < 3; i++) {
        const x = 3 + Math.floor(r() * 10), y = 3 + Math.floor(r() * 10);
        px(ctx, x, y, r() < 0.5 ? '#ff8ae6' : '#9effe6');
        px(ctx, x + 1, y, '#ffffff');
      }
      break;
    case T.PLANT:
      drawPlant(ctx, v);
      break;
    case T.LIGHT:
      rect(ctx, 7, 6, 2, 10, '#6d7690');
      rect(ctx, 6, 15, 4, 1, '#454c63');
      rect(ctx, 5, 1, 6, 6, '#2e3448');
      rect(ctx, 6, 2, 4, 4, '#c8f7ff');
      px(ctx, 6, 2, '#ffffff');
      break;
  }
  return c;
}

function drawPlant(ctx: Ctx, v: number): void {
  switch (v % 4) {
    case 0: // glowing mushroom
      rect(ctx, 7, 9, 2, 7, '#c9b8e8');
      rect(ctx, 4, 6, 8, 3, '#8a4fff');
      rect(ctx, 5, 5, 6, 1, '#8a4fff');
      px(ctx, 6, 6, '#e0c3ff'); px(ctx, 9, 7, '#e0c3ff');
      rect(ctx, 11, 12, 2, 4, '#c9b8e8'); rect(ctx, 10, 11, 4, 1, '#b46cff');
      break;
    case 1: // curly fern
      line(ctx, 8, 16, 8, 8, '#2a9c84');
      line(ctx, 8, 8, 6, 5, '#39c9a8');
      px(ctx, 5, 6, '#39c9a8'); px(ctx, 5, 7, '#39c9a8');
      line(ctx, 8, 12, 12, 9, '#39c9a8');
      px(ctx, 12, 8, '#8ff7e3');
      line(ctx, 8, 14, 4, 11, '#2a9c84');
      break;
    case 2: // bulb flower
      line(ctx, 8, 16, 7, 8, '#2a9c84');
      rect(ctx, 5, 4, 5, 5, '#ff6fd8');
      px(ctx, 6, 5, '#ffc2f1');
      rect(ctx, 9, 11, 3, 1, '#39c9a8');
      break;
    default: // crystal sprout
      line(ctx, 6, 16, 5, 9, '#6ff3ff', 2);
      line(ctx, 10, 16, 11, 11, '#b46cff', 2);
      px(ctx, 5, 9, '#d6fdff'); px(ctx, 11, 11, '#f0c8ff');
      break;
  }
}

export function buildTileArt(): { tiles: Record<number, Canv[]>; grass: Canv[]; caveBg: Canv[]; stationBg: Canv; crack: Canv[] } {
  const tiles: Record<number, Canv[]> = {};
  for (const id of Object.values(T)) {
    if (id === T.AIR) continue;
    tiles[id] = [0, 1, 2, 3].map((v) => drawTile(id, v));
  }
  const grass = [0, 1, 2, 3].map((v) => {
    const [c, ctx] = makeCanvas(16, 8);
    const r = mulberry32(900 + v);
    rect(ctx, 0, 3, 16, 3, '#2fd1b5');
    rect(ctx, 0, 6, 16, 1, '#1c9c8f');
    for (let x = 0; x < 16; x++) {
      const h = Math.floor(r() * 4);
      for (let y = 0; y < h; y++) px(ctx, x, 2 - y, y === h - 1 ? '#8ff7e3' : '#2fd1b5');
      if (r() < 0.25) px(ctx, x, 7, '#1c9c8f');
    }
    if (v === 1) { px(ctx, 5, 0, '#ff8ae6'); px(ctx, 5, 1, '#2fd1b5'); }
    return c;
  });
  const caveBg = [0, 1, 2, 3].map((v) => {
    const [c, ctx] = makeCanvas(16, 16);
    const r = mulberry32(500 + v);
    speckle(ctx, r, '#1d1a33', ['#17142a', '#231f3d'], 30);
    return c;
  });
  const [sb, sctx] = makeCanvas(16, 16);
  rect(sctx, 0, 0, 16, 16, '#262c3d');
  rect(sctx, 0, 0, 16, 1, '#2f364a');
  rect(sctx, 0, 0, 1, 16, '#2f364a');
  px(sctx, 3, 3, '#323a50');
  const crack = [0, 1, 2, 3].map((stage) => {
    const [c, ctx] = makeCanvas(16, 16);
    const r = mulberry32(77);
    const col = 'rgba(10,6,20,0.85)';
    for (let i = 0; i <= stage; i++) {
      const x = 2 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 12);
      line(ctx, 8, 8, x, y, col);
    }
    if (stage >= 2) line(ctx, 0, 4 + stage, 16, 12 - stage, col);
    return c;
  });
  return { tiles, grass, caveBg, stationBg: sb, crack };
}
