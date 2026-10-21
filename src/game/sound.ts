// Generated sound (spec §8c): WebAudio only, no audio files. Browser-only; every entry point is a no-op
// until unlock() runs inside the player's first gesture (browsers block autoplay).
// Volumes are deliberately low. Mute sets the master gain to 0 at once and suspends the context.

const STORAGE_KEY = "stc.sound.v1";
const MASTER = 0.6;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let drone: {
  oscs: OscillatorNode[];
  filter: BiquadFilterNode;
  gain: GainNode;
} | null = null;
let muted = false;
let vix = 15;
let lastBlip = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((f) => f());

export function subscribeMuted(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export const isMuted = () => muted;

/** Read the saved mute choice (this device only). */
export function loadMuted(): void {
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === "muted";
  } catch {
    muted = false;
  }
  applyMute();
  emit();
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    window.localStorage.setItem(STORAGE_KEY, m ? "muted" : "on");
  } catch {
    // Storage blocked: the choice still holds for this visit.
  }
  applyMute();
  emit();
}

function applyMute(): void {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(muted ? 0 : MASTER, now);
  if (muted) void ctx.suspend();
  else void ctx.resume();
}

/** Create (or wake) the audio context. Call from a user gesture handler. */
export function unlock(): void {
  if (typeof window === "undefined") return;
  if (ctx) {
    if (!muted && ctx.state === "suspended") void ctx.resume();
    return;
  }
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER;
  master.connect(ctx.destination);
  startDrone();
  if (muted) void ctx.suspend();
}

const live = () => (ctx && master && !muted ? ctx : null);

// ---------- Drone: low, detuned saws through a low-pass; pitch, brightness and volume rise with VIX ----------

function droneParams(v: number) {
  const k = Math.min(1, Math.max(0, (v - 12) / 70));
  return {
    freq: 41 + k * 40,
    cutoff: 160 + k * 520,
    gain: 0.025 + k * 0.07,
  };
}

function startDrone(): void {
  if (!ctx || !master) return;
  const p = droneParams(vix);
  const gain = ctx.createGain();
  gain.gain.value = p.gain;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = p.cutoff;
  filter.Q.value = 4;
  filter.connect(gain);
  gain.connect(master);
  const oscs = [1, 1.006, 0.5].map((mul, i) => {
    const o = ctx!.createOscillator();
    o.type = i === 2 ? "sine" : "sawtooth";
    o.frequency.value = p.freq * mul;
    o.connect(filter);
    o.start();
    return o;
  });
  // Slow "breathing" on the volume.
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = 0.12;
  depth.gain.value = p.gain * 0.35;
  lfo.connect(depth);
  depth.connect(gain.gain);
  lfo.start();
  drone = { oscs, filter, gain };
}

/** Follow the day's VIX (smoothly, over about a second). */
export function setVix(v: number): void {
  vix = v;
  if (!ctx || !drone) return;
  const p = droneParams(v);
  const now = ctx.currentTime;
  drone.oscs.forEach((o, i) =>
    o.frequency.setTargetAtTime(p.freq * [1, 1.006, 0.5][i], now, 0.6),
  );
  drone.filter.frequency.setTargetAtTime(p.cutoff, now, 0.6);
  drone.gain.gain.setTargetAtTime(p.gain, now, 0.6);
}

// ---------- One-shots ----------

function tone(
  c: AudioContext,
  type: OscillatorType,
  freq: number,
  start: number,
  dur: number,
  peak: number,
  endFreq?: number,
): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(master!);
  o.start(start);
  o.stop(start + dur + 0.05);
}

/** Soft typewriter tick (throttled). */
export function blip(): void {
  const c = live();
  if (!c) return;
  const now = c.currentTime;
  if (now - lastBlip < 0.06) return;
  lastBlip = now;
  tone(c, "square", 1250 + Math.random() * 200, now, 0.025, 0.012);
}

/** An order filled: two quick rising notes. */
export function fillSound(): void {
  const c = live();
  if (!c) return;
  const now = c.currentTime;
  tone(c, "triangle", 660, now, 0.08, 0.06);
  tone(c, "triangle", 990, now + 0.08, 0.12, 0.06);
}

/** Lost a half-heart: lub-dub. */
export function heartbeat(): void {
  const c = live();
  if (!c) return;
  const now = c.currentTime;
  tone(c, "sine", 75, now, 0.18, 0.35, 38);
  tone(c, "sine", 65, now + 0.2, 0.2, 0.25, 34);
}

/** Circuit breaker: a two-cycle wailing siren, gentle. */
export function siren(): void {
  const c = live();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(560, now);
  for (let i = 0; i < 2; i++) {
    o.frequency.linearRampToValueAtTime(880, now + i * 1.0 + 0.5);
    o.frequency.linearRampToValueAtTime(560, now + i * 1.0 + 1.0);
  }
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.05, now + 0.15);
  g.gain.setValueAtTime(0.05, now + 1.8);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 2.1);
  o.connect(g);
  g.connect(master!);
  o.start(now);
  o.stop(now + 2.2);
}

/** Hero event: a soft major chord that swells and fades. */
export function reliefChord(): void {
  const c = live();
  if (!c) return;
  const now = c.currentTime + 0.15;
  for (const f of [261.63, 329.63, 392.0, 523.25]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.035, now + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    o.connect(g);
    g.connect(master!);
    o.start(now);
    o.stop(now + 2.5);
  }
}
