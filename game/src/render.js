// The chase camera and the software 3D renderer: sky, heightfield terrain,
// runway, town, rings and the Kestrel herself, all drawn on one canvas
// with a painter's sort. No library, no WebGL, no network.
import { GAME, WORLD, RUNWAY } from './config.js';
import { terrainHeight, groundColour, HOUSES, TREES, HANGARS, BEACON } from './terrain.js';
import { forwardVector } from './plane.js';
import { mulberry32 } from './random.js';

const GRID = Math.round(WORLD.size / WORLD.cell); // 100 cells across
const HALF = WORLD.size / 2;

// Precomputed terrain heights at every grid point.
const heights = new Float32Array((GRID + 1) * (GRID + 1));
for (let gz = 0; gz <= GRID; gz += 1) {
  for (let gx = 0; gx <= GRID; gx += 1) {
    heights[gz * (GRID + 1) + gx] = terrainHeight(-HALF + gx * WORLD.cell, -HALF + gz * WORLD.cell);
  }
}
function gridHeight(gx, gz) {
  const x = Math.max(0, Math.min(GRID, gx));
  const z = Math.max(0, Math.min(GRID, gz));
  return heights[z * (GRID + 1) + x];
}

const cloudRng = mulberry32(99);
const CLOUDS = [];
for (let i = 0; i < 26; i += 1) {
  CLOUDS.push({
    x: -2800 + cloudRng() * 5600,
    y: 430 + cloudRng() * 220,
    z: -2800 + cloudRng() * 5600,
    r: 90 + cloudRng() * 130,
  });
}

const SUN_DIR = norm({ x: -0.45, y: 0.62, z: -0.55 });

