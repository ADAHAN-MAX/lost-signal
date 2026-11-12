import { TILE } from './constants';
import type { World } from './world';

export interface Body {
  x: number; // left px
  y: number; // top px
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  hitWallX: boolean;
}

function overlapsSolid(world: World, x: number, y: number, w: number, h: number): boolean {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (world.solid(tx, ty)) return true;
  return false;
}

export function bodyBlocked(world: World, b: Body): boolean {
  return overlapsSolid(world, b.x, b.y, b.w, b.h);
}

/** Move a body through the tile world, resolving collisions axis by axis. */
export function moveBody(world: World, b: Body, dt: number, stepUp = false): void {
  const steps = Math.max(1, Math.ceil((Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt) / 6));
  const sdt = dt / steps;
  b.hitWallX = false;
  let grounded = false;
  for (let s = 0; s < steps; s++) {
    // X axis
    const nx = b.x + b.vx * sdt;
    if (!overlapsSolid(world, nx, b.y, b.w, b.h)) {
      b.x = nx;
    } else if (stepUp && b.onGround && !overlapsSolid(world, nx, b.y - TILE - 0.5, b.w, b.h) && !overlapsSolid(world, b.x, b.y - TILE - 0.5, b.w, b.h)) {
      // climb a one-tile ledge
      b.y = Math.floor((b.y + b.h) / TILE) * TILE - TILE - b.h;
      b.x = nx;
    } else {
      if (b.vx > 0) b.x = Math.floor((nx + b.w) / TILE) * TILE - b.w - 0.01;
      else if (b.vx < 0) b.x = Math.floor(nx / TILE) * TILE + TILE + 0.01;
      b.vx = 0;
      b.hitWallX = true;
    }
    // Y axis
    const ny = b.y + b.vy * sdt;
    if (!overlapsSolid(world, b.x, ny, b.w, b.h)) {
      b.y = ny;
    } else {
      if (b.vy > 0) {
        b.y = Math.floor((ny + b.h) / TILE) * TILE - b.h - 0.01;
        grounded = true;
      } else if (b.vy < 0) {
        b.y = Math.floor(ny / TILE) * TILE + TILE + 0.01;
      }
      b.vy = 0;
    }
  }
  if (!grounded) grounded = overlapsSolid(world, b.x, b.y + 1, b.w, b.h);
  b.onGround = grounded;
}
