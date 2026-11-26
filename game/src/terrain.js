// The valley: a seeded heightfield with a river lake, a flattened airfield
// around the runway, a town of houses, and a ridge the later sorties cross.
import { WORLD, RUNWAY } from './config.js';
import { makeNoise, fbm, mulberry32 } from './random.js';

const noise = makeNoise(WORLD.seed);
const rng = mulberry32(WORLD.seed + 7);

// Distance from a point to the runway rectangle (0 inside it). The flat
// ground extends well past the strip to the south, so the final approach
// runs over a cleared valley floor and the runway is visible from it.
export function runwayDistance(x, z) {
  const halfL = RUNWAY.length / 2;
  const halfW = RUNWAY.width / 2 + 150; // flatten a margin around the strip
  const southExtra = 350; // cleared approach corridor to the south
  const dx = Math.max(Math.abs(x - RUNWAY.x) - halfW, 0);
  const dz = Math.max(Math.abs(z - RUNWAY.z) - halfL - (z > RUNWAY.z ? southExtra : 0), 0);
  return Math.hypot(dx, dz);
}

/** Raw mountain height before flattening, in metres. */
function rawHeight(x, z) {
  // A long valley along z, rising to ridges east and west.
  const valley = Math.abs(x - 300) / 2600;
  const ridge = Math.pow(Math.min(valley, 1.6), 2.2) * WORLD.maxHeight;
  const hills = fbm(noise, x / 900, z / 900, 4) * 90;
  const detail = fbm(noise, x / 220 + 31, z / 220 + 17, 3) * 22;
  // A lake basin south-east of the airfield.
  const lakeDx = x - 1500;
  const lakeDz = z - 1700;
  const lakeD = Math.hypot(lakeDx, lakeDz);
  const lake = lakeD < 520 ? -70 * (1 - lakeD / 520) : 0;
  return Math.max(0, ridge + hills + detail + lake + 6);
}

/** Terrain height in metres at world (x, z). 0 at the runway. */
export function terrainHeight(x, z) {
  const h = rawHeight(x, z);
  const flat = runwayDistance(x, z);
  const t = Math.min(flat / 320, 1); // 0 on the strip, 1 out in the hills
  const eased = t * t * (3 - 2 * t);
  return h * eased;
}

/** True when (x, z) is over the runway strip itself (with a grass margin). */
export function onRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.width / 2 + 10 &&
    Math.abs(z - RUNWAY.z) <= RUNWAY.length / 2 + 10
  );
}

/** True when (x, z) is over the lake (water level ~2 m). */
export function onLake(x, z) {
  const d = Math.hypot(x - 1500, z - 1700);
  return d < 480 && rawHeight(x, z) < 4;
}

// --- Town, trees and airfield props (fixed, seeded, drawn as boxes) ---

function scatter(count, minX, maxX, minZ, maxZ, keepOut) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard += 1;
    const x = minX + rng() * (maxX - minX);
    const z = minZ + rng() * (maxZ - minZ);
    if (keepOut && keepOut(x, z)) continue;
    if (terrainHeight(x, z) > 60) continue;
    out.push({ x, z, s: 0.7 + rng() * 0.9, rot: rng() * Math.PI, tone: rng() });
  }
  return out;
}

const nearRunway = (x, z) => runwayDistance(x, z) < 160;
export const HOUSES = scatter(46, -1900, -800, -200, 1100, nearRunway);
export const TREES = scatter(240, -2900, 2900, -2900, 2900, (x, z) => nearRunway(x, z) || onLake(x, z));

export const HANGARS = [
  { x: RUNWAY.x - 70, z: RUNWAY.z - 120, w: 46, d: 30, h: 14 },
  { x: RUNWAY.x - 70, z: RUNWAY.z - 60, w: 40, d: 26, h: 12 },
];

export const BEACON = { x: RUNWAY.x + 60, z: RUNWAY.z + RUNWAY.length / 2 - 30, h: 26 };

/** Colour of the ground at (x, z) for a terrain quad, before haze. */
export function groundColour(x, z, h) {
  if (onLake(x, z)) return [52, 110, 158];
  if (h > 190) return [226, 228, 232]; // snow caps
  if (h > 120) return [122, 104, 78]; // bare rock
  if (h > 55) return [96, 128, 66]; // high meadow
  // Valley floor: patchy fields, seeded by position.
  const patch = Math.sin(x * 0.011 + z * 0.017) + Math.sin(x * 0.031 - z * 0.008);
  if (patch > 0.9) return [176, 158, 84]; // harvested field
  if (patch < -0.9) return [74, 116, 58]; // dark crop
  return [104, 142, 66]; // grass
}
