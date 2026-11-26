// Game state: sorties, rings, scoring and the screens between them.
// A sortie is a ring course ending in a landing on Runway 18.
import { MISSIONS, SCORE, RUNWAY } from './config.js';
import { createPlane, stepPlane } from './plane.js';
import { terrainHeight } from './terrain.js';
import { mulberry32 } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const RING_RADIUS = 15;

/** Ring course for a mission: a winding line of rings from the airfield. */
export function buildRings(missionIndex, seed) {
  const mission = MISSIONS[missionIndex];
  const rng = mulberry32(seed + missionIndex * 101);
  const rings = [];
  let x = RUNWAY.x + 250;
  let z = RUNWAY.z + 800;
  let heading = 0; // east, away from the airfield (x = cos, z = sin)
  for (let i = 0; i < mission.rings; i += 1) {
    heading += (rng() - 0.5) * 1.5 * mission.ringSpread;
    const leg = 620 + rng() * 420;
    x += Math.cos(heading) * leg;
    z += Math.sin(heading) * leg;
    x = Math.max(-2700, Math.min(2700, x));
    z = Math.max(-2700, Math.min(2700, z));
    // Keep the course out of the high ridge: pull a ring back toward the
    // valley floor until the ground beneath it is flyable.
    let guard = 0;
    while (terrainHeight(x, z) > 170 && guard < 12) {
      guard += 1;
      x += (300 - x) * 0.25;
      z += (400 - z) * 0.25;
    }
    const ground = terrainHeight(x, z);
    const height = ground + 55 + rng() * 110;
    rings.push({ x, y: height, z, radius: RING_RADIUS, passed: false, centre: false });
  }
  // Final ring: on the approach to the runway, low and slow.
  const finalX = RUNWAY.x;
  const finalZ = RUNWAY.z + RUNWAY.length / 2 + 420;
  rings.push({
    x: finalX,
    y: terrainHeight(finalX, finalZ) + 55,
    z: finalZ,
    radius: RING_RADIUS,
    passed: false,
    centre: false,
    final: true,
  });
  return rings;
}

export function createWorld(seed) {
  return {
    seed,
    screen: SCREEN_TITLE,
    missionIndex: 0,
    plane: createPlane(),
    rings: buildRings(0, seed),
    score: 0,
    best: 0,
    sortieScore: 0,
    ringsPassed: 0,
    sortieTime: 0,
    message: '',
    messageUntil: 0,
    elapsed: 0,
    flash: '',
    flashUntil: 0,
    landedCount: 0,
    muted: false,
  };
}

export function mission(world) {
  return MISSIONS[world.missionIndex];
}

export function nextRing(world) {
  for (let i = 0; i < world.rings.length; i += 1) {
    if (!world.rings[i].passed) return world.rings[i];
  }
  return null;
}

export function ringsLeft(world) {
  return world.rings.filter((r) => !r.passed).length;
}

function say(world, text, seconds) {
  world.message = text;
  world.messageUntil = world.elapsed + seconds;
}

function flash(world, text, seconds) {
  world.flash = text;
  world.flashUntil = world.elapsed + seconds;
}

/** Start a sortie from the title screen or after a landing. */
export function startSortie(world) {
  world.plane = createPlane();
  world.rings = buildRings(world.missionIndex, world.seed);
  world.sortieScore = 0;
  world.ringsPassed = 0;
  world.sortieTime = 0;
  world.screen = SCREEN_PLAY;
  const m = mission(world);
  say(world, `${m.name} — ${m.brief}`, 5);
}

/** Advance the world one fixed step while playing. Returns events for sound. */
export function stepWorld(world, stick, dt) {
  if (world.screen !== SCREEN_PLAY) return [];
  const events = [];
  world.elapsed += dt;
  world.sortieTime += dt;
  const m = mission(world);
  const ev = stepPlane(world.plane, stick, m.wind, dt);
  const p = world.plane;

  if (ev === 'landed') {
    const soft = -p.verticalSpeed <= 2.5;
    const landingScore = SCORE.landing + (soft ? SCORE.landingSoftBonus : 0);
    const timeBonus = Math.max(0, Math.round((240 - world.sortieTime) * SCORE.timeBonusPerSecond));
    world.sortieScore += landingScore + timeBonus;
    world.score += landingScore + timeBonus;
    world.landedCount += 1;
    events.push(soft ? 'landed-soft' : 'landed');
    if (world.missionIndex + 1 >= MISSIONS.length) {
      world.screen = SCREEN_WIN;
      world.best = Math.max(world.best, world.score);
      say(world, `TOUR COMPLETE — ${world.score} points`, 8);
    } else {
      world.missionIndex += 1;
      startSortie(world);
      say(world, `LANDED! +${landingScore + timeBonus} — refuelled, next sortie`, 5);
    }
    return events;
  }
  if (ev === 'terrain' || ev === 'water') {
    events.push('crash');
    world.screen = SCREEN_OVER;
    world.best = Math.max(world.best, world.score);
    return events;
  }
  if (ev === 'bounce') {
    events.push('bounce');
    flash(world, 'HARD LANDING — AIRFRAME DAMAGED', 2);
  }
  if (p.stalled && world.elapsed > (world.stallWarnedAt ?? 0)) {
    world.stallWarnedAt = world.elapsed + 2;
    flash(world, 'STALL — LOWER THE NOSE, ADD POWER', 2);
  }
  if (p.fuel < 20 && p.fuel > 0 && world.elapsed > (world.fuelWarnedAt ?? 0)) {
    world.fuelWarnedAt = world.elapsed + 4;
    flash(world, 'LOW FUEL', 2);
  }
  if (p.fuel <= 0) flash(world, 'FUEL EMPTY — GLIDE HER IN', 1.5);

  // Ring checks: pass through the ring's disc.
  const ring = nextRing(world);
  if (ring) {
    const dx = p.x - ring.x;
    const dy = p.y - ring.y;
    const dz = p.z - ring.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < ring.radius + 6) {
      const centrePass = dist < ring.radius * 0.45;
      ring.passed = true;
      ring.centre = centrePass;
      world.ringsPassed += 1;
      const pts = SCORE.ring + (centrePass ? SCORE.ringCentreBonus : 0);
      world.sortieScore += pts;
      world.score += pts;
      events.push(centrePass ? 'ring-centre' : 'ring');
      say(
        world,
        centrePass
          ? `RING ${world.ringsPassed} — DEAD CENTRE! +${pts}`
          : `RING ${world.ringsPassed} +${pts}`,
        2.2,
      );
      if (ringsLeft(world) === 1) {
        say(world, 'LAST RING — THEN LAND ON RUNWAY 18', 4);
      }
    }
  }
  return events;
}

/** Reset everything for a fresh game from the title screen. */
export function resetGame(world) {
  world.missionIndex = 0;
  world.score = 0;
  world.landedCount = 0;
  world.elapsed = 0;
  startSortie(world);
}
