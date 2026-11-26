// The Kestrel: an arcade flight model. Pitch and roll answer the stick,
// banked turns pull the nose around, throttle sets the target speed, and
// a slow aeroplane sinks. All angles in radians, speeds in m/s.
import { FLIGHT, RUNWAY } from './config.js';
import { terrainHeight, onRunway } from './terrain.js';

export function createPlane() {
  const startX = RUNWAY.x - 200;
  const startZ = RUNWAY.z + 800; // east of the airfield, heading for ring one
  return {
    x: startX,
    y: terrainHeight(startX, startZ) + 95, // well clear of the hills
    z: startZ,
    yaw: Math.PI / 2, // facing east
    pitch: 0,
    roll: 0,
    speed: FLIGHT.cruiseSpeed,
    throttle: 0.62,
    fuel: FLIGHT.fuelCapacity,
    damage: 0,
    verticalSpeed: 0,
    stalled: false,
    landed: false,
    crashed: false,
    crashReason: '',
  };
}

/** Forward unit vector from yaw/pitch (y up). */
export function forwardVector(p) {
  const cy = Math.cos(p.yaw);
  const sy = Math.sin(p.yaw);
  const cp = Math.cos(p.pitch);
  const sp = Math.sin(p.pitch);
  return { x: sy * cp, y: sp, z: -cy * cp };
}

/**
 * Advance the plane one fixed step. `stick` is { pitch, roll, throttleDelta }
 * with pitch/roll in [-1, 1]. `wind` is a crosswind speed in m/s.
 * Returns an event string: '' | 'stall' | 'terrain' | 'landed' | 'water'.
 */
export function stepPlane(p, stick, wind, dt) {
  if (p.crashed || p.landed) return '';

  // Throttle and speed.
  p.throttle = Math.max(0, Math.min(1, p.throttle + stick.throttleDelta * dt * 0.9));
  if (p.fuel <= 0) p.throttle = 0;
  const targetSpeed = p.throttle * FLIGHT.maxSpeed;
  const accel = targetSpeed > p.speed ? FLIGHT.accel : FLIGHT.accel * 0.7;
  p.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - p.speed));
  p.speed = Math.max(0, p.speed - FLIGHT.drag * (p.speed / FLIGHT.maxSpeed) * dt * 8);

  // Attitude: stick moves pitch and roll toward their targets.
  const pitchTarget = stick.pitch * FLIGHT.maxPitch;
  const rollTarget = stick.roll * FLIGHT.maxRoll;
  p.pitch += (pitchTarget - p.pitch) * Math.min(1, dt * 3.2);
  p.roll += (rollTarget - p.roll) * Math.min(1, dt * 4.0);
  // Banked turn: yaw follows the roll (right bank turns right).
  p.yaw += p.roll * FLIGHT.turnRate * (p.speed / FLIGHT.maxSpeed) * dt;
  p.pitch = Math.max(-FLIGHT.maxPitch, Math.min(FLIGHT.maxPitch, p.pitch));

  // Motion.
  const fwd = forwardVector(p);
  const prevY = p.y;
  p.x += (fwd.x * p.speed + wind) * dt;
  p.z += fwd.z * p.speed * dt;
  p.y += fwd.y * p.speed * dt;
  p.verticalSpeed = (p.y - prevY) / dt;

  // Stall: too slow and the nose cannot hold altitude.
  p.stalled = p.speed < FLIGHT.minSpeed;
  if (p.stalled) p.y -= FLIGHT.gravitySink * (1 - p.speed / FLIGHT.minSpeed) * dt;

  // Fuel: about eight minutes of flying at cruise throttle per tank.
  p.fuel = Math.max(0, p.fuel - 0.22 * (0.3 + p.throttle) * dt);

  // Ground contact.
  const ground = terrainHeight(p.x, p.z);
  if (p.y <= ground + FLIGHT.groundClearance) {
    if (onRunway(p.x, p.z)) {
      const sink = -p.verticalSpeed;
      if (sink <= FLIGHT.safeLandingSink && p.speed <= FLIGHT.safeLandingSpeed + 12 && Math.abs(p.roll) < 0.35) {
        p.y = ground + 1.2;
        p.landed = true;
        return 'landed';
      }
      // Hard arrival on the strip: damage, bounce, keep flying if fast.
      p.damage += 34;
      p.y = ground + 6;
      p.speed *= 0.55;
      p.pitch = 0.12;
      if (p.damage >= 100) {
        p.crashed = true;
        p.crashReason = 'You slammed into the runway.';
        return 'terrain';
      }
      return 'bounce';
    }
    p.crashed = true;
    p.crashReason = p.y <= 4 ? 'You ditched in the lake.' : 'You flew into the hillside.';
    return 'terrain';
  }
  if (p.y < 2) {
    p.crashed = true;
    p.crashReason = 'You ditched in the lake.';
    return 'water';
  }
  return '';
}

/** Compass heading in degrees: 0 = north, 90 = east. */
export function headingDegrees(p) {
  const f = forwardVector(p);
  const deg = (Math.atan2(f.x, -f.z) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Airspeed in knots, altitude in feet, for the HUD. */
export function knots(p) {
  return Math.round(p.speed * 1.94384);
}
export function feet(p) {
  return Math.round(p.y * 3.28084);
}
