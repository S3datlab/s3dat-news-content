/**
 * Soundtrack for the social render, synthesised from the template's cues — no samples, so there is
 * nothing to license. A quiet 120 BPM bed (kick, offbeat hat, filtered pad, bass) carries the
 * clip; each cue adds a sound effect on its beat: whoosh, swish, hit, pop, tick, glitch, draw,
 * swell, riser, land, at 40% of their design level so they never cover the voice. Output: 48 kHz
 * 16-bit stereo WAV, peak-normalised to -1 dBFS.
 */
const SR = 48000;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000000) / 500000 - 1; };
}

/** Chamberlin state-variable filter; returns { low, band, high } per sample. */
function svf() {
  let low = 0, band = 0;
  return (x, fc, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6.5)) / SR);
    low += f * band;
    const high = x - low - q * band;
    band += f * high;
    return { low, band, high };
  };
}

export function synthesize(cues, { seconds = 8, seed = 7, fx: fxLevel = 0.4 } = {}) {
  const n = Math.round(seconds * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const noise = rng(seed * 7919 + 17);
  const add = (i, v, pan = 0) => { if (i < 0 || i >= n) return; L[i] += v * Math.min(1, 1 - pan); R[i] += v * Math.min(1, 1 + pan); };

  // ---- bed ----
  const keys = [[110, 130.81, 164.81], [87.31, 110, 130.81], [73.42, 87.31, 110], [65.41, 82.41, 98]];
  const chord = keys[Math.abs(seed) % keys.length];
  const beat = 0.5;
  const kick = (t0, g) => { const s0 = Math.round(t0 * SR); let ph = 0; for (let i = 0; i < 0.35 * SR; i++) { const t = i / SR; ph += (2 * Math.PI * (42 + 70 * Math.exp(-t * 28))) / SR; add(s0 + i, Math.sin(ph) * Math.exp(-t * 9) * g); } };
  const hat = (t0, g) => { const s0 = Math.round(t0 * SR); const f = svf(); for (let i = 0; i < 0.05 * SR; i++) { const t = i / SR; add(s0 + i, f(noise(), 7000, 0.4).high * Math.exp(-t * 90) * g, 0.25); } };
  for (let b = 0; b < seconds / beat; b++) { kick(b * beat, b % 4 === 0 ? 0.42 : 0.3); hat(b * beat + beat / 2, 0.05); }
  const padL = svf(), padR = svf();
  const phases = chord.flatMap((f) => [{ f: f * 2, ph: 0, d: 1.003 }, { f: f * 2, ph: 0.3, d: 0.997 }]);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (const v of phases) { v.ph += (v.f * v.d) / SR; s += (v.ph % 1) * 2 - 1; }
    s /= phases.length;
    const duck = 1 - 0.55 * Math.exp(-((t % beat) * 14));
    const env = Math.min(1, t / 0.4) * Math.min(1, (seconds - t) / 0.6);
    const fc = 900 + 500 * Math.sin((2 * Math.PI * t) / seconds);
    add(i, padL(s, fc, 0.9).low * 0.16 * duck * env, -0.35);
    add(i, padR(s, fc * 1.04, 0.9).low * 0.16 * duck * env, 0.35);
    const bass = Math.sin(2 * Math.PI * chord[0] * 0.5 * t) * 0.12 * duck * env * (0.6 + 0.4 * Math.exp(-((t % (beat * 2)) * 3)));
    add(i, bass);
  }

  // ---- cue sounds ----
  const fx = {
    whoosh(t0, g, pan) { const s0 = Math.round(t0 * SR), d = 0.5 * SR, f = svf(); for (let i = 0; i < d; i++) { const x = i / d; const fc = 300 * Math.pow(14, Math.sin(x * Math.PI * 0.85)); add(s0 + i, f(noise(), fc, 0.5).band * Math.pow(Math.sin(Math.PI * x), 1.5) * 0.55 * g, pan + (x - 0.5) * 1.2); } },
    swish(t0, g, pan) { const s0 = Math.round(t0 * SR), d = 0.24 * SR, f = svf(); for (let i = 0; i < d; i++) { const x = i / d; add(s0 + i, f(noise(), 1500 + 5000 * x, 0.6).band * Math.sin(Math.PI * x) * 0.32 * g, pan); } },
    hit(t0, g, pan) { kick(t0, 0.95 * g); const s0 = Math.round(t0 * SR), f = svf(); for (let i = 0; i < 0.12 * SR; i++) { const t = i / SR; add(s0 + i, f(noise(), 2500, 0.8).band * Math.exp(-t * 35) * 0.5 * g, pan); } },
    land(t0, g, pan) { fx.hit(t0, g * 0.5, pan); },
    pop(t0, g, pan) { const s0 = Math.round(t0 * SR); let ph = 0; for (let i = 0; i < 0.12 * SR; i++) { const t = i / SR; ph += (2 * Math.PI * (340 + 420 * Math.exp(-t * 40))) / SR; add(s0 + i, Math.sin(ph) * Math.exp(-t * 28) * 0.42 * g, pan); } },
    tick(t0, g, pan) { const s0 = Math.round(t0 * SR); for (let i = 0; i < 0.04 * SR; i++) { const t = i / SR; add(s0 + i, (Math.sin(2 * Math.PI * 2600 * t) + 0.4 * Math.sin(2 * Math.PI * 5200 * t)) * Math.exp(-t * 110) * 0.2 * g, pan); } },
    glitch(t0, g, pan) { const s0 = Math.round(t0 * SR), d = 0.2 * SR; let hold = 0; for (let i = 0; i < d; i++) { if (i % 160 === 0) hold = noise(); const gate = Math.floor((i / SR) * 55) % 2; add(s0 + i, Math.round(hold * 4) / 4 * gate * 0.16 * g, pan); } },
    draw(t0, g, pan) { const s0 = Math.round(t0 * SR), d = 0.7 * SR, f = svf(); for (let i = 0; i < d; i++) { const x = i / d; add(s0 + i, f(noise(), 700 + 2600 * x, 0.7).low * Math.sin(Math.PI * x) * 0.22 * g, pan); } },
    swell(t0, g, pan) { const s0 = Math.round(t0 * SR), d = 0.45 * SR, f = svf(); for (let i = 0; i < d; i++) { const x = i / d; add(s0 + i, f(noise(), 6000, 0.5).high * Math.pow(x, 3) * 0.28 * g, pan); } },
    riser(t0, g, pan) { const s0 = Math.round(t0 * SR), d = 1.0 * SR, f = svf(); let ph = 0; for (let i = 0; i < d; i++) { const x = i / d; ph += (2 * Math.PI * (200 + 600 * x * x)) / SR; add(s0 + i, (f(noise(), 500 + 5000 * x * x, 0.6).band * 0.5 + Math.sin(ph) * 0.15) * Math.pow(x, 2) * 0.4 * g, pan); } },
  };
  // Effects sit under the bed and the voice, not over them: fxLevel scales every cue (0.4 by default).
  for (const c of cues || []) if (fx[c.type]) fx[c.type](c.t, fxLevel * Math.max(0, Math.min(1.2, c.gain ?? 1)), Math.max(-0.8, Math.min(0.8, c.pan || 0)));

  // ---- master: soft clip, normalise to -1 dBFS ----
  let peak = 0;
  for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i] * 1.15); R[i] = Math.tanh(R[i] * 1.15); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const k = peak > 0 ? 0.89 / peak : 1;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * k)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * k)) * 32767), 46 + i * 4);
  }
  return buf;
}
