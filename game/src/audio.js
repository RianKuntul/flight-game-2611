// Procedural sound: no audio files. A WebAudio engine hum that follows the
// throttle, wind noise, and short chimes for rings, landings and crashes.
export function createAudio() {
  return {
    ctx: null,
    engine: null,
    engineGain: null,
    wind: null,
    windGain: null,
    master: null,
    enabled: true,
  };
}

function ensureContext(audio) {
  if (audio.ctx) return true;
  if (typeof window === 'undefined' || !window.AudioContext) return false;
  try {
    audio.ctx = new window.AudioContext();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    // Engine: two detuned saws through a low-pass filter.
    audio.engine = audio.ctx.createOscillator();
    audio.engine.type = 'sawtooth';
    audio.engine.frequency.value = 70;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engine.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engine.start();
    // Wind: looped noise buffer through a band-pass filter.
    const length = audio.ctx.sampleRate * 2;
    const buffer = audio.ctx.createBuffer(1, length, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    audio.wind = audio.ctx.createBufferSource();
    audio.wind.buffer = buffer;
    audio.wind.loop = true;
    const windFilter = audio.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    audio.windGain = audio.ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.wind.connect(windFilter);
    windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.wind.start();
    return true;
  } catch {
    return false;
  }
}

export function unlockAudio(audio) {
  if (!ensureContext(audio)) return;
  if (audio.ctx.state === 'suspended') void audio.ctx.resume();
}

/** Call every frame: engine pitch and wind follow speed and throttle. */
export function updateAudio(audio, speed, throttle, playing) {
  if (!audio.ctx || !audio.enabled) return;
  const t = audio.ctx.currentTime;
  const target = playing ? 0.05 + throttle * 0.075 : 0;
  audio.engineGain.gain.setTargetAtTime(target, t, 0.1);
  audio.engine.frequency.setTargetAtTime(58 + throttle * 55 + speed * 0.35, t, 0.1);
  audio.windGain.gain.setTargetAtTime(playing ? Math.min(0.12, speed * 0.0016) : 0, t, 0.15);
}

function tone(audio, freq, startAt, duration, type, volume) {
  if (!audio.ctx || !audio.enabled) return;
  const osc = audio.ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = audio.ctx.createGain();
  const t0 = audio.ctx.currentTime + startAt;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Short sound for a named game event. */
export function playEventSound(audio, event) {
  if (!ensureContext(audio) || !audio.enabled) return;
  if (event === 'ring') {
    tone(audio, 880, 0, 0.25, 'sine', 0.25);
    tone(audio, 1318, 0.08, 0.3, 'sine', 0.2);
  } else if (event === 'ring-centre') {
    tone(audio, 880, 0, 0.2, 'sine', 0.25);
    tone(audio, 1174, 0.07, 0.2, 'sine', 0.25);
    tone(audio, 1568, 0.14, 0.35, 'sine', 0.25);
  } else if (event === 'landed' || event === 'landed-soft') {
    [523, 659, 784, 1046].forEach((f, i) => tone(audio, f, i * 0.09, 0.35, 'triangle', 0.22));
  } else if (event === 'bounce') {
    tone(audio, 140, 0, 0.25, 'square', 0.2);
  } else if (event === 'crash') {
    tone(audio, 90, 0, 0.7, 'sawtooth', 0.3);
    tone(audio, 55, 0.1, 0.9, 'square', 0.25);
  }
}

export function setMuted(audio, muted) {
  audio.enabled = !muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
}
