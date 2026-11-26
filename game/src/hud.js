// The instrument panel: compass tape, airspeed and altitude tapes, throttle
// and fuel bars, artificial horizon, ring pointer, messages and the title,
// pause, crash and win screens. Drawn on the same canvas as the world.
import { GAME, MISSIONS } from './config.js';
import { headingDegrees, knots, feet } from './plane.js';
import { nextRing, ringsLeft, mission, SCREEN_TITLE, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN } from './world.js';

const W = GAME.canvasWidth;
const H = GAME.canvasHeight;

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,18,28,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(140,220,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function text(ctx, str, x, y, size, colour, align = 'left') {
  ctx.font = `bold ${size}px "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(6,14,22,0.75)'; // dark echo so text reads over clouds
  ctx.fillText(str, x + 1, y + 1);
  ctx.fillStyle = colour;
  ctx.fillText(str, x, y);
}

function compassLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const i = Math.round(deg / 45) % 8;
  return dirs[i];
}

/** Compass tape across the top, with the current heading boxed. */
export function drawCompass(ctx, plane) {
  const heading = headingDegrees(plane);
  const cx = W / 2;
  panel(ctx, cx - 190, 12, 380, 34);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 190, 12, 380, 34);
  ctx.clip();
  for (let d = -60; d <= 60; d += 5) {
    const deg = Math.round((heading + d) / 5) * 5;
    const norm = ((deg % 360) + 360) % 360;
    const x = cx + (norm - heading) * 3.2;
    const major = norm % 45 === 0;
    ctx.strokeStyle = 'rgba(200,235,255,0.8)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 12 + (major ? 8 : 16));
    ctx.lineTo(x, 12 + 22);
    ctx.stroke();
    if (major) text(ctx, norm % 90 === 0 ? compassLabel(norm) : String(norm), x, 36, 11, '#cfeeff', 'center');
  }
  ctx.restore();
  ctx.fillStyle = '#ffb020';
  ctx.beginPath();
  ctx.moveTo(cx - 6, 12);
  ctx.lineTo(cx + 6, 12);
  ctx.lineTo(cx, 20);
  ctx.closePath();
  ctx.fill();
  text(ctx, `${String(Math.round(heading)).padStart(3, '0')}°`, cx, 52, 13, '#ffe9b0', 'center');
}

/** Vertical tape: current value boxed, ticks above and below. */
function drawTape(ctx, x, y, h, value, unit, step, format) {
  panel(ctx, x, y, 74, h);
  const cy = y + h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, 74, h);
  ctx.clip();
  // Scale so the tape shows four steps either side of the current value.
  const pxPerUnit = (h / 2 - 8) / (step * 4);
  for (let v = Math.floor((value - step * 4) / step) * step; v <= value + step * 4; v += step) {
    if (unit === 'FT' && v < 0) continue;
    const ty = cy - (v - value) * pxPerUnit;
    if (ty < y + 6 || ty > y + h - 6) continue;
    const major = v % (step * 5) === 0;
    ctx.strokeStyle = 'rgba(200,235,255,0.7)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, ty);
    ctx.lineTo(x + (major ? 22 : 16), ty);
    ctx.stroke();
    text(ctx, format(v), x + 26, ty, 11, '#cfeeff');
  }
  ctx.restore();
  ctx.fillStyle = '#ffb020';
  ctx.fillRect(x, cy - 13, 74, 26);
  text(ctx, `${format(value)} ${unit}`, x + 37, cy, 14, '#101820', 'center');
}

export function drawInstruments(ctx, world) {
  const p = world.plane;
  drawCompass(ctx, p);
  drawTape(ctx, 16, 120, 220, knots(p), 'KT', 10, (v) => String(Math.round(v)));
  text(ctx, 'AIRSPEED', 53, 108, 12, '#bfe6ff', 'center');
  drawTape(ctx, W - 90, 120, 220, feet(p), 'FT', 100, (v) => String(Math.round(v)));
  text(ctx, 'ALTITUDE', W - 53, 108, 12, '#bfe6ff', 'center');

  // Throttle bar, bottom left.
  panel(ctx, 16, H - 64, 170, 48);
  text(ctx, 'THROTTLE', 26, H - 48, 11, '#bfe6ff');
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(26, H - 34, 150, 10);
  ctx.fillStyle = '#4fc3f7';
  ctx.fillRect(26, H - 34, 150 * p.throttle, 10);

  // Fuel bar, bottom right.
  panel(ctx, W - 186, H - 64, 170, 48);
  text(ctx, 'FUEL', W - 176, H - 48, 11, p.fuel < 20 ? '#ff7070' : '#bfe6ff');
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(W - 176, H - 34, 150, 10);
  ctx.fillStyle = p.fuel < 20 ? '#ff5555' : '#7ed957';
  ctx.fillRect(W - 176, H - 34, 150 * (p.fuel / 100), 10);

  // Artificial horizon, bottom centre.
  const hx = W / 2;
  const hy = H - 40;
  const hr = 30;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-p.roll);
  ctx.fillStyle = '#3d7ab8';
  ctx.fillRect(-hr, -hr - p.pitch * 60, hr * 2, hr);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-hr, -p.pitch * 60, hr * 2, hr * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-hr, -p.pitch * 60);
  ctx.lineTo(hr, -p.pitch * 60);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(200,235,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings marker.
  ctx.strokeStyle = '#ffb020';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hx - 18, hy);
  ctx.lineTo(hx - 6, hy);
  ctx.moveTo(hx + 6, hy);
  ctx.lineTo(hx + 18, hy);
  ctx.stroke();
}

/** Score, mission and rings, top left. */
export function drawScore(ctx, world) {
  text(ctx, `SCORE ${world.score}`, 18, 26, 20, '#ffffff');
  text(ctx, mission(world).name, 18, 52, 13, '#ffe9b0');
  const left = ringsLeft(world);
  text(ctx, left > 0 ? `RINGS LEFT ${left}` : 'ALL RINGS DONE — LAND!', 18, 72, 13, left > 0 ? '#bfe6ff' : '#7ed957');
  text(ctx, `SORTIE ${world.missionIndex + 1}/${MISSIONS.length}`, 18, 92, 12, '#9fc4dc');
  if (world.plane.damage > 0) {
    text(ctx, `DAMAGE ${Math.round(world.plane.damage)}%`, 18, 112, 12, '#ff9090');
  }
}

/** Centre reticle and the arrow that points at the next ring. */
export function drawReticle(ctx, world, ringScreenPos) {
  const cx = W / 2;
  const cy = H / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx, cy - 8);
  ctx.moveTo(cx, cy + 8);
  ctx.lineTo(cx, cy + 22);
  ctx.stroke();
  if (ringScreenPos) {
    const dx = ringScreenPos.x - cx;
    const dy = ringScreenPos.y - cy;
    const dist = Math.hypot(dx, dy);
    const maxR = 240;
    if (dist > maxR) {
      const ax = cx + (dx / dist) * maxR;
      const ay = cy + (dy / dist) * maxR;
      const angle = Math.atan2(dy, dx);
      ctx.fillStyle = '#ffbe28';
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(angle) * 16, ay + Math.sin(angle) * 16);
      ctx.lineTo(ax + Math.cos(angle + 2.5) * 12, ay + Math.sin(angle + 2.5) * 12);
      ctx.lineTo(ax + Math.cos(angle - 2.5) * 12, ay + Math.sin(angle - 2.5) * 12);
      ctx.closePath();
      ctx.fill();
      text(ctx, `${Math.round(ringScreenPos.depth)}m`, ax, ay + 26, 12, '#ffbe28', 'center');
    }
  }
}

/** Centre message and flashing warnings. */
export function drawMessages(ctx, world) {
  if (world.message && world.elapsed < world.messageUntil) {
    text(ctx, world.message, W / 2, 96, 20, '#ffffff', 'center');
  }
  if (world.flash && world.elapsed < world.flashUntil) {
    const blink = Math.floor(world.elapsed * 4) % 2 === 0;
    if (blink) text(ctx, world.flash, W / 2, H - 110, 20, '#ff6060', 'center');
  }
  const p = world.plane;
  if (p.stalled) text(ctx, 'STALL', W / 2, H - 140, 16, '#ff9090', 'center');
}

/** Full-screen overlay with a title and lines of text. */
function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(6,14,22,0.58)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, title, W / 2, H / 2 - 110, 54, accent, 'center');
  lines.forEach((line, i) => {
    text(ctx, line.text, W / 2, H / 2 - 40 + i * 30, line.size ?? 16, line.colour ?? '#dfeeff', 'center');
  });
}

export function drawScreen(ctx, world) {
  if (world.screen === SCREEN_TITLE) {
    overlay(ctx, GAME.title, [
      { text: GAME.subtitle + ' — a cargo run over the valley', size: 18, colour: '#ffe9b0' },
      { text: 'Fly the rings, then land on Runway 18. Watch your fuel.', size: 16 },
      { text: '', size: 16 },
      { text: 'ARROWS / WASD — pitch & roll      SHIFT / CTRL — throttle', size: 15 },
      { text: 'MOUSE (hold) — steer      P — pause      M — mute      R — restart', size: 15 },
      { text: '', size: 16 },
      { text: 'PRESS ENTER TO FLY', size: 22, colour: '#ffb020' },
      { text: world.best > 0 ? `BEST SCORE ${world.best}` : 'Three sorties. One valley. No second chances.', size: 14, colour: '#9fc4dc' },
    ], '#ffffff');
  } else if (world.screen === SCREEN_PAUSE) {
    overlay(ctx, 'PAUSED', [
      { text: 'The Kestrel holds her altitude.', size: 16 },
      { text: 'P — resume      R — restart the sortie', size: 15, colour: '#9fc4dc' },
    ], '#bfe6ff');
  } else if (world.screen === SCREEN_OVER) {
    overlay(ctx, 'CRASHED', [
      { text: world.plane.crashReason || 'The Kestrel is down.', size: 18, colour: '#ffb0a0' },
      { text: `SCORE ${world.score}      BEST ${world.best}`, size: 18 },
      { text: '', size: 16 },
      { text: 'PRESS R TO FLY AGAIN', size: 20, colour: '#ffb020' },
    ], '#ff7070');
  } else if (world.screen === SCREEN_WIN) {
    overlay(ctx, 'TOUR COMPLETE', [
      { text: 'Three sorties flown, three landings made. The valley is yours.', size: 17, colour: '#ffe9b0' },
      { text: `FINAL SCORE ${world.score}`, size: 22 },
      { text: '', size: 16 },
      { text: 'PRESS R TO FLY THE TOUR AGAIN', size: 18, colour: '#ffb020' },
    ], '#7ed957');
  }
}
