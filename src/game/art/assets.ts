import { Canv, glowSprite, flipped } from './canvas';
import { buildTileArt } from './tilesArt';
import { buildAstronaut, buildRobot, buildGlimmerhop, buildCrawler, buildDuskwing, buildPortrait } from './characters';
import {
  buildCrashedShip, buildTransmitter, buildDebris, buildRelay, buildTerminal, buildBlackBox,
  buildCrate, buildDatapad, buildBeaconPad, buildShuttle, buildFlyingShip,
} from './objects';
import { buildItemIcons } from './itemsArt';
import { buildMountainLayer, buildSkyPlanet, buildMoon } from './backdrop';

export interface Assets {
  tiles: Record<number, Canv[]>;
  grass: Canv[];
  caveBg: Canv[];
  stationBg: Canv;
  crack: Canv[];
  astro: Record<string, Canv[]>;
  astroL: Record<string, Canv[]>;
  robot: Canv[];
  robotL: Canv[];
  portrait: Canv;
  glimmer: Canv[];
  glimmerL: Canv[];
  crawler: Record<string, Canv[]>;
  crawlerL: Record<string, Canv[]>;
  duskwing: Canv[];
  ship: Canv;
  transmitterBroken: Canv;
  transmitterFixed: Canv;
  debris: Canv[];
  relay: Canv;
  terminalOff: Canv;
  terminalOn: Canv;
  blackbox: Canv;
  crate: Canv;
  crateOpen: Canv;
  datapad: Canv;
  beaconOff: Canv;
  beaconOn: Canv;
  shuttle: Canv;
  flyingShip: Canv;
  icons: Record<string, Canv>;
  iconUrls: Record<string, string>;
  mountains: Canv[];
  skyPlanet: Canv;
  moon: Canv;
  glow: Record<string, Canv>;
}

let cached: Assets | null = null;

export function getAssets(): Assets {
  if (cached) return cached;
  const t = buildTileArt();
  const astro = buildAstronaut();
  const astroL: Record<string, Canv[]> = {};
  for (const k of Object.keys(astro)) astroL[k] = astro[k].map(flipped);
  const robot = buildRobot();
  const glimmer = buildGlimmerhop();
  const crawler = buildCrawler();
  const crawlerL: Record<string, Canv[]> = {};
  for (const k of Object.keys(crawler)) crawlerL[k] = crawler[k].map(flipped);
  const icons = buildItemIcons();
  const iconUrls: Record<string, string> = {};
  for (const k of Object.keys(icons)) iconUrls[k] = icons[k].toDataURL();
  cached = {
    ...t,
    astro, astroL,
    robot, robotL: robot.map(flipped),
    portrait: buildPortrait(robot[0]),
    glimmer, glimmerL: glimmer.map(flipped),
    crawler, crawlerL,
    duskwing: buildDuskwing(),
    ship: buildCrashedShip(),
    transmitterBroken: buildTransmitter(true),
    transmitterFixed: buildTransmitter(false),
    debris: [0, 1, 2, 3].map(buildDebris),
    relay: buildRelay(),
    terminalOff: buildTerminal(false),
    terminalOn: buildTerminal(true),
    blackbox: buildBlackBox(),
    crate: buildCrate(false),
    crateOpen: buildCrate(true),
    datapad: buildDatapad(),
    beaconOff: buildBeaconPad(false),
    beaconOn: buildBeaconPad(true),
    shuttle: buildShuttle(),
    flyingShip: buildFlyingShip(),
    icons, iconUrls,
    mountains: [
      buildMountainLayer(3, 1024, 200, 150, 120, '#2b2357', '#3d3270', true),
      buildMountainLayer(9, 1024, 200, 165, 90, '#1f1942', '#2f2660', true),
      buildMountainLayer(21, 1024, 200, 185, 70, '#151130', '#231c4a', false),
    ],
    skyPlanet: buildSkyPlanet(),
    moon: buildMoon(),
    glow: {
      purple: glowSprite(28, [180, 108, 255]),
      cyan: glowSprite(24, [111, 243, 255]),
      warm: glowSprite(48, [200, 240, 255], 1.1),
      pink: glowSprite(20, [255, 111, 216], 0.6),
      red: glowSprite(40, [255, 61, 80]),
      big: glowSprite(80, [111, 243, 255]),
    },
  };
  return cached;
}
