export const T = {
  AIR: 0,
  SOIL: 1,
  STONE: 2,
  DEEP: 3,
  METAL_ORE: 4,
  CRYSTAL: 5,
  WRECK: 6,
  WALL: 7,
  STATION: 8,
  BEDROCK: 9,
  TRUNK: 10,
  LEAVES: 11,
  PLANT: 12,
  LIGHT: 13,
} as const;

export interface TileDef {
  name: string;
  solid: boolean;
  /** Seconds to mine with the starting multitool. Infinity = unbreakable. */
  hardness: number;
  needsPickaxe?: boolean;
  /** Light emitted (0..1) */
  light?: number;
  glow?: 'purple' | 'cyan' | 'warm' | 'pink';
  drop?: { id: string; min: number; max: number; chance?: number };
  particle: string;
}

export const TILE_DEFS: Record<number, TileDef> = {
  [T.AIR]: { name: 'Air', solid: false, hardness: Infinity, particle: '#000' },
  [T.SOIL]: { name: 'Alien Soil', solid: true, hardness: 0.35, drop: { id: 'soil', min: 1, max: 1 }, particle: '#5d3c70' },
  [T.STONE]: { name: 'Alien Stone', solid: true, hardness: 0.85, drop: { id: 'stone', min: 1, max: 1 }, particle: '#514d7d' },
  [T.DEEP]: { name: 'Deep Rock', solid: true, hardness: 1.5, needsPickaxe: true, drop: { id: 'stone', min: 1, max: 1 }, particle: '#39355c' },
  [T.METAL_ORE]: { name: 'Metal Ore', solid: true, hardness: 1.3, needsPickaxe: true, drop: { id: 'metal', min: 1, max: 2 }, particle: '#c8c3d8' },
  [T.CRYSTAL]: { name: 'Energy Crystal', solid: true, hardness: 0.9, light: 0.62, glow: 'purple', drop: { id: 'crystal', min: 1, max: 1 }, particle: '#c88cff' },
  [T.WRECK]: { name: 'Hull Fragment', solid: true, hardness: 0.7, drop: { id: 'metal', min: 1, max: 1 }, particle: '#9aa0b8' },
  [T.WALL]: { name: 'Shelter Wall', solid: true, hardness: 0.6, drop: { id: 'wall', min: 1, max: 1 }, particle: '#6d7690' },
  [T.STATION]: { name: 'Station Plating', solid: true, hardness: Infinity, particle: '#4a5470' },
  [T.BEDROCK]: { name: 'Bedrock', solid: true, hardness: Infinity, particle: '#221d33' },
  [T.TRUNK]: { name: 'Alien Tree', solid: false, hardness: 0.6, drop: { id: 'organic', min: 1, max: 1 }, particle: '#5b3a6b' },
  [T.LEAVES]: { name: 'Glowleaf', solid: false, hardness: 0.15, light: 0.22, glow: 'pink', drop: { id: 'organic', min: 1, max: 1, chance: 0.35 }, particle: '#3fa3a0' },
  [T.PLANT]: { name: 'Alien Plant', solid: false, hardness: 0.06, light: 0.3, glow: 'cyan', drop: { id: 'organic', min: 1, max: 1, chance: 0.6 }, particle: '#39c9a8' },
  [T.LIGHT]: { name: 'Light Source', solid: false, hardness: 0.2, light: 1, glow: 'warm', drop: { id: 'light', min: 1, max: 1 }, particle: '#c8f7ff' },
};

export function isSolid(t: number): boolean {
  return TILE_DEFS[t]?.solid ?? false;
}
