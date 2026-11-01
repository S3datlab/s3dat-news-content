/* S3DAT News banner engine — motion kit shared by every template.
 *
 * A template is a pure function of time: it builds its DOM once, then frame(t) sets every style
 * for time t (seconds). No CSS animations or timers, so frame-by-frame capture is exact, and the
 * renderer can sample several moments inside one frame for motion blur.
 *
 * Craft rules the kit encodes:
 *  - Springs instead of fixed easing: things overshoot and settle.
 *  - Nothing ever stands still: a virtual camera drifts and pushes, layers move in parallax.
 *  - Cuts land on a 120 BPM beat grid (0.5 s), so a banner feels edited, not timed.
 *  - Loops are seamless: the camera is periodic over the 8 s and every template ends where it began.
 *  - Templates register sound cues; the social render turns them into a soundtrack.
 */
(function () {
  const B = { W: 1080, H: 608, DURATION: 8, FPS: 30, BEAT: 0.5, templates: {}, cues: [] };

  /* ---------- math ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, x) => a + (b - a) * x;
  const TAU = Math.PI * 2;
  const ease = {
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inCubic: (x) => x * x * x,
    inQuart: (x) => x * x * x * x,
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: (x, s = 1.7) => { const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
  };
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }
  const choose = (seed, list) => list[Math.abs(Math.floor(seed)) % list.length];
  const beat = (n) => n * B.BEAT;

  /* ---------- springs ---------- */
  // Damped harmonic oscillator step response: 0 at rest, settles at 1. f in Hz, z damping ratio.
  const SPR = {
    snap: { f: 2.4, z: 0.62 },
    pop: { f: 3.0, z: 0.36 },
    soft: { f: 1.3, z: 0.92 },
    heavy: { f: 1.7, z: 0.7 },
    wobble: { f: 2.2, z: 0.24 },
  };
  function spring(t, p = SPR.snap) {
    if (t <= 0) return 0;
    const w = TAU * p.f, z = p.z;
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w * t) * (1 + w * t);
  }
  const sp = (t, start, p = "snap") => spring(t - start, typeof p === "string" ? SPR[p] : p);
  /** In with a spring at a, out with an accelerating ease from b to c. */
  const life = (t, a, b, c, p = "snap") => sp(t, a, p) * (1 - ease.inCubic(seg(t, b, c)));

  /* ---------- colour ---------- */
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const onColor = (hex) => (luminance(hex) > 0.45 ? "#0a0a0a" : "#ffffff");
  function mix(a, b, x) {
    const A = hexToRgb(a), C = hexToRgb(b);
    return "#" + A.map((v, i) => Math.round(lerp(v, C[i], x)).toString(16).padStart(2, "0")).join("");
  }
  const alpha = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  /** Brand colours that read on screen: near-black brands get a vivid partner colour. */
  function brandColors(brand, fallback) {
    const base = brand && brand.color ? brand.color : fallback;
    const dark = luminance(base) < 0.02;
    return { base, vivid: dark ? fallback : base, ink: onColor(base), dark };
  }

  /* ---------- DOM ---------- */
  function el(tag, cls, parent, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    if (parent) parent.appendChild(node);
    return node;
  }
  function css(node, styles) { Object.assign(node.style, styles); return node; }
  /** Layout helper: the same template draws 16:9 (site) and 4:5 (social feeds). */
  const wide = () => B.W / B.H > 1.2;
  const pick = (wideValue, tallValue) => (wide() ? wideValue : tallValue);

  /* ---------- text fitting ---------- */
  /** Largest font size (px) at which every line fits maxWidth and the block fits maxHeight. */
  function fitLines(nodes, maxWidth, maxHeight, maxSize, minSize, lineHeight = 0.9) {
    // Measure the text itself: a flex column would otherwise stretch each line to its width.
    nodes.forEach((n) => (n.style.width = "max-content"));
    let lo = minSize, hi = maxSize;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      nodes.forEach((n) => (n.style.fontSize = mid + "px"));
      const widest = Math.max(...nodes.map((n) => n.getBoundingClientRect().width));
      if (widest <= maxWidth && nodes.length * mid * lineHeight <= maxHeight) lo = mid; else hi = mid;
    }
    nodes.forEach((n) => (n.style.fontSize = lo + "px"));
    return lo;
  }
  /** Poster stacking: every line grows to fill maxWidth on its own, then the stack shrinks to fit maxHeight. */
  function fitEach(nodes, maxWidth, maxHeight, maxSize, minSize, lineHeight = 0.92) {
    nodes.forEach((n) => { n.style.width = "max-content"; n.style.fontSize = "100px"; });
    const sizes = nodes.map((n) => Math.min(maxSize, (100 * maxWidth) / Math.max(1, n.getBoundingClientRect().width)));
    const total = sizes.reduce((sum, s) => sum + s * lineHeight, 0);
    const k = total > maxHeight ? maxHeight / total : 1;
    const out = sizes.map((s) => Math.max(minSize, s * k));
    nodes.forEach((n, i) => (n.style.fontSize = out[i] + "px"));
    return out;
  }
  /** One headline line element with the given style; returns the node. */
  function line(parent, text, styles) {
    const n = css(el("div", "line", parent), styles);
    n.textContent = text;
    return n;
  }

  /* ---------- sound cues ---------- */
  /** Registers a sound for the social render: whoosh, swish, hit, pop, tick, glitch, draw, swell, riser, land. */
  function cue(type, t, gain = 1, pan = 0) {
    if (t >= 0 && t < B.DURATION) B.cues.push({ type, t: Math.round(t * 1000) / 1000, gain, pan });
  }

  /* ---------- camera ---------- */
  /** A world container moved by a periodic virtual camera (seamless over the 8 s), with parallax
   *  layers and decaying shake kicks. Put everything that should feel filmed inside world/layers. */
  function camera(parent, opts = {}) {
    const o = Object.assign({ push: 0.045, drift: 12, sway: 0.5 }, opts);
    const world = css(el("div", "layer", parent), { transformOrigin: "50% 50%" });
    const layers = [];
    const kicks = [];
    return {
      world,
      layer(depth) { const n = el("div", "layer", world); layers.push({ n, depth }); return n; },
      kick(t0, amp = 10, sound = true) { kicks.push({ t0, amp }); if (sound) cue("hit", t0, Math.min(1, amp / 14)); },
      update(t) {
        const ph = (TAU * t) / B.DURATION;
        // Depth reads from parallax: the layers drift half as far again as the camera moves.
        const cx = Math.sin(ph) * o.drift * 1.5, cy = Math.sin(ph * 2 + 1.1) * o.drift * 0.7;
        const s = 1 + o.push * 1.5 * (0.5 - 0.5 * Math.cos(ph));
        let sx = 0, sy = 0;
        for (const k of kicks) {
          const d = t - k.t0;
          if (d < 0 || d > 0.45) continue;
          const a = k.amp * Math.exp(-d * 9);
          sx += Math.sin(d * 95) * a; sy += Math.cos(d * 83) * a * 0.7;
        }
        // Every impact the template registered (hit, land, pop) punches the camera in a little.
        let punch = 0;
        for (const c of B.cues) {
          if (c.type !== "hit" && c.type !== "land" && c.type !== "pop") continue;
          const d = t - c.t;
          if (d >= 0 && d < 0.6) punch += (c.type === "pop" ? 0.016 : 0.045) * Math.min(1, c.gain) * Math.exp(-d * 9) * Math.sin(Math.min(1, d * 14) * Math.PI / 2);
        }
        world.style.transform = `translate(${sx}px, ${sy}px) scale(${s + punch}) rotate(${Math.sin(ph) * o.sway}deg)`;
        for (const { n, depth } of layers) n.style.transform = `translate(${cx * depth}px, ${cy * depth}px)`;
      },
    };
  }

  /* ---------- finishing ---------- */
  let grainUrl = null;
  /** Static fine grain over the frame (static on purpose: animated noise ruins H.264 at 1.6 MB). */
  function grain(parent, opacity = 0.05) {
    if (!grainUrl) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 160;
      const g = cv.getContext("2d");
      const img = g.createImageData(160, 160);
      const r = rng(9001);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.floor(r() * 255); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
      grainUrl = cv.toDataURL("image/png");
    }
    return css(el("div", "layer", parent), { backgroundImage: `url(${grainUrl})`, backgroundSize: "160px 160px", mixBlendMode: "overlay", opacity, pointerEvents: "none" });
  }
  /* ---------- ambient motion: what keeps a held frame alive ---------- */
  /**
   * Behind the content: the headline as a giant outlined marquee that never stops scrolling, and a
   * drift of small shapes in the accent colour. Both loop seamlessly over the 8 s (the marquee moves
   * exactly one repeat, the shapes wrap exactly once). opts: bg, ink, accent (#hex), text, y (px of
   * the marquee's centre), size (px), shapes (count), seed, marquee (false to skip it).
   */
  function ambient(parent, opts) {
    const o = Object.assign({ y: B.H * 0.5, size: wide() ? 300 : 420, shapes: 14, seed: 7, marquee: true }, opts);
    const root = css(el("div", "layer", parent), { pointerEvents: "none", overflow: "hidden" });
    let row = null, unit = 0;
    if (o.marquee && o.text) {
      row = css(el("div", "abs", root), { left: 0, top: o.y - o.size * 0.55 + "px", whiteSpace: "nowrap", font: `900 ${o.size}px/1.1 Archivo`, fontStretch: "80%", textTransform: "uppercase", color: "transparent", WebkitTextStroke: `${Math.max(2, o.size * 0.012)}px ${mix(o.bg, o.ink, 0.16)}` });
      const piece = el("span", "", row);
      piece.textContent = `${o.text} ✦ `;
      unit = piece.getBoundingClientRect().width;
      const copies = Math.ceil((B.W * 2) / Math.max(1, unit)) + 1;
      for (let i = 0; i < copies; i++) { const x = el("span", "", row); x.textContent = piece.textContent; }
    }
    const r = rng(o.seed * 131 + 9);
    const shapes = Array.from({ length: o.shapes }, (_, i) => {
      const size = 8 + r() * 22;
      const kind = i % 3;
      const n = css(el("div", "abs", root), { width: size + "px", height: size + "px", left: 0, top: 0, borderRadius: kind === 0 ? "50%" : kind === 1 ? "3px" : "0", background: kind === 2 ? "transparent" : o.accent, border: kind === 2 ? `3px solid ${o.accent}` : "none", opacity: 0.35 + r() * 0.4 });
      return { n, x: r() * B.W, y: r() * B.H, wraps: 1 + Math.floor(r() * 2), sway: 10 + r() * 30, spin: (r() - 0.5) * 360, ph: r() * TAU };
    });
    return (t) => {
      const k = (((t % B.DURATION) + B.DURATION) % B.DURATION) / B.DURATION;
      if (row) row.style.transform = `translateX(${-k * unit}px)`;
      for (const s of shapes) {
        const y = (((s.y - k * s.wraps * (B.H + 60)) % (B.H + 60)) + B.H + 60) % (B.H + 60) - 30;
        const x = s.x + Math.sin(k * TAU + s.ph) * s.sway;
        s.n.style.transform = `translate(${x}px, ${y}px) rotate(${s.spin * k * s.wraps}deg)`;
      }
    };
  }
  /** A bar in `color` draws under a headline line at `at` and stays, so the news line keeps its
   *  emphasis through the hold. It lives inside the line, so it follows the line's own motion. */
  function underline(node, color, at, thickness = 0.09) {
    node.style.position = "relative";
    const bar = css(el("div", "abs", node), { left: "0", right: "0", bottom: -thickness * 0.6 + "em", height: thickness + "em", background: color, transformOrigin: "0 50%", transform: "scaleX(0)", borderRadius: thickness / 2 + "em" });
    cue("swish", at, 0.4);
    return (t) => { bar.style.transform = `scaleX(${Math.max(0, Math.min(1, sp(t, at, "snap")))})`; };
  }
  /** A held block keeps moving: a slow push-in and drift from `a` until it leaves at `b`. */
  function hold(node, a, b, amount = 0.06) {
    node.style.transformOrigin = node.style.transformOrigin || "0% 50%";
    return (t) => {
      const k = ease.inOut(seg(t, a, b));
      node.style.scale = String(1 + amount * k);
      node.style.translate = `${k * 8}px ${-k * 6}px`;
    };
  }

  /** The finishing pass every banner gets on top (stage.html adds it after the template): a light
   *  band sweeps the frame on each whoosh or swish, a soft flash blooms on each hit, and the
   *  vignette breathes. It reads the template's sound cues, so picture and sound land together. */
  function finish(parent) {
    const top = css(el("div", "layer", parent), { pointerEvents: "none", overflow: "hidden" });
    const sweep = css(el("div", "abs", top), { top: "-30%", height: "160%", width: "38%", left: "-60%", background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.5) 48%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.5) 52%, rgba(255,255,255,0.12) 70%, rgba(255,255,255,0) 100%)", mixBlendMode: "screen", transform: "skewX(-20deg)", visibility: "hidden" });
    const flash = css(el("div", "layer", top), { background: "radial-gradient(70% 90% at 50% 45%, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)", mixBlendMode: "soft-light", opacity: 0 });
    const vig = css(el("div", "layer", top), { background: "radial-gradient(120% 100% at 50% 50%, transparent 58%, rgba(0,0,0,0.5))", mixBlendMode: "multiply" });
    const sweeps = B.cues.filter((c) => c.type === "whoosh" || c.type === "swish").map((c) => c.t).sort((a, b) => a - b)
      .filter((t, i, list) => i === 0 || t - list[i - 1] > 0.5);
    const hits = B.cues.filter((c) => c.type === "hit" || c.type === "land").map((c) => ({ t: c.t, g: Math.min(1, c.gain) }));
    return (t) => {
      const near = sweeps.find((c) => t >= c - 0.18 && t <= c + 0.32);
      sweep.style.visibility = near !== undefined ? "visible" : "hidden";
      if (near !== undefined) sweep.style.left = `${lerp(-60, 125, ease.inOut(seg(t, near - 0.18, near + 0.32)))}%`;
      let f = 0;
      for (const h of hits) { const d = t - h.t; if (d >= 0 && d < 0.4) f = Math.max(f, h.g * Math.exp(-d * 11)); }
      flash.style.opacity = String(0.75 * f);
      vig.style.opacity = String(0.55 + 0.15 * Math.sin((TAU * t) / B.DURATION));
    };
  }
  function vignette(parent, strength = 0.45) {
    return css(el("div", "layer", parent), { background: `radial-gradient(120% 95% at 50% 45%, transparent 55%, rgba(0,0,0,${strength}))`, pointerEvents: "none" });
  }
  /** A light band sweeping across solid-colour text (background-clip: text). Returns update(t). */
  function sheenText(node, color, start, dur = 0.9) {
    const hi = luminance(color) > 0.5 ? mix(color, "#ffffff", 0.85) : mix(color, "#ffffff", 0.55);
    css(node, {
      backgroundImage: `linear-gradient(100deg, ${color} 0%, ${color} 40%, ${hi} 50%, ${color} 60%, ${color} 100%)`,
      backgroundSize: "300% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
    });
    return (t) => { node.style.backgroundPosition = `${lerp(100, 0, ease.inOut(seg(t, start, start + dur)))}% 0`; };
  }
  /** A light band sweeping across any shape, clipped by a mask image (a sticker or logo). */
  function sheenMask(parent, maskUrl, start, dur = 0.9) {
    const s = css(el("div", "abs", parent), {
      inset: "0", pointerEvents: "none", mixBlendMode: "screen",
      background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%)", backgroundSize: "300% 100%",
      WebkitMaskImage: `url("${maskUrl}")`, maskImage: `url("${maskUrl}")`, WebkitMaskSize: "contain", maskSize: "contain",
      WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center",
    });
    return (t) => { s.style.backgroundPosition = `${lerp(100, 0, ease.inOut(seg(t, start, start + dur)))}% 0`; };
  }

  /* ---------- logos ---------- */
  function logoNode(brand, color, parent, cls = "logo") {
    const box = el("div", cls, parent);
    if (brand && brand.svgPath) {
      box.innerHTML = `<svg viewBox="0 0 24 24"><path fill="${color}" d="${brand.svgPath}"/></svg>`;
    } else if (brand && brand.svg) {
      box.innerHTML = brand.svg;
      const svg = box.querySelector("svg");
      const vb = svg && (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
      // Wide wordmarks: keep roughly the visual area of a square mark instead of shrinking to a
      // sliver inside the square box (they may overflow it sideways).
      const aspect = vb && vb.length === 4 ? vb[2] / vb[3] : 1;
      if (aspect > 1.25) { box.classList.add("wide"); box.style.setProperty("--w", Math.min(130, Math.sqrt(0.45 * aspect) * 100).toFixed(1) + "%"); }
      if (svg) {
        svg.removeAttribute("width"); svg.removeAttribute("height");
        if (color && brand.recolor !== false) svg.querySelectorAll("path,circle,rect,polygon,ellipse").forEach((p) => p.setAttribute("fill", color));
      }
    } else if (brand && brand.image) {
      box.innerHTML = `<img src="${brand.image}" alt="">`;
    } else if (brand) {
      const word = el("div", "", box);
      word.textContent = brand.name;
      css(word, { font: "800 64px/1 Archivo", color, whiteSpace: "nowrap", display: "grid", placeItems: "center", height: "100%" });
    }
    return box;
  }
  /** Mask URL of a logo's shape, for sheens. */
  function logoMask(brand) {
    if (brand && brand.svgPath) return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="${brand.svgPath}"/></svg>`);
    return null;
  }
  /** A logo that draws on: the outline traces, then the fill comes in. Images pop instead.
   *  Returns the box with box.draw(t) bound to the given start. */
  function logo(brand, color, parent, start = 0.6, dur = 1.0) {
    const box = logoNode(brand, color, parent);
    const svg = box.querySelector("svg");
    const shapes = svg ? [...svg.querySelectorAll("path,rect,circle,polygon,ellipse")] : [];
    let width = 0.32;
    if (svg) { const vb = (svg.getAttribute("viewBox") || "0 0 24 24").split(/[\s,]+/).map(Number); width = Math.max(vb[2], vb[3]) * 0.014; }
    shapes.forEach((s) => { s.setAttribute("pathLength", "1"); css(s, { stroke: color, strokeWidth: String(width), strokeDasharray: "1", strokeLinejoin: "round" }); });
    cue("draw", start, 0.7);
    cue("pop", start + dur * 0.55, 0.5);
    box.draw = (t) => {
      if (!shapes.length) {
        const p = sp(t, start, "pop");
        box.style.opacity = seg(t, start, start + 0.12);
        box.style.scale = String(Math.max(0, 0.6 + 0.4 * p));
        return;
      }
      const d = ease.inOut(seg(t, start, start + dur * 0.7)), f = ease.outCubic(seg(t, start + dur * 0.45, start + dur));
      for (const s of shapes) { s.style.strokeDashoffset = String(1 - d); s.style.fillOpacity = String(f); s.style.strokeOpacity = String(d > 0 ? 1 : 0); }
      box.style.opacity = t >= start ? 1 : 0;
    };
    return box;
  }

  /* ---------- kinetic type ---------- */
  function splitChars(node) {
    const text = node.textContent;
    node.textContent = "";
    return [...text].map((ch) => {
      const s = el("span", "", node);
      s.textContent = ch === " " ? " " : ch;
      s.style.display = "inline-block";
      return s;
    });
  }
  function maskWrap(node) {
    const m = css(el("span", ""), { display: "block", overflow: "hidden", padding: "0.06em 0.04em 0.1em", margin: "-0.06em -0.04em -0.1em" });
    node.parentNode.insertBefore(m, node);
    m.appendChild(node);
    return m;
  }
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$";
  /**
   * Animates fitted headline lines. kinds: rise, drop, weight, decode, skew, outline, slam, track.
   * opts: start (s), stagger (s between lines), out ([from, to] seconds or null), seed, color
   * (for decode/outline), camera (for slam kicks). Returns update(t).
   */
  function animate(lines, kind, opts = {}) {
    const o = Object.assign({ start: 0.4, stagger: 0.12, out: [7.35, 7.85], seed: 7 }, opts);
    const r = rng(o.seed * 7477 + 3);
    const outAt = (t, i) => (o.out ? ease.inCubic(seg(t, o.out[0] + i * 0.05, o.out[1] + i * 0.05)) : 0);
    const starts = lines.map((_, i) => o.start + i * o.stagger);
    const sound = { rise: "swish", drop: "tick", weight: "swell", decode: "glitch", skew: "swish", outline: "draw", slam: "hit", track: "swish" }[kind] || "swish";
    starts.forEach((s, i) => cue(sound, s, kind === "slam" ? 0.9 : 0.55, (i % 2 ? 0.3 : -0.3)));
    if (kind === "slam" && o.camera) starts.forEach((s, i) => o.camera.kick(s + 0.09, 9 - i * 2, false));

    if (kind === "rise") {
      lines.forEach(maskWrap);
      return (t) => lines.forEach((n, i) => {
        const y = (1 - sp(t, starts[i], "snap")) * 112 - outAt(t, i) * 112;
        n.style.transform = `translateY(${y}%)`;
      });
    }
    if (kind === "drop") {
      const chars = lines.map((n) => splitChars(n).map((s) => ({ s, rot: (r() - 0.5) * 34, k: r() })));
      return (t) => chars.forEach((list, i) => list.forEach(({ s, rot, k }, j) => {
        const a = starts[i] + j * 0.028;
        const p = sp(t, a, "pop"), q = outAt(t, i);
        s.style.opacity = seg(t, a, a + 0.06) * (1 - seg(q, 0.6, 1));
        s.style.transform = `translateY(${(1 - p) * -0.75 + q * (0.9 + k * 0.6)}em) rotate(${(1 - p) * rot + q * rot}deg)`;
      }));
    }
    if (kind === "weight") {
      return (t) => lines.forEach((n, i) => {
        const p = sp(t, starts[i], "soft"), q = outAt(t, i);
        n.style.fontWeight = String(Math.round(lerp(150, 900, clamp(p, 0, 1.05))));
        n.style.letterSpacing = `${lerp(0.08, -0.01, clamp(p))}em`;
        n.style.opacity = seg(t, starts[i], starts[i] + 0.15) * (1 - q);
        n.style.transform = `translateX(${(1 - p) * -24 - q * 60}px)`;
      });
    }
    if (kind === "decode") {
      const chars = lines.map((n) => {
        const list = splitChars(n).map((s) => ({ s, ch: s.textContent, w: 0, reveal: 0, k: Math.floor(r() * 997) }));
        list.forEach((c) => { c.w = c.s.getBoundingClientRect().width; css(c.s, { width: c.w + "px", textAlign: "center" }); });
        return list;
      });
      chars.forEach((list, i) => list.forEach((c, j) => (c.reveal = starts[i] + 0.12 + j * 0.035 + r() * 0.12)));
      return (t) => chars.forEach((list, i) => list.forEach((c) => {
        const q = outAt(t, i);
        const on = t >= starts[i];
        if (!on) { c.s.style.opacity = 0; return; }
        const settled = t >= c.reveal && q < 0.25;
        c.s.textContent = settled || c.ch === " " ? c.ch : GLYPHS[(c.k + Math.floor(t * 18)) % GLYPHS.length];
        c.s.style.opacity = (settled ? 1 : 0.55) * (1 - q);
        c.s.style.color = settled || !o.color ? "" : o.color;
      }));
    }
    if (kind === "skew") {
      return (t) => lines.forEach((n, i) => {
        const p = sp(t, starts[i], "snap"), q = outAt(t, i);
        n.style.clipPath = `inset(-10% ${clamp(1 - p) * 100}% -10% ${q * 100}%)`;
        n.style.transform = `translateX(${(1 - p) * -0.35}em) skewX(${(1 - clamp(p)) * -16}deg)`;
      });
    }
    if (kind === "outline") {
      const fills = lines.map((n) => {
        const wrap = css(el("span", ""), { display: "block", position: "relative", width: "max-content" });
        n.parentNode.insertBefore(wrap, n);
        wrap.appendChild(n);
        const fill = n.cloneNode(true);
        css(fill, { position: "absolute", left: "0", top: "0" });
        wrap.appendChild(fill);
        const c = n.style.color || o.color || "#fff";
        css(n, { color: "transparent", WebkitTextStroke: `0.03em ${c}` });
        return fill;
      });
      return (t) => lines.forEach((n, i) => {
        const p = sp(t, starts[i], "snap"), f = ease.inOut(seg(t, starts[i] + 0.35, starts[i] + 0.95)), q = outAt(t, i);
        n.style.opacity = seg(t, starts[i], starts[i] + 0.12) * (1 - q);
        n.parentNode.style.transform = `translateY(${(1 - p) * 30 - q * 30}px)`;
        fills[i].style.clipPath = `inset(-10% ${(1 - f) * 100}% -10% 0)`;
        fills[i].style.opacity = 1 - q;
      });
    }
    if (kind === "slam") {
      return (t) => lines.forEach((n, i) => {
        const p = sp(t, starts[i], "pop"), q = outAt(t, i);
        n.style.opacity = seg(t, starts[i], starts[i] + 0.05) * (1 - q);
        n.style.transform = `scale(${1 + (1 - p) * 1.1 + q * 0.4})`;
        n.style.transformOrigin = "0% 60%";
      });
    }
    // track
    return (t) => lines.forEach((n, i) => {
      const p = sp(t, starts[i], "soft"), q = outAt(t, i);
      n.style.letterSpacing = `${lerp(0.45, -0.01, clamp(p))}em`;
      n.style.opacity = seg(t, starts[i], starts[i] + 0.3) * (1 - q);
      n.style.filter = `blur(${(1 - clamp(p)) * 9 + q * 6}px)`;
    });
  }

  /* ---------- transitions ---------- */
  /** A colour field that grows from a circle (iris). update(t, a, b, c, d): opens a->b, closes c->d. */
  function iris(parent, color, x, y) {
    const n = css(el("div", "layer", parent), { background: color, clipPath: "circle(0px at 0 0)" });
    const R = Math.hypot(Math.max(x, B.W - x), Math.max(y, B.H - y)) + 4;
    return {
      node: n,
      /** Grows from radius r0 (0: a point) to full frame over a->b, back to r0 over c->d; hidden outside a..d. */
      update(t, a, b, c, d, r0 = 0) {
        const k = ease.inOut(seg(t, a, b)) - ease.inOut(seg(t, c, d));
        const on = t >= a && t <= d && (k > 0 || r0 > 0);
        n.style.visibility = on ? "visible" : "hidden";
        n.style.clipPath = `circle(${on ? lerp(r0, R, k) : 0}px at ${x}px ${y}px)`;
      },
    };
  }
  /** Venetian bars that sweep in (cover) and out (reveal). update(t, a, b, c, d). */
  function bars(parent, colors, count = 6, vertical = false) {
    const items = Array.from({ length: count }, (_, i) => css(el("div", "abs", parent), vertical
      ? { left: (i * 100) / count + "%", width: 100 / count + 0.3 + "%", top: 0, bottom: 0, background: colors[i % colors.length] }
      : { top: (i * 100) / count + "%", height: 100 / count + 0.3 + "%", left: 0, right: 0, background: colors[i % colors.length] }));
    return {
      update(t, a, b, c, d) {
        items.forEach((n, i) => {
          const k = i / count * 0.35;
          const inn = ease.inOut(seg(t, a + k * (b - a), b + k * (b - a))), out = ease.inOut(seg(t, c + k * (d - c), d + k * (d - c)));
          const show = inn - out;
          n.style.transform = vertical ? `translateY(${(out > 0 ? 1 : -1) * (1 - show) * 100}%)` : `translateX(${(out > 0 ? 1 : -1) * (1 - show) * 100}%)`;
          n.style.visibility = show > 0 ? "visible" : "hidden";
        });
      },
    };
  }
  /** Halftone dissolve: a grid of dots in a colour that grow until they cover the frame. */
  function halftone(parent, color, cell = 36) {
    const n = css(el("div", "layer", parent), { backgroundSize: `${cell}px ${cell}px`, backgroundPosition: "center" });
    return {
      update(t, a, b, c, d) {
        const p = ease.inOut(seg(t, a, b)) - ease.inOut(seg(t, c, d));
        const rad = p * cell * 0.75;
        n.style.backgroundImage = rad > 0.2 ? `radial-gradient(circle, ${color} ${rad}px, transparent ${rad + 1}px)` : "none";
        n.style.visibility = rad > 0.2 ? "visible" : "hidden";
      },
    };
  }
  /** Radiating impact lines (SVG) around a point, drawn for a moment. */
  function burst(parent, x, y, color, count = 10, inner = 40, outer = 120) {
    const svg = el("div", "layer", parent);
    const r = rng(x * 13 + y * 7);
    const lines = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * TAU + r() * 0.3;
      return { a, i0: inner * (0.8 + r() * 0.4), o0: outer * (0.8 + r() * 0.5) };
    });
    svg.innerHTML = `<svg width="${B.W}" height="${B.H}" viewBox="0 0 ${B.W} ${B.H}">${lines.map((l) => `<line x1="${x + Math.cos(l.a) * l.i0}" y1="${y + Math.sin(l.a) * l.i0}" x2="${x + Math.cos(l.a) * l.o0}" y2="${y + Math.sin(l.a) * l.o0}" stroke="${color}" stroke-width="7" stroke-linecap="round" pathLength="1" stroke-dasharray="1"/>`).join("")}</svg>`;
    const nodes = [...svg.querySelectorAll("line")];
    return (t, t0) => {
      const p = seg(t, t0, t0 + 0.32);
      nodes.forEach((n) => { n.setAttribute("stroke-dashoffset", String(p < 0.5 ? 1 - p * 2 : -(p - 0.5) * 2)); n.style.opacity = p > 0 && p < 1 ? 1 : 0; });
    };
  }

  /* ---------- cut-outs and the acting hero ---------- */
  /** Bake a white die-cut edge into a transparent cut-out once, so frames only composite it. */
  async function bakeSticker(src) {
    const img = new Image();
    img.src = src;
    await img.decode();
    const w = Math.max(4, Math.round(Math.max(img.naturalWidth, img.naturalHeight) * 0.016));
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth + w * 2;
    cv.height = img.naturalHeight + w * 2;
    const g = cv.getContext("2d");
    for (let a = 0; a < 16; a++) g.drawImage(img, w + Math.cos((a / 16) * TAU) * w, w + Math.sin((a / 16) * TAU) * w);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = "source-over";
    g.drawImage(img, w, w);
    return { url: cv.toDataURL("image/png"), aspect: cv.width / cv.height };
  }
  /** A cut-out as a sticker: the baked-edge version when there is one, plus one soft shadow. */
  function sticker(cut, parent, edged = true) {
    const img = el("img", "abs", parent);
    img.src = edged && cut.edged ? cut.edged : cut.image;
    img.style.filter = "drop-shadow(0 16px 18px rgba(0,0,0,.28))";
    img.style.objectFit = "contain";
    return img;
  }
  /**
   * The hero character or object, acting the mood: up (bounce), down (slump and shudder),
   * shock (shake and punch), calm (float). Extra poses swap in at poseTimes with a squash pop and
   * impact marks. The container is positioned/sized by the template; update(t, enter, leave).
   */
  function hero(cut, parent, opts = {}) {
    const o = Object.assign({ mood: "calm", poseTimes: [beat(6), beat(11)], edged: true, ink: "#111", sheen: 2.2 }, opts);
    const box = css(el("div", "abs", parent), { transformOrigin: "50% 100%" });
    const frames = [cut, ...(cut.poses || [])].map((c) => { const img = sticker(c, box, o.edged); css(img, { left: 0, top: 0, width: "100%", height: "100%", objectPosition: "50% 100%" }); return img; });
    const times = o.poseTimes.slice(0, frames.length - 1);
    times.forEach((t) => cue("pop", t, 0.8));
    const marks = el("div", "layer", box);
    marks.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;left:62%;top:-4%;width:34%;height:24%;overflow:visible">${[[10, 70, 34, 40], [30, 80, 70, 54], [44, 96, 92, 84]].map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.ink}" stroke-width="7" stroke-linecap="round" pathLength="1" stroke-dasharray="1" vector-effect="non-scaling-stroke"/>`).join("")}</svg>`;
    const markLines = [...marks.querySelectorAll("line")];
    const shine = o.sheen != null && cut.edged ? sheenMask(box, frames.length > 1 ? cut.edged : cut.edged, o.sheen, 0.9) : null;
    return {
      node: box,
      update(t, enter = 1, leave = 0) {
        let y = 0, r = 0, sx = 1, sy = 1 + Math.sin((TAU * t) / 1.6) * 0.012;
        if (o.mood === "up") { const b = Math.abs(Math.sin(TAU * t * 0.9)); y -= b * 18; sy += (1 - b) * 0.02; sx -= (1 - b) * 0.01; }
        else if (o.mood === "down") { const s = ease.inOut(seg(t, beat(3), beat(5))); y += s * 16; r -= s * 5; if (t > beat(5) && t < beat(6)) r += Math.sin(t * 70) * 2.5; }
        else if (o.mood === "shock") { for (const k of [beat(2.5), ...times]) { const d = t - k; if (d > 0 && d < 0.45) { const a = Math.exp(-d * 8); r += Math.sin(d * 80) * 5 * a; sx += 0.06 * a; sy += 0.06 * a; } } }
        else { y += Math.sin((TAU * t) / 2.6) * 7; r += Math.sin((TAU * t) / 4) * 1.4; }
        let idx = 0;
        times.forEach((tt, i) => { if (t >= tt) idx = i + 1; });
        for (const tt of times) { const d = t - tt; if (d >= 0 && d < 0.5) { const p = sp(t, tt, "wobble"); sx *= 1 + (1 - p) * 0.12; sy *= 1 - (1 - p) * 0.1; } }
        frames.forEach((f, i) => (f.style.opacity = i === idx ? 1 : 0));
        const mt = times.find((tt) => t >= tt && t < tt + 0.45);
        markLines.forEach((l, i) => { const p = mt != null ? seg(t, mt + i * 0.04, mt + 0.18 + i * 0.04) : 0; l.setAttribute("stroke-dashoffset", String(1 - p)); l.style.opacity = mt != null ? 1 - seg(t, mt + 0.3, mt + 0.45) : 0; });
        box.style.transform = `translateY(${(1 - enter) * B.H * 0.9 + y + leave * B.H}px) rotate(${r}deg) scale(${sx}, ${sy})`;
        if (shine) shine(t);
      },
    };
  }

  /* ---------- numbers ---------- */
  /** "$4.2B" -> { prefix: "$", value: 4.2, decimals: 1, suffix: "B" } so a stat can count up. */
  function parseStat(text) {
    const m = String(text).match(/^([^0-9-]*)(-?[0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/);
    if (!m) return null;
    const num = m[2].replace(/,/g, "");
    return { prefix: m[1], value: parseFloat(num), digits: m[2], decimals: (num.split(".")[1] || "").length, suffix: m[3], comma: m[2].includes(",") };
  }
  /** An odometer: every digit column rolls to its value with a staggered spring. */
  function odometer(parent, text, styles, start = 0.4) {
    const CELL = 1.02;
    const box = css(el("div", "line", parent), Object.assign({ display: "inline-flex", alignItems: "flex-start", overflow: "hidden", height: CELL + "em", lineHeight: CELL + "em" }, styles));
    const cols = [];
    [...String(text)].forEach((ch, i) => {
      if (/[0-9]/.test(ch)) {
        // Each column is as wide as its final digit, so "1" sits tight; rolling digits are clipped.
        const col = css(el("span", "", box), { display: "inline-block", position: "relative", height: CELL + "em", overflow: "hidden", textAlign: "center" });
        const probe = el("span", "", col); probe.textContent = ch; probe.style.display = "inline-block";
        cols.push({ col, probe, strip: null, target: 10 + Number(ch), delay: i * 0.07 });
      } else { const s = el("span", "", box); s.textContent = ch; }
    });
    cue("tick", start, 0.5);
    let built = false;
    const build = () => {
      for (const c of cols) {
        c.col.style.width = c.probe.getBoundingClientRect().width / (B.W ? 1 : 1) + "px";
        c.col.removeChild(c.probe);
        c.strip = css(el("span", "", c.col), { display: "flex", flexDirection: "column", alignItems: "center" });
        for (let d = 0; d <= 19; d++) { const s = el("span", "", c.strip); s.textContent = String(d % 10); css(s, { height: CELL + "em", display: "block" }); }
      }
      built = true;
    };
    return {
      node: box,
      /** Call after the font size is final (fitLines): fixes each column to its digit's width. */
      lock: build,
      update(t) { if (!built) build(); cols.forEach(({ strip, target, delay }) => { const p = sp(t, start + delay, { f: 1.1, z: 0.8 }); strip.style.transform = `translateY(${-p * target * CELL}em)`; }); },
    };
  }
  function formatStat(p, x) {
    let v = (p.value * x).toFixed(p.decimals);
    if (p.comma) v = Number(v).toLocaleString("en-US", { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals });
    return p.prefix + v + p.suffix;
  }

  Object.assign(B, {
    clamp, seg, lerp, ease, rng, choose, beat, spring, sp, life, SPR,
    luminance, onColor, mix, alpha, brandColors, el, css, wide, pick,
    fitLines, fitEach, line, cue, camera, grain, vignette, finish, ambient, hold, underline, sheenText, sheenMask,
    logoNode, logoMask, logo, splitChars, maskWrap, animate, iris, bars, halftone, burst,
    bakeSticker, sticker, hero, parseStat, odometer, formatStat,
    setFormat(w, h) { B.W = w; B.H = h; },
  });
  window.BANNER = B;
})();
