// Sky Courier: Ridge Run — the game loop. Fixed-step simulation, one
// canvas for the 3D world and the instruments, screens for title / pause /
// crash / win. A ?shot= query stages a screenshot scene instead of playing.
import { GAME } from './config.js';
import { createWorld, stepWorld, resetGame, startSortie, nextRing, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN } from './world.js';
import { createInput, attachInput, readStick, wasPressed } from './input.js';
import { createAudio, unlockAudio, updateAudio, playEventSound, setMuted } from './audio.js';
import { computeCamera, makeProjector, drawSky, drawWorld, drawClouds, drawRing, drawPlane } from './render.js';
import { drawInstruments, drawScore, drawReticle, drawMessages, drawScreen } from './hud.js';
import { demoStick } from './autopilot.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') ?? NaN);
const seed = Number.isFinite(seedParam) ? seedParam : 20261126;

let world;
let screen = SCREEN_TITLE;
if (shotName) {
  const staged = stageShot(shotName, seed);
  world = staged.world;
  screen = staged.screen;
  world.screen = screen;
} else {
  world = createWorld(seed);
}

const input = createInput();
const audio = createAudio();
let canvas = null;
let ctx = null;
let time = 0;
let accumulator = 0;
let lastNow = 0;

function drawFrame() {
  const w = GAME.canvasWidth;
  const h = GAME.canvasHeight;
  const plane = world.plane;
  const cam = computeCamera(plane, time);
  const project = makeProjector(cam, w, h);
  drawSky(ctx, w, h, cam);
  drawWorld(ctx, cam, project);
  drawClouds(ctx, project, cam);
  // Rings, far to near.
  const rings = [...world.rings].sort((a, b) => {
    const da = Math.hypot(a.x - cam.pos.x, a.z - cam.pos.z);
    const db = Math.hypot(b.x - cam.pos.x, b.z - cam.pos.z);
    return db - da;
  });
  for (const ring of rings) drawRing(ctx, project, ring, time);
  drawPlane(ctx, project, plane, time);

  if (world.screen === SCREEN_PLAY) {
    const ring = nextRing(world);
    const ringPos = ring ? project(ring) : null;
    drawInstruments(ctx, world);
    drawScore(ctx, world);
    drawReticle(ctx, world, ringPos);
    drawMessages(ctx, world);
  } else {
    drawScreen(ctx, world);
  }
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastNow) / 1000 || STEP);
  lastNow = now;
  time += dt;

  // One-shot keys.
  if (wasPressed(input, 'Enter') && (world.screen === SCREEN_TITLE || world.screen === SCREEN_WIN)) {
    unlockAudio(audio);
    resetGame(world);
  }
  if (wasPressed(input, 'r') && (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN || world.screen === SCREEN_PAUSE)) {
    unlockAudio(audio);
    resetGame(world);
  }
  if (wasPressed(input, 'p') && (world.screen === SCREEN_PLAY || world.screen === SCREEN_PAUSE)) {
    world.screen = world.screen === SCREEN_PLAY ? SCREEN_PAUSE : SCREEN_PLAY;
  }
  if (wasPressed(input, 'm')) {
    world.muted = !world.muted;
    setMuted(audio, world.muted);
  }
  if (wasPressed(input, ' ')) unlockAudio(audio);

  // Simulate.
  if (world.screen === SCREEN_PLAY) {
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const events = stepWorld(world, readStick(input), STEP);
      for (const ev of events) playEventSound(audio, ev);
    }
    updateAudio(audio, world.plane.speed, world.plane.throttle, true);
  } else if (world.screen === SCREEN_TITLE) {
    // Attract mode: the Kestrel circles the valley behind the title.
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const demoWorld = world;
      demoWorld.screen = SCREEN_PLAY;
      stepWorld(demoWorld, demoStick(demoWorld), STEP);
      demoWorld.screen = SCREEN_TITLE;
      if (demoWorld.plane.crashed || demoWorld.plane.landed) {
        startSortie(demoWorld);
        demoWorld.screen = SCREEN_TITLE;
      }
    }
    updateAudio(audio, 0, 0, false);
  } else {
    updateAudio(audio, 0, 0, false);
  }

  drawFrame();
  requestAnimationFrame(frame);
}

export function startGame() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  canvas.width = GAME.canvasWidth;
  canvas.height = GAME.canvasHeight;
  attachInput(input, canvas);
  canvas.tabIndex = 0;
  canvas.focus();
  // Staged screenshots render one frame at once, then keep animating.
  drawFrame();
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', startGame);
}
