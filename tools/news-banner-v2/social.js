/* REEL — the 15-second vertical video for Instagram Reels (1080x1920), made for the format rather
 * than cut down from the banner. It is edited like a short news clip:
 *
 *   hook      the headline slams in over the story's hero (or its logo), with an impact
 *   beats     one visual per idea while the voice-over runs: a number counting up on a card in the
 *             brand colour, the hero on a disc, the logos (face to face when there are two), a fact
 *   sign-off  the S3DAT rotor, the wordmark and news.s3dat.com
 *
 * Cuts land on phrase boundaries of the voice-over (d.story.captions, timed by render.mjs), so the
 * picture changes when the sentence does. Below the picture the voice-over runs as kinetic type,
 * words lighting up as they are spoken. A segmented progress bar and the S3DAT NEWS header sit at
 * the top; everything stays inside the Reels safe zone (clear of the header, the caption and the
 * buttons). The background is the brand colour, deepened, with drifting light and the story's art
 * blurred in when it has one. Returns { poster, frame(t) } for t in seconds. */
BANNER.reel = async (root, d, B) => {
  const { el, css, seg, lerp, ease, sp, brandColors, onColor, alpha, mix, clamp } = B;
  const W = 1080;
  const DURATION = d.format.seconds;
  B.DURATION = DURATION; // cues and the camera run over the whole reel
  const story = d.story || {};
  const brands = d.brands || [];
  const c = brandColors(brands[0], "#5cc8ff");
  const pop = B.luminance(c.base) < 0.05 || B.luminance(c.base) > 0.85 ? "#5cc8ff" : c.base;
  const ink = onColor(pop);
  const deep = mix(pop, "#04060a", 0.86);
  const second = brands[1] ? brandColors(brands[1], "#ffd166").vivid : mix(pop, "#ffffff", 0.45);
  const STAGE = { y: 300, h: 860 };
  const CAP = { x: 64, y: 1206, w: 870, h: 270 };
  const hero = (d.cutouts || []).find((x) => x.role === "hero") || (d.cutouts || [])[0] || null;
  const logoColor = (br) => (B.luminance(br.color || "#111111") > 0.8 ? "#111111" : br.color || "#111111");

  /* ---------- background ---------- */
  css(root, { background: deep });
  const field = el("div", "layer", root);
  const blobA = css(el("div", "abs", field), { width: "1500px", height: "1500px", left: "-420px", top: "-260px", borderRadius: "50%", background: `radial-gradient(circle, ${alpha(pop, 0.55)}, transparent 62%)` });
  const blobB = css(el("div", "abs", field), { width: "1400px", height: "1400px", left: "180px", top: "820px", borderRadius: "50%", background: `radial-gradient(circle, ${alpha(second, 0.32)}, transparent 62%)` });
  let art = null;
  if (d.art) {
    // Blurred once on a small canvas, then scaled up: no live blur in the frames.
    const img = new Image();
    img.src = d.art;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = 180; cv.height = 320;
    const g = cv.getContext("2d");
    const k = Math.max(cv.width / img.width, cv.height / img.height);
    g.filter = "blur(5px) saturate(1.3)";
    g.drawImage(img, (cv.width - img.width * k) / 2, (cv.height - img.height * k) / 2, img.width * k, img.height * k);
    art = css(el("img", "abs", field), { left: "-8%", top: "-8%", width: "116%", height: "116%", objectFit: "cover", opacity: 0.42, mixBlendMode: "screen" });
    art.src = cv.toDataURL("image/jpeg", 0.9);
  }
  css(el("div", "layer", root), { background: "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.55) 66%, rgba(0,0,0,0.8) 100%)" });
  B.grain(root, 0.06);

  /* ---------- the picture: scenes inside a filmed stage ---------- */
  const stageBox = css(el("div", "abs", root), { left: 0, top: STAGE.y + "px", width: W + "px", height: STAGE.h + "px", overflow: "hidden" });
  const cam = B.camera(stageBox, { push: 0.035, drift: 10, sway: 0.4 });
  const sceneLayer = cam.layer(0.4);

  // Timeline: the hook, then a cut at a phrase boundary every 2.2 s or more, then the sign-off.
  const phrases = story.captions || [];
  const lastWord = phrases.length ? phrases[phrases.length - 1].end : 0;
  const signAt = Math.min(DURATION - 1.6, Math.max(lastWord + 0.15, DURATION - 2.6));
  const starts = phrases.map((p) => p.start);
  const hookEnd = starts.find((s) => s >= 2.3 && s <= 3.6) || Math.min(2.9, signAt - 0.5);
  const cuts = [0, hookEnd];
  for (const s of starts) if (s > cuts[cuts.length - 1] + 2.2 && s < signAt - 1.8) cuts.push(s);
  cuts.push(signAt);

  // What the beats show: numbers first (they carry news), then the hero, the logos, plain facts.
  const facts = (story.facts || []).filter((f) => f.label && f.value);
  // A number worth a card: not a date, not a lone digit ("1 sample" says little on screen).
  const MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
  const numeric = facts.filter((f) => /\d/.test(f.value) && f.value.length <= 22 && !MONTH.test(f.value) && !/^\D*\d\D*$/.test(f.value.replace(/\s+(?:[a-z]+)$/i, "")));
  const pool = [];
  if (d.stat) pool.push({ kind: "number", label: d.stat.label || "", value: d.stat.value });
  for (const f of numeric) if (!pool.some((p) => p.value === f.value) && pool.filter((p) => p.kind === "number").length < 2) pool.push({ kind: "number", label: f.label, value: f.value });
  if (hero) pool.push({ kind: "hero" });
  if (brands.length) pool.push({ kind: "logos" });
  for (const f of facts) if (!numeric.includes(f) && f.value.length <= 70) pool.push({ kind: "fact", label: f.label, value: f.value });
  if (!pool.length) pool.push({ kind: "headline" });
  const beats = cuts.slice(1, -1).map((t0, i) => ({ ...pool[i % pool.length], t0, t1: cuts[i + 2] }));

  const scenes = [];
  const newScene = (t0, t1) => {
    const node = css(el("div", "layer", sceneLayer), { visibility: "hidden" });
    const s = { node, t0, t1, parts: [] };
    scenes.push(s);
    return s;
  };

  /* hook: the headline over the hero */
  {
    const s = newScene(0, hookEnd);
    if (hero) {
      const box = css(el("div", "abs", s.node), { right: "-30px", bottom: "-20px", width: "620px", height: "640px" });
      const h = B.hero(hero, box, { mood: d.mood, poseTimes: [hookEnd * 0.6], sheen: 1.2 });
      css(h.node, { left: 0, top: 0, width: "100%", height: "100%" });
      s.parts.push((t) => h.update(t, Math.min(1, sp(t, 0.35, "heavy")), 0));
    } else if (brands[0]) {
      // No hero: the logo on a white disc rolls in under the headline.
      const disc = css(el("div", "abs", s.node), { right: "70px", bottom: "40px", width: "320px", height: "320px", borderRadius: "50%", background: "#ffffff", boxShadow: "0 40px 80px rgba(0,0,0,0.4)", display: "grid", placeItems: "center" });
      css(B.logoNode(brands[0], logoColor(brands[0]), disc), { width: "180px", height: "180px" });
      s.parts.push((t) => {
        const p = sp(t, 0.55, "pop");
        disc.style.transform = `translateX(${(1 - Math.min(1, p)) * 500}px) rotate(${(1 - Math.min(1, p)) * 160}deg) scale(${Math.min(1.05, p)})`;
        disc.style.opacity = seg(t, 0.55, 0.65);
      });
      B.cue("swish", 0.5, 0.6, 0.4);
    }
    const head = css(el("div", "abs", s.node), { left: "60px", top: "40px", width: "960px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px" });
    const lines = d.headline.map((text, i) => {
      const n = B.line(head, text, { font: "900 100px/0.92 Archivo", fontStretch: "72%", color: "#ffffff", letterSpacing: "-0.01em", textShadow: "0 6px 30px rgba(0,0,0,0.35)" });
      if (i === d.accent) css(n, { background: pop, color: ink, padding: "0.04em 0.12em 0.02em", borderRadius: "0.08em", textShadow: "none" });
      return n;
    });
    B.fitEach(lines, 940, hero ? 470 : brands[0] ? 440 : 640, 230, 80, 0.94);
    const slam = B.animate(lines, "slam", { start: 0.12, stagger: 0.18, out: null, camera: cam });
    const landAt = 0.12 + (lines.length - 1) * 0.18 + 0.1;
    const boom = B.burst(s.node, 120, 120, pop, 12, 60, 200);
    s.parts.push((t) => { slam(t); boom(t, landAt); });
  }

  /* beats */
  for (const b of beats) {
    const s = newScene(b.t0, b.t1);
    const a = b.t0; // entrance time
    if (b.kind === "number") {
      const card = css(el("div", "abs", s.node), { left: "90px", top: "120px", width: "900px", height: "560px", borderRadius: "40px", background: pop, boxShadow: "0 40px 90px rgba(0,0,0,0.45)", padding: "56px 60px", display: "flex", flexDirection: "column", justifyContent: "space-between", transformOrigin: "50% 60%" });
      const label = B.line(card, String(b.label).toUpperCase(), { font: "700 40px/1.1 'Space Grotesk'", color: ink, opacity: 0.78, letterSpacing: "0.1em", whiteSpace: "normal", display: "block" });
      const value = B.line(card, b.value, { font: "900 100px/0.95 Archivo", fontStretch: "72%", color: ink, letterSpacing: "-0.01em" });
      B.fitEach([value], 780, 330, 330, 90, 0.95);
      const stat = B.parseStat(b.value);
      const counts = stat && stat.value > 0 && /^[^0-9]*[0-9][0-9,.]*[^0-9]*$/.test(b.value);
      const ring = css(el("div", "abs", s.node), { left: "540px", top: "400px", width: "10px", height: "10px", borderRadius: "50%", border: `6px solid ${alpha(pop, 0.8)}`, transform: "translate(-50%, -50%)" });
      B.cue("whoosh", a - 0.1, 0.7, -0.3); B.cue("pop", a + 0.12, 0.8); if (counts) B.cue("tick", a + 0.3, 0.6);
      s.parts.push((t) => {
        const p = sp(t, a, "pop");
        card.style.transform = `translateY(${(1 - Math.min(1, p)) * 160}px) rotate(${lerp(-10, -2.5, Math.min(1, p))}deg) scale(${0.7 + 0.3 * Math.min(1.04, p)})`;
        label.style.opacity = 0.78 * seg(t, a + 0.15, a + 0.3);
        if (counts) value.textContent = B.formatStat(stat, ease.outExpo(seg(t, a + 0.25, a + 1.2)));
        const r = seg(t, a + 0.05, a + 0.9);
        ring.style.width = ring.style.height = 200 + r * 1100 + "px";
        ring.style.opacity = (1 - r) * 0.7;
      });
    } else if (b.kind === "hero") {
      const disc = css(el("div", "abs", s.node), { left: "540px", top: "470px", width: "720px", height: "720px", borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, ${mix(pop, "#ffffff", 0.25)}, ${pop} 60%, ${mix(pop, "#000000", 0.3)})`, transform: "translate(-50%, -50%)" });
      const rings = [0, 1].map(() => css(el("div", "abs", s.node), { left: "540px", top: "470px", borderRadius: "50%", border: `4px solid ${alpha("#ffffff", 0.5)}`, transform: "translate(-50%, -50%)" }));
      const box = css(el("div", "abs", s.node), { left: "190px", top: "60px", width: "700px", height: "760px" });
      const h = B.hero(hero, box, { mood: d.mood, poseTimes: [a + 0.9], sheen: a + 0.5 });
      css(h.node, { left: 0, top: 0, width: "100%", height: "100%" });
      let badge = null;
      if (brands[0]) {
        badge = css(el("div", "abs", s.node), { left: "760px", top: "120px", width: "190px", height: "190px", borderRadius: "50%", background: "#ffffff", boxShadow: "0 18px 40px rgba(0,0,0,0.35)", display: "grid", placeItems: "center" });
        css(B.logoNode(brands[0], logoColor(brands[0]), badge), { width: "110px", height: "110px" });
      }
      B.cue("whoosh", a - 0.1, 0.7, 0.3); B.cue("pop", a + 0.5, 0.7);
      s.parts.push((t) => {
        const p = Math.min(1.06, sp(t, a, "pop"));
        disc.style.transform = `translate(-50%, -50%) scale(${p})`;
        rings.forEach((r, i) => { const q = (((t - a) * 0.6 + i * 0.5) % 1 + 1) % 1; r.style.width = r.style.height = 720 + q * 520 + "px"; r.style.opacity = t >= a ? (1 - q) * 0.6 : 0; });
        h.update(t, clamp(sp(t, a, "snap"), 0, 1), 0);
        if (badge) badge.style.transform = `scale(${Math.min(1.08, sp(t, a + 0.5, "pop"))}) rotate(${(1 - Math.min(1, sp(t, a + 0.5, "snap"))) * -30}deg)`;
      });
    } else if (b.kind === "logos") {
      const two = brands.length > 1;
      const discs = brands.slice(0, 2).map((br, i) => {
        const size = two ? 370 : 560;
        const x = two ? (i ? 800 : 280) : 540;
        const disc = css(el("div", "abs", s.node), { left: x + "px", top: "420px", width: size + "px", height: size + "px", borderRadius: "50%", background: "#ffffff", boxShadow: "0 40px 80px rgba(0,0,0,0.4)", display: "grid", placeItems: "center", transform: "translate(-50%, -50%)" });
        const mark = B.logo(br, logoColor(br), disc, a + 0.2 + i * 0.25, 0.8);
        css(mark, { width: size * 0.56 + "px", height: size * 0.56 + "px" });
        return { disc, mark, i };
      });
      let vs = null;
      if (two) {
        vs = B.line(s.node, "VS", { font: "900 150px/1 Archivo", fontStretch: "72%", color: pop, position: "absolute", left: "540px", top: "420px", textShadow: "0 10px 30px rgba(0,0,0,0.5)" });
        B.cue("hit", a + 0.55, 0.8);
      }
      B.cue("whoosh", a - 0.1, 0.7);
      s.parts.push((t) => {
        discs.forEach(({ disc, mark, i }) => {
          const p = Math.min(1.06, sp(t, a + i * 0.12, "pop"));
          disc.style.transform = `translate(-50%, -50%) translateX(${two ? (1 - Math.min(1, p)) * (i ? 500 : -500) : 0}px) scale(${two ? 1 : p})`;
          mark.draw(t);
        });
        if (vs) { const q = sp(t, a + 0.55, "pop"); vs.style.transform = `translate(-50%, -50%) scale(${1 + (1 - Math.min(1, q)) * 1.5})`; vs.style.opacity = seg(t, a + 0.55, a + 0.6); }
      });
    } else {
      // A fact without a number, or the accent line of the headline.
      const text = b.kind === "fact" ? b.value : d.headline[d.accent] || d.headline[0];
      const panel = css(el("div", "abs", s.node), { left: "60px", top: "150px", width: "960px", padding: "56px 60px 60px 76px", borderRadius: "36px", background: "rgba(8,10,14,0.55)", boxShadow: "0 30px 80px rgba(0,0,0,0.35)", overflow: "hidden" });
      const bar = css(el("div", "abs", panel), { left: 0, top: 0, bottom: 0, width: "16px", background: pop, transformOrigin: "50% 0" });
      const label = b.kind === "fact" ? B.line(panel, String(b.label).toUpperCase(), { font: "700 36px/1.1 'Space Grotesk'", color: pop, letterSpacing: "0.12em", display: "block", marginBottom: "26px", whiteSpace: "normal" }) : null;
      const body = css(el("div", "", panel), { font: "900 96px/1.0 Archivo", fontStretch: "74%", color: "#ffffff", textTransform: "uppercase" });
      body.textContent = text;
      for (let size = 110; size >= 56; size -= 4) { body.style.fontSize = size + "px"; if (body.getBoundingClientRect().height <= 420) break; }
      B.cue("swish", a - 0.05, 0.7);
      s.parts.push((t) => {
        const p = sp(t, a, "snap");
        panel.style.transform = `translateX(${(1 - Math.min(1, p)) * -1100}px)`;
        bar.style.transform = `scaleY(${seg(t, a + 0.15, a + 0.45)})`;
        if (label) label.style.opacity = seg(t, a + 0.2, a + 0.35);
        body.style.clipPath = `inset(0 ${(1 - ease.outExpo(seg(t, a + 0.2, a + 0.7))) * 100}% 0 0)`;
      });
    }
  }

  /* sign-off */
  const blade = "M250.5 65.1 C196.8 69.9 139.7 101.4 106.8 144.2 C90.7 164.9 70.2 213.0 64.4 243.7 C44.0 349.7 95.9 454.2 193.3 503.5 C247.0 530.6 329.8 543.9 382.3 533.9 C393.1 531.9 407.0 529.4 413.0 528.5 C421.6 527.2 473.0 511.7 473.0 510.4 C473.0 510.2 464.9 509.9 455.1 509.8 C399.6 508.8 355.1 488.3 329.0 451.8 C300.3 411.6 300.5 360.5 329.5 317.4 C344.6 295.0 356.9 285.3 383.5 273.7 C409.5 262.6 446.3 232.0 458.8 211.7 C471.5 190.8 471.8 189.5 471.2 145.6 C470.8 106.8 470.8 106.8 465.8 95.4 C459.8 81.2 448.4 68.6 440.6 67.4 C415.5 63.8 284.8 62.2 250.5 65.1 Z";
  const rotor = (size, id) => `<svg viewBox="0 0 1000 1000" width="${size}" height="${size}"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="160" y1="175" x2="505" y2="570"><stop offset="0" stop-color="#afceeb"/><stop offset="0.52" stop-color="#6790bd"/><stop offset="1" stop-color="#2d4f76"/></linearGradient></defs>${[0, 90, 180, 270].map((r) => `<path d="${blade}" transform="rotate(${r} 500 500)" fill="url(#${id})"/>`).join("")}</svg>`;
  {
    const s = newScene(signAt, DURATION + 1);
    const a = signAt;
    const col = css(el("div", "abs", s.node), { left: 0, right: 0, top: "120px", display: "flex", flexDirection: "column", alignItems: "center", gap: "34px" });
    const mark = el("div", "", col, rotor(300, "rs"));
    const word = B.line(col, "S3DAT NEWS", { font: "900 150px/1 Archivo", fontStretch: "78%", color: "#ffffff" });
    const url = css(B.line(col, "news.s3dat.com", { font: "700 66px/1 'Space Grotesk'", color: ink }), { background: pop, padding: "16px 34px 22px", borderRadius: "18px" });
    B.cue("whoosh", a - 0.1, 0.6); B.cue("pop", a + 0.1, 0.7);
    s.parts.push((t) => {
      const p = sp(t, a, "pop");
      mark.style.transform = `rotate(${(1 - Math.min(1, p)) * -160 + (t - a) * 40}deg) scale(${clamp(p, 0, 1.08)})`;
      word.style.opacity = seg(t, a + 0.12, a + 0.3);
      word.style.transform = `translateY(${(1 - ease.outExpo(seg(t, a + 0.12, a + 0.55))) * 50}px)`;
      const u = sp(t, a + 0.3, "pop");
      url.style.opacity = seg(t, a + 0.3, a + 0.42);
      url.style.transform = `scale(${0.85 + 0.15 * Math.min(1.06, u)})`;
    });
  }

  // A slab in the brand colour sweeps across the picture at every cut.
  const slab = css(el("div", "abs", stageBox), { left: "-40%", top: "-20%", width: "60%", height: "140%", background: `linear-gradient(90deg, transparent, ${alpha(pop, 0.85)} 40%, ${alpha("#ffffff", 0.7)} 50%, ${alpha(pop, 0.85)} 60%, transparent)`, transform: "skewX(-18deg)", visibility: "hidden" });
  const cutTimes = cuts.slice(1);

  /* ---------- header and progress ---------- */
  const segs = css(el("div", "abs", root), { left: "36px", right: "36px", top: "176px", height: "6px", display: "flex", gap: "8px" });
  const segFills = scenes.map((s) => {
    const track = css(el("div", "", segs), { flex: String(Math.max(0.5, Math.min(DURATION, s.t1) - s.t0)), height: "100%", borderRadius: "3px", background: "rgba(255,255,255,0.22)", overflow: "hidden" });
    return css(el("div", "", track), { width: "100%", height: "100%", background: "#ffffff", transformOrigin: "0 50%" });
  });
  const header = css(el("div", "abs", root), { left: "36px", top: "212px", display: "flex", alignItems: "center", gap: "16px" });
  const headMark = el("div", "", header, rotor(46, "rh"));
  B.line(header, "S3DAT NEWS", { font: "900 40px/1 Archivo", fontStretch: "80%", color: "#ffffff", letterSpacing: "0.01em" });
  if (story.topic) {
    css(el("div", "", header), { width: "2px", height: "30px", background: "rgba(255,255,255,0.35)" });
    B.line(header, String(story.topic).toUpperCase(), { font: "600 27px/1 'Space Grotesk'", color: "rgba(255,255,255,0.8)", letterSpacing: "0.14em" });
  }

  /* ---------- kinetic captions ---------- */
  const area = css(el("div", "abs", root), { left: CAP.x + "px", top: CAP.y + "px", width: CAP.w + "px", height: CAP.h + "px" });
  const caps = phrases.map((p) => {
    const node = css(el("div", "abs", area), { left: 0, top: 0, width: CAP.w + "px", font: "900 84px/1.0 Archivo", fontStretch: "76%", textTransform: "uppercase", letterSpacing: "-0.005em", color: "#ffffff", visibility: "hidden" });
    const words = p.words.map((w) => {
      const mask = css(el("span", "", node), { display: "inline-block", overflow: "hidden", verticalAlign: "top", padding: "0.06em 0.05em 0.02em", margin: "0 0.12em 0.04em 0" });
      const inner = css(el("span", "", mask), { display: "inline-block", padding: w.accent ? "0 0.14em" : "0", borderRadius: "0.14em", whiteSpace: "nowrap" });
      inner.textContent = w.text;
      return { ...w, inner };
    });
    // Largest size up to 84px at which the phrase fits in at most three lines.
    for (let size = 84; size >= 50; size -= 3) {
      node.style.fontSize = size + "px";
      if (node.getBoundingClientRect().height <= Math.min(CAP.h, size * 3 + 30) && node.scrollWidth <= CAP.w + 1) break;
    }
    return { ...p, node, words };
  });

  return {
    poster: Math.min(1.6, hookEnd - 0.2),
    frame(t) {
      cam.update(t);
      blobA.style.transform = `translate(${Math.sin(t * 0.35) * 120}px, ${Math.cos(t * 0.3) * 90}px)`;
      blobB.style.transform = `translate(${Math.cos(t * 0.28) * -140}px, ${Math.sin(t * 0.33) * 100}px)`;
      if (art) art.style.transform = `scale(${1.02 + 0.05 * (t / DURATION)}) translateY(${-t * 3}px)`;
      headMark.style.transform = `rotate(${t * 24}deg)`;
      header.style.opacity = seg(t, 0.05, 0.3);

      scenes.forEach((s, i) => {
        const on = t >= s.t0 - 0.06 && t < s.t1 + 0.12;
        s.node.style.visibility = on ? "visible" : "hidden";
        if (on) {
          // The outgoing scene shrinks away under the slab while the next one comes in.
          const out = ease.inCubic(seg(t, s.t1 - 0.12, s.t1 + 0.12));
          s.node.style.opacity = 1 - out;
          s.node.style.transform = `scale(${1 - out * 0.08})`;
          s.parts.forEach((f) => f(t));
        }
        segFills[i].style.transform = `scaleX(${seg(t, s.t0, Math.min(DURATION, s.t1))})`;
      });
      const near = cutTimes.find((ct) => t >= ct - 0.2 && t <= ct + 0.2);
      slab.style.visibility = near !== undefined ? "visible" : "hidden";
      if (near !== undefined) slab.style.left = `${lerp(-70, 120, ease.inOut(seg(t, near - 0.2, near + 0.2)))}%`;

      // Captions: one phrase at a time; it leaves before the next rises.
      caps.forEach((p, i) => {
        const next = i < caps.length - 1 ? caps[i + 1].start : signAt;
        const on = t >= p.start - 0.08 && t < next - 0.06 && t < signAt;
        p.node.style.visibility = on ? "visible" : "hidden";
        if (!on) return;
        const out = ease.inCubic(seg(t, next - 0.26, next - 0.06));
        p.node.style.opacity = 1 - out;
        p.node.style.transform = `translateY(${-out * 60}px)`;
        p.words.forEach((w, j) => {
          const rise = sp(t, p.start - 0.06 + j * 0.035, "snap");
          w.inner.style.transform = `translateY(${(1 - Math.min(1.08, rise)) * 105}%)`;
          const lit = seg(t, w.start - 0.04, w.start + 0.08);
          if (w.accent) {
            w.inner.style.background = alpha(pop, lit);
            w.inner.style.color = lit > 0.5 ? ink : `rgba(255,255,255,${lerp(0.4, 1, lit)})`;
          } else w.inner.style.color = `rgba(255,255,255,${lerp(0.4, 1, lit)})`;
        });
      });
    },
  };
};
