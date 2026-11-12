import { makeCanvas, rect, px, line, outline, poly, Canv, disc } from './canvas';

type Ctx = CanvasRenderingContext2D;

const DRAW: Record<string, (ctx: Ctx) => void> = {
  metal: (c) => {
    poly(c, [2, 10, 6, 4, 13, 3, 14, 9, 9, 13], '#8d93ab');
    poly(c, [6, 4, 13, 3, 12, 6, 7, 7], '#c3c9da');
    px(c, 9, 9, '#3a3d52'); px(c, 5, 10, '#ff7a3d');
  },
  stone: (c) => {
    poly(c, [2, 12, 3, 6, 8, 3, 13, 5, 14, 12], '#3d3a63');
    poly(c, [3, 6, 8, 3, 12, 5, 7, 7], '#5d5990');
    px(c, 10, 10, '#2e2b4d');
  },
  soil: (c) => {
    disc(c, 8, 9, 5, '#4a2f5c');
    rect(c, 4, 5, 8, 2, '#2fd1b5');
    px(c, 6, 10, '#6b4a80'); px(c, 10, 11, '#3b2449');
  },
  crystal: (c) => {
    line(c, 5, 14, 6, 4, '#b46cff', 3);
    line(c, 9, 14, 11, 6, '#6ff3ff', 2);
    px(c, 6, 4, '#f0c8ff'); px(c, 6, 5, '#ffffff'); px(c, 11, 6, '#d6fdff');
  },
  organic: (c) => {
    disc(c, 8, 9, 4, '#3fa3a0');
    line(c, 8, 5, 10, 2, '#2a9c84');
    px(c, 6, 8, '#9effe6'); px(c, 10, 10, '#ff8ae6');
  },
  pickaxe: (c) => {
    line(c, 4, 14, 11, 5, '#8a5a3c', 2);
    line(c, 5, 3, 14, 9, '#c3c9da', 2);
    px(c, 5, 3, '#ffffff'); px(c, 14, 9, '#ffffff');
  },
  multitool: (c) => {
    rect(c, 3, 7, 9, 5, '#ff8a3d');
    rect(c, 3, 7, 9, 1, '#ffb27a');
    rect(c, 12, 8, 2, 3, '#5a5f78');
    px(c, 14, 9, '#6ff3ff');
    rect(c, 5, 12, 3, 3, '#4c5068');
  },
  repairkit: (c) => {
    rect(c, 2, 5, 12, 9, '#e8e6f2');
    rect(c, 2, 5, 12, 2, '#ff7a3d');
    rect(c, 6, 3, 4, 2, '#8f8aa8');
    rect(c, 7, 8, 2, 5, '#3dd68c');
    rect(c, 5, 10, 6, 1, '#3dd68c');
  },
  o2refill: (c) => {
    rect(c, 5, 3, 6, 12, '#43d9ff');
    rect(c, 5, 3, 2, 12, '#9ef0ff');
    rect(c, 6, 1, 4, 2, '#8f8aa8');
    rect(c, 5, 8, 6, 2, '#ffffff');
    px(c, 7, 8, '#2aa6d6');
  },
  ration: (c) => {
    rect(c, 3, 4, 10, 10, '#c9a35a');
    rect(c, 3, 4, 10, 2, '#e8c547');
    rect(c, 5, 8, 6, 3, '#8a5a3c');
    px(c, 6, 9, '#ffffff');
  },
  wall: (c) => {
    rect(c, 2, 2, 12, 12, '#6d7690');
    rect(c, 2, 2, 12, 1, '#8f99b3');
    rect(c, 4, 7, 8, 2, '#43d9ff');
  },
  light: (c) => {
    rect(c, 7, 7, 2, 8, '#6d7690');
    rect(c, 4, 1, 8, 7, '#2e3448');
    rect(c, 5, 2, 6, 5, '#c8f7ff');
    px(c, 5, 2, '#ffffff');
  },
  beaconcore: (c) => {
    rect(c, 2, 2, 12, 12, '#2e3448');
    rect(c, 2, 2, 12, 1, '#65708f');
    disc(c, 8, 8, 4, '#6ff3ff');
    disc(c, 8, 8, 2, '#ffffff');
  },
  suitupgrade: (c) => {
    poly(c, [3, 3, 13, 3, 14, 12, 8, 15, 2, 12], '#e8e6f2');
    rect(c, 6, 6, 4, 4, '#43d9ff');
    rect(c, 3, 3, 10, 1, '#ff8a3d');
  },
  blackbox: (c) => {
    rect(c, 2, 5, 12, 9, '#ff7a3d');
    rect(c, 5, 3, 6, 2, '#5a5f78');
    rect(c, 2, 9, 12, 1, '#b8501f');
  },
};

export function buildItemIcons(): Record<string, Canv> {
  const out: Record<string, Canv> = {};
  for (const k of Object.keys(DRAW)) {
    const [c, ctx] = makeCanvas(16, 16);
    DRAW[k](ctx);
    out[k] = outline(c);
  }
  return out;
}
