// A simple autopilot that flies the ring course: it steers toward the next
// ring, levels off on approach, and throttles for a steady cruise. It exists
// so screenshots show the real game flown well, and so the title screen can
// run an attract-mode demo behind it.
import { nextRing, mission } from './world.js';
import { forwardVector } from './plane.js';
import { terrainHeight } from './terrain.js';
import { RUNWAY } from './config.js';

/**
 * Steer the plane toward the next ring (or the runway when the rings are
 * done). Returns a stick { pitch, roll, throttleDelta }.
 */
export function autopilotStick(world) {
  const p = world.plane;
  const ring = nextRing(world);
  let tx;
  let ty;
  let tz;
  let wantSpeed = 42;
  if (ring) {
    tx = ring.x;
    ty = ring.y;
    tz = ring.z;
  } else {
    // Final approach: ride a steady 3-degree glide path down the runway,
    // never dipping below the hills south of the strip. The target always
    // stays ahead of the nose, so the aeroplane never turns back for a
    // point it has already passed. Aim upwind of the centreline so the
    // crosswind drifts the plane onto it, not off it.
    const wind = mission(world).wind;
    const ahead = 300;
    tx = RUNWAY.x - wind * 8;
    tz = p.z - ahead;
    const glide = 0.5 + Math.max(0, (p.z - RUNWAY.z) * 0.05);
    if (p.z > RUNWAY.z + RUNWAY.length / 2) {
      // Still over the hills south of the strip: stay above them.
      const terrainClear = terrainHeight(RUNWAY.x, Math.max(p.z - 150, RUNWAY.z)) + 25;
      ty = Math.max(glide, terrainClear);
    } else {
      ty = glide;
    }
    wantSpeed = 26;
  }
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dz = tz - p.z;
  const dist = Math.hypot(dx, dy, dz) || 1;
  // Desired heading and pitch to the target.
  const wantYaw = Math.atan2(dx, -dz);
  let yawError = wantYaw - p.yaw;
  while (yawError > Math.PI) yawError -= Math.PI * 2;
  while (yawError < -Math.PI) yawError += Math.PI * 2;
  const wantPitch = (() => {
    // Pitch for a vertical speed that closes the altitude error.
    const vsTarget = Math.max(-9, Math.min(9, (ty - p.y) * 0.6));
    const ratio = Math.max(-0.9, Math.min(0.9, vsTarget / Math.max(p.speed, 10)));
    return Math.max(-0.4, Math.min(0.4, Math.asin(ratio)));
  })();
  // Bank into the turn, pitch toward the target. While a ring is still the
  // target, ease off near the ground; on final approach the glide path is
  // allowed to take the plane all the way down to the strip.
  const ground = terrainHeight(p.x, p.z);
  const clearance = p.y - ground;
  let pitch = (wantPitch - p.pitch) * 1.6;
  if (ring && clearance < 25) pitch = Math.max(pitch, 0.25);
  const roll = Math.max(-1, Math.min(1, yawError * 1.4));
  const throttleDelta = p.speed < wantSpeed ? 1 : p.speed > wantSpeed + 4 ? -1 : 0;
  void dist;
  return { pitch: Math.max(-1, Math.min(1, pitch)), roll, throttleDelta };
}

/** A gentler autopilot for the title-screen demo: circles the valley. */
export function demoStick(world) {
  const p = world.plane;
  // Fly a wide lazy circuit around the airfield.
  const cx = -600;
  const cz = 400;
  const dx = cx - p.x;
  const dz = cz - p.z;
  const wantYaw = Math.atan2(dx, -dz) + 0.9;
  let yawError = wantYaw - p.yaw;
  while (yawError > Math.PI) yawError -= Math.PI * 2;
  while (yawError < -Math.PI) yawError += Math.PI * 2;
  const ground = terrainHeight(p.x, p.z);
  const wantAlt = ground + 120;
  const pitch = Math.max(-0.3, Math.min(0.3, (wantAlt - p.y) * 0.01));
  return {
    pitch,
    roll: Math.max(-0.6, Math.min(0.6, yawError * 1.2)),
    throttleDelta: p.speed < 40 ? 1 : -1,
  };
}

export function autopilotForward(world) {
  return forwardVector(world.plane);
}