function norm(v) {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/** Camera basis for a chase view behind the plane. */
export function computeCamera(plane, time) {
  const fwd = forwardVector(plane);
  const bob = Math.sin(time * 2.1) * 0.12 * (plane.speed / 60);
  const camPos = {
    x: plane.x - fwd.x * 26,
    y: plane.y - fwd.y * 26 + 7 + bob,
    z: plane.z - fwd.z * 26,
  };
  const look = { x: plane.x + fwd.x * 34, y: plane.y + fwd.y * 34 - 1, z: plane.z + fwd.z * 34 };
  let forward = norm({ x: look.x - camPos.x, y: look.y - camPos.y, z: look.z - camPos.z });
  let right = norm(cross(forward, { x: 0, y: 1, z: 0 }));
  let up = cross(right, forward);
  // The camera rolls with the plane, but only part-way, so it never fights the pilot.
  const rollAngle = plane.roll * 0.45;
  const c = Math.cos(rollAngle);
  const s = Math.sin(rollAngle);
  const r2 = { x: right.x * c + up.x * s, y: right.y * c + up.y * s, z: right.z * c + up.z * s };
  const u2 = { x: up.x * c - right.x * s, y: up.y * c - right.y * s, z: up.z * c - right.z * s };
  return { pos: camPos, forward, right: r2, up: u2 };
}

/** A projector: world point -> screen point (null when behind the camera). */
export function makeProjector(cam, width, height) {
  const focal = (height / 2) / Math.tan((62 * Math.PI) / 360);
  return function project(p) {
    const v = { x: p.x - cam.pos.x, y: p.y - cam.pos.y, z: p.z - cam.pos.z };
    const cx = dot(v, cam.right);
    const cy = dot(v, cam.up);
    const cz = dot(v, cam.forward);
    if (cz < 1.5) return null;
    const scale = focal / cz;
    return { x: width / 2 + cx * scale, y: height / 2 - cy * scale, depth: cz, scale };
  };
}

function hazeMix(rgb, dist) {
  const t = Math.min(1, Math.max(0, (dist - 500) / 1300));
  const sky = [168, 196, 222];
  return `rgb(${Math.round(rgb[0] + (sky[0] - rgb[0]) * t)},${Math.round(rgb[1] + (sky[1] - rgb[1]) * t)},${Math.round(rgb[2] + (sky[2] - rgb[2]) * t)})`;
}

function shade(rgb, light) {
  return `rgb(${Math.round(rgb[0] * light)},${Math.round(rgb[1] * light)},${Math.round(rgb[2] * light)})`;
}

/** Draw the sky gradient and the sun. */
export function drawSky(ctx, width, height, cam) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#2f6fb4');
  g.addColorStop(0.45, '#7fb2dd');
  g.addColorStop(0.62, '#c3d9e8');
  g.addColorStop(1, '#dfe9ee');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  // Sun disc, projected from far away along its direction.
  const sunPoint = { x: cam.pos.x + SUN_DIR.x * 4000, y: cam.pos.y + SUN_DIR.y * 4000, z: cam.pos.z + SUN_DIR.z * 4000 };
  const project = makeProjector(cam, width, height);
  const s = project(sunPoint);
  if (s) {
    ctx.fillStyle = 'rgba(255,244,200,0.95)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,244,200,0.25)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 46, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw terrain quads, the runway, houses, trees and hangars. */
export function drawWorld(ctx, cam, project) {
  const polys = [];
  const camGx = Math.round((cam.pos.x + HALF) / WORLD.cell);
  const camGz = Math.round((cam.pos.z + HALF) / WORLD.cell);
  const range = Math.ceil(WORLD.viewDistance / WORLD.cell) + 1;

  for (let gz = Math.max(0, camGz - range); gz < Math.min(GRID, camGz + range); gz += 1) {
    for (let gx = Math.max(0, camGx - range); gx < Math.min(GRID, camGx + range); gx += 1) {
      const x0 = -HALF + gx * WORLD.cell;
      const z0 = -HALF + gz * WORLD.cell;
      const cx = x0 + WORLD.cell / 2;
      const cz = z0 + WORLD.cell / 2;
      const dx = cx - cam.pos.x;
      const dz = cz - cam.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > WORLD.viewDistance) continue;
      // Behind the camera?
      const rel = { x: dx, y: 0, z: dz };
      if (dot(rel, cam.forward) < -WORLD.cell * 2) continue;
      const h00 = gridHeight(gx, gz);
      const h10 = gridHeight(gx + 1, gz);
      const h01 = gridHeight(gx, gz + 1);
      const h11 = gridHeight(gx + 1, gz + 1);
      const midH = (h00 + h10 + h01 + h11) / 4;
      const base = groundColour(cx, cz, midH);
      // Slope shading: brighter on sun-facing slopes.
      const slopeX = (h10 + h11 - h00 - h01) / (2 * WORLD.cell);
      const slopeZ = (h01 + h11 - h00 - h10) / (2 * WORLD.cell);
      const n = norm({ x: -slopeX, y: 1, z: -slopeZ });
      const light = 0.72 + 0.38 * Math.max(0, dot(n, SUN_DIR));
      const p0 = project({ x: x0, y: h00, z: z0 });
      const p1 = project({ x: x0 + WORLD.cell, y: h10, z: z0 });
      const p2 = project({ x: x0 + WORLD.cell, y: h11, z: z0 + WORLD.cell });
      const p3 = project({ x: x0, y: h01, z: z0 + WORLD.cell });
      if (!p0 || !p1 || !p2 || !p3) continue;
      polys.push({
        depth: (p0.depth + p1.depth + p2.depth + p3.depth) / 4,
        fill: hazeMix(base.map((c) => c * light), (p0.depth + p2.depth) / 2),
        pts: [p0, p1, p2, p3],
      });
    }
  }

  // Runway strip: asphalt quads with a centreline, laid over the flat field.
  const runwayPolys = buildRunwayPolys(project);
  for (const rp of runwayPolys) polys.push(rp);

  polys.sort((a, b) => b.depth - a.depth);
  for (const poly of polys) {
    ctx.fillStyle = poly.fill;
    ctx.strokeStyle = poly.fill; // same-colour stroke closes antialiasing seams
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(poly.pts[0].x, poly.pts[0].y);
    for (let i = 1; i < poly.pts.length; i += 1) ctx.lineTo(poly.pts[i].x, poly.pts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Buildings and trees, far to near.
  const props = [];
  for (const house of HOUSES) {
    const d = Math.hypot(house.x - cam.pos.x, house.z - cam.pos.z);
    if (d < 900) props.push({ depth: d, kind: 'house', item: house });
  }
  for (const tree of TREES) {
    const d = Math.hypot(tree.x - cam.pos.x, tree.z - cam.pos.z);
    if (d < 500) props.push({ depth: d, kind: 'tree', item: tree });
  }
  for (const hangar of HANGARS) {
    const d = Math.hypot(hangar.x - cam.pos.x, hangar.z - cam.pos.z);
    if (d < 1200) props.push({ depth: d, kind: 'hangar', item: hangar });
  }
  const beaconD = Math.hypot(BEACON.x - cam.pos.x, BEACON.z - cam.pos.z);
  if (beaconD < 1200) props.push({ depth: beaconD, kind: 'beacon', item: BEACON });
  props.sort((a, b) => b.depth - a.depth);
  for (const prop of props) drawProp(ctx, project, prop, cam);
}

/** Runway asphalt + white dashes + threshold bars, as screen polygons. */
function buildRunwayPolys(project) {
  const out = [];
  const halfW = RUNWAY.width / 2;
  const halfL = RUNWAY.length / 2;
  const cx = RUNWAY.x;
  const cz = RUNWAY.z;
  const y = 1.0;
  // Asphalt in 8 lengthwise slabs so it curves with the terrain flattening.
  for (let i = 0; i < 8; i += 1) {
    const z0 = cz - halfL + (i * RUNWAY.length) / 8;
    const z1 = cz - halfL + ((i + 1) * RUNWAY.length) / 8;
    const pts = [
      project({ x: cx - halfW, y, z: z0 }),
      project({ x: cx + halfW, y, z: z0 }),
      project({ x: cx + halfW, y, z: z1 }),
      project({ x: cx - halfW, y, z: z1 }),
    ];
    if (pts.some((p) => !p)) continue;
    const depth = pts.reduce((s, p) => s + p.depth, 0) / 4;
    out.push({ depth: depth - 0.5, fill: hazeMix([52, 54, 58], depth), pts });
  }
  // Centreline dashes.
  for (let i = 0; i < 12; i += 1) {
    const z0 = cz - halfL + 40 + i * 46;
    const z1 = z0 + 24;
    const pts = [
      project({ x: cx - 1.2, y: y + 0.2, z: z0 }),
      project({ x: cx + 1.2, y: y + 0.2, z: z0 }),
      project({ x: cx + 1.2, y: y + 0.2, z: z1 }),
      project({ x: cx - 1.2, y: y + 0.2, z: z1 }),
    ];
    if (pts.some((p) => !p)) continue;
    const depth = pts.reduce((s, p) => s + p.depth, 0) / 4;
    out.push({ depth: depth - 1, fill: hazeMix([235, 235, 225], depth), pts });
  }
  return out;
}

/** One building / tree / hangar / beacon, drawn as projected boxes. */
function drawProp(ctx, project, prop, cam) {
  const { kind, item } = prop;
  if (kind === 'tree') {
    const base = terrainHeight(item.x, item.z);
    const top = project({ x: item.x, y: base + 9 * item.s, z: item.z });
    const b1 = project({ x: item.x - 3 * item.s, y: base, z: item.z });
    const b2 = project({ x: item.x + 3 * item.s, y: base, z: item.z });
    if (!top || !b1 || !b2) return;
    ctx.fillStyle = '#3d6b2f';
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (kind === 'beacon') {
    const base = terrainHeight(item.x, item.z);
    const top = project({ x: item.x, y: base + item.h, z: item.z });
    const b = project({ x: item.x, y: base, z: item.z });
    if (!top || !b) return;
    ctx.strokeStyle = '#c33';
    ctx.lineWidth = Math.max(2, 300 / prop.depth);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    ctx.fillStyle = '#ff5544';
    ctx.beginPath();
    ctx.arc(top.x, top.y, Math.max(3, 160 / prop.depth), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Boxes: house or hangar.
  const w = kind === 'hangar' ? item.w / 2 : 7 * item.s;
  const d = kind === 'hangar' ? item.d / 2 : 6 * item.s;
  const h = kind === 'hangar' ? item.h : 5 * item.s + 2;
  const base = terrainHeight(item.x, item.z);
  const cos = Math.cos(item.rot ?? 0);
  const sin = Math.sin(item.rot ?? 0);
  const corners = [
    { x: -w, z: -d },
    { x: w, z: -d },
    { x: w, z: d },
    { x: -w, z: d },
  ].map((c) => ({
    x: item.x + c.x * cos - c.z * sin,
    z: item.z + c.x * sin + c.z * cos,
  }));
  const bottom = corners.map((c) => project({ x: c.x, y: base, z: c.z }));
  const top = corners.map((c) => project({ x: c.x, y: base + h, z: c.z }));
  if (bottom.some((p) => !p) || top.some((p) => !p)) return;
  const tones = kind === 'hangar' ? ['#b8bec4', '#9aa1a8', '#7d838a'] : ['#d8c49a', '#b98d5f', '#8a6a45'];
  // Walls: draw only the faces whose outward normal points at the camera.
  const face = (a, b, colour) => {
    const midX = (corners[a].x + corners[b].x) / 2;
    const midZ = (corners[a].z + corners[b].z) / 2;
    const ex = corners[b].x - corners[a].x;
    const ez = corners[b].z - corners[a].z;
    // Outward normal in the xz-plane (rotate edge by -90 degrees).
    const nx = -ez;
    const nz = ex;
    const toCamX = cam.pos.x - midX;
    const toCamZ = cam.pos.z - midZ;
    if (nx * toCamX + nz * toCamZ <= 0) return;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(bottom[a].x, bottom[a].y);
    ctx.lineTo(bottom[b].x, bottom[b].y);
    ctx.lineTo(top[b].x, top[b].y);
    ctx.lineTo(top[a].x, top[a].y);
    ctx.closePath();
    ctx.fill();
  };
  face(0, 1, tones[0]);
  face(1, 2, tones[1]);
  face(2, 3, tones[0]);
  face(3, 0, tones[1]);
  // Roof.
  ctx.fillStyle = tones[2];
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  ctx.lineTo(top[1].x, top[1].y);
  ctx.lineTo(top[2].x, top[2].y);
  ctx.lineTo(top[3].x, top[3].y);
  ctx.closePath();
  ctx.fill();
}

/** Clouds: soft white ellipses, far to near. */
export function drawClouds(ctx, project, cam) {
  const sorted = [...CLOUDS].sort((a, b) => {
    const da = Math.hypot(a.x - cam.pos.x, a.z - cam.pos.z);
    const db = Math.hypot(b.x - cam.pos.x, b.z - cam.pos.z);
    return db - da;
  });
  for (const cloud of sorted) {
    const p = project(cloud);
    if (!p) continue;
    const r = cloud.r * p.scale;
    if (r < 2) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    for (const [ox, oy, s] of [[-0.5, 0, 0.7], [0, -0.15, 1], [0.55, 0.05, 0.65]]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * r, p.y + oy * r, r * s, r * s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// --- The Kestrel, a small orange-and-cream cargo plane ---

// Local model: forward is -z, wings span x. Triangles: [a, b, c, colour].
const PLANE_TRIS = (() => {
  const tris = [];
  const tri = (a, b, c, colour) => tris.push([a, b, c, colour]);
  const orange = '#e86a1e';
  const cream = '#f4ead2';
  const dark = '#33302c';
  const glass = '#7ec8e8';
  // Fuselage: tapered box from nose (z=-5.2) to tail (z=4.2).
  const nose = [0, 0, -5.2];
  const midTop = [0, 1.1, -0.5];
  const midBot = [0, -1.0, -0.5];
  const tailTop = [0, 0.7, 4.2];
  const tailBot = [0, -0.5, 4.2];
  const left = [-1.1, 0, -0.5];
  const right = [1.1, 0, -0.5];
  tri(nose, midTop, left, orange);
  tri(nose, right, midTop, orange);
  tri(nose, left, midBot, cream);
  tri(nose, midBot, right, cream);
  tri(midTop, tailTop, left, orange);
  tri(midTop, right, tailTop, orange);
  tri(midBot, left, tailBot, cream);
  tri(midBot, tailBot, right, cream);
  tri(left, tailTop, tailBot, cream);
  tri(right, tailBot, tailTop, cream);
  tri(midTop, tailTop, tailBot, orange);
  tri(midBot, tailBot, tailTop, orange);
  // Canopy.
  tri([-0.55, 1.0, -2.2], [0.55, 1.0, -2.2], [0, 1.55, -0.6], glass);
  tri([0.55, 1.0, -2.2], [0.55, 1.0, -0.4], [0, 1.55, -0.6], glass);
  tri([-0.55, 1.0, -0.4], [-0.55, 1.0, -2.2], [0, 1.55, -0.6], glass);
  // Main wing (slight dihedral), tailplane, fin.
  tri([-7.2, 0.25, 0.4], [-7.2, 0.25, 1.6], [0, 0.1, 1.4], orange);
  tri([-7.2, 0.25, 0.4], [0, 0.1, 1.4], [0, 0.1, -0.2], orange);
  tri([7.2, 0.25, 0.4], [0, 0.1, 1.4], [7.2, 0.25, 1.6], orange);
  tri([7.2, 0.25, 0.4], [0, 0.1, -0.2], [0, 0.1, 1.4], orange);
  tri([-2.6, 0.15, 3.4], [-2.6, 0.15, 4.3], [0, 0.1, 4.2], cream);
  tri([2.6, 0.15, 3.4], [0, 0.1, 4.2], [2.6, 0.15, 4.3], cream);
  tri([0, 0.6, 2.9], [0, 0.6, 4.3], [0, 2.3, 4.1], orange);
  // Propeller hub.
  tri(nose, [0.35, 0.35, -5.3], [0.35, -0.35, -5.3], dark);
  return tris;
})();

/** Rotate a local point by the plane's yaw/pitch/roll and move it to the plane. */
function planeToWorld(p, local) {
  const cy = Math.cos(p.yaw);
  const sy = Math.sin(p.yaw);
  const cp = Math.cos(p.pitch);
  const sp = Math.sin(p.pitch);
  const cr = Math.cos(p.roll);
  const sr = Math.sin(p.roll);
  // Local axes: x right, y up, z back. Apply roll, then pitch, then yaw.
  let [x, y, z] = local;
  let x1 = x * cr - y * sr;
  let y1 = x * sr + y * cr;
  let z1 = z;
  let y2 = y1 * cp - z1 * sp;
  let z2 = y1 * sp + z1 * cp;
  let x2 = x1;
  const x3 = x2 * cy + z2 * sy;
  const z3 = -x2 * sy + z2 * cy;
  return { x: p.x + x3, y: p.y + y2, z: p.z + z3 };
}

export function drawPlane(ctx, project, plane, time) {
  const tris = [];
  for (const [a, b, c, colour] of PLANE_TRIS) {
    const pa = project(planeToWorld(plane, a));
    const pb = project(planeToWorld(plane, b));
    const pc = project(planeToWorld(plane, c));
    if (!pa || !pb || !pc) continue;
    tris.push({ depth: (pa.depth + pb.depth + pc.depth) / 3, pts: [pa, pb, pc], colour });
  }
  tris.sort((a, b) => b.depth - a.depth);
  for (const t of tris) {
    ctx.fillStyle = t.colour;
    ctx.beginPath();
    ctx.moveTo(t.pts[0].x, t.pts[0].y);
    ctx.lineTo(t.pts[1].x, t.pts[1].y);
    ctx.lineTo(t.pts[2].x, t.pts[2].y);
    ctx.closePath();
    ctx.fill();
  }
  // Spinning propeller: a faint disc and two thin blades at the nose, so it
  // reads as motion blur rather than a black sign.
  const hub = project(planeToWorld(plane, [0, 0, -5.35]));
  if (hub) {
    const r = 1.5 * hub.scale;
    ctx.fillStyle = 'rgba(220,220,220,0.10)';
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, r, 0, Math.PI * 2);
    ctx.fill();
    const angle = time * 28;
    ctx.strokeStyle = 'rgba(40,38,34,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hub.x - Math.cos(angle) * r, hub.y - Math.sin(angle) * r);
    ctx.lineTo(hub.x + Math.cos(angle) * r, hub.y + Math.sin(angle) * r);
    ctx.moveTo(hub.x - Math.cos(angle + Math.PI / 2) * r, hub.y - Math.sin(angle + Math.PI / 2) * r);
    ctx.lineTo(hub.x + Math.cos(angle + Math.PI / 2) * r, hub.y + Math.sin(angle + Math.PI / 2) * r);
    ctx.stroke();
  }
}

// --- Rings ---

/** A glowing ring the pilot must fly through, drawn as a circle in 3D. */
export function drawRing(ctx, project, ring, time) {
  const centre = project(ring);
  if (!centre) return;
  const pulse = 1 + Math.sin(time * 3) * 0.04;
  const radius = ring.radius * pulse;
  // Ring plane faces the camera horizontally: use camera-right/up in world space.
  // Approximate with a circle in the plane perpendicular to the view direction:
  // we rebuild it from the projected centre and screen scale, which reads as a
  // ring facing the pilot at any angle.
  const r = radius * centre.scale;
  ctx.lineWidth = Math.max(3, r * 0.09);
  ctx.strokeStyle = ring.passed ? 'rgba(90,220,120,0.85)' : 'rgba(255,190,40,0.95)';
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, r * 0.03);
  ctx.strokeStyle = ring.passed ? 'rgba(90,220,120,0.4)' : 'rgba(255,220,120,0.5)';
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, r * 1.12, 0, Math.PI * 2);
  ctx.stroke();
  // Tick marks around the ring.
  ctx.fillStyle = ring.passed ? '#5adc78' : '#ffbe28';
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + time * 0.4;
    const px = centre.x + Math.cos(a) * r;
    const py = centre.y + Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2, r * 0.035), 0, Math.PI * 2);
    ctx.fill();
  }
}
