// Staged screenshots: ?shot=start|play|land stages the real game forward
// from a fresh world with the autopilot, so each frame is what a short
// game really looks like. The same seed always gives the same frame.
import { WORLD, RUNWAY } from './config.js';
import { createWorld, startSortie, stepWorld, SCREEN_TITLE, SCREEN_PLAY } from './world.js';
import { autopilotStick } from './autopilot.js';
import { terrainHeight } from './terrain.js';

const STEP = 1 / 60;
const SHOTS = {
  start: { seconds: 6, screen: SCREEN_TITLE },
  play: { seconds: 12, screen: SCREEN_PLAY },
  land: { seconds: 20, screen: SCREEN_PLAY },
  crash: { seconds: 200, screen: SCREEN_PLAY, reckless: true },
};

/**
 * Build a world staged for the named shot. Returns { world, screen }.
 * Any other name stages the title screen.
 */
export function stageShot(name, seed = WORLD.seed) {
  const shot = SHOTS[name] ?? SHOTS.start;
  const world = createWorld(seed);
  startSortie(world);
  if (name === 'land') {
    // Final approach: all rings flown, Kestrel lined up on Runway 18.
    for (const ring of world.rings) ring.passed = true;
    world.ringsPassed = world.rings.length;
    const p = world.plane;
    p.x = RUNWAY.x;
    p.y = terrainHeight(RUNWAY.x, RUNWAY.z + RUNWAY.length / 2 + 1150) + 110;
    p.z = RUNWAY.z + RUNWAY.length / 2 + 1150;
    p.yaw = 0; // facing north, down the runway
    p.pitch = -0.06;
    p.roll = 0;
    p.speed = 30;
    p.throttle = 0.45;
  }
  const reckless = shot.reckless === true;
  for (let i = 0; i < shot.seconds / STEP; i += 1) {
    const s = reckless ? { pitch: -0.8, roll: 0.9, throttleDelta: 1 } : autopilotStick(world);
    stepWorld(world, s, STEP);
    if (world.screen !== SCREEN_PLAY) break;
  }
  if (shot.screen === SCREEN_TITLE) {
    world.screen = SCREEN_TITLE;
  }
  return { world, screen: world.screen };
}
