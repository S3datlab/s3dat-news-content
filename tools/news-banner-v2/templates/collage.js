/* COLLAGE — off-white paper with a pile of pieces: the story's cut-outs as die-cut stickers (or crops
 * of the story image as photo cards held by tape), the logo drawing itself on a brand tile, the
 * stat on a black tile. Pieces land on springs at angles, drift, and reshuffle one slot on the
 * beat. The headline sits on the paper with its accent line set in an italic serif. */
BANNER.templates.collage = (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, beat, brandColors, rng, pick, wide } = B;
  const W = B.W, H = B.H, isWide = wide();
  const brand = d.brands[0];
  const c = brandColors(brand, "#ff5a36");
  const rand = rng(d.seed * 104729);
  stage.style.background = "#eeebe4";
  const cam = B.camera(stage, { push: 0.035, drift: 9, sway: 0.3 });
  const back = cam.layer(0.2), mid = cam.layer(0.6), front = cam.layer(1);
  const amb = B.ambient(back, { bg: "#eeebe4", ink: "#111111", accent: c.vivid, text: d.headline.join(" "), y: H * 0.5, seed: d.seed });
  css(el("div", "layer", back), { inset: "-60px", backgroundImage: "radial-gradient(rgba(0,0,0,.07) 1px, transparent 1px)", backgroundSize: "6px 6px" });

  const tape = (node, w) => css(el("div", "abs", node), { left: "50%", top: "-12px", width: w + "px", height: "26px", marginLeft: -w / 2 + "px", background: "rgba(255,248,220,.72)", transform: `rotate(${(rand() - 0.5) * 10}deg)`, boxShadow: "0 1px 2px rgba(0,0,0,.08)" });
  const tile = (w, h, bg) => css(el("div", "abs", front), { width: w + "px", height: h + "px", borderRadius: "8px", boxShadow: "0 18px 40px -18px rgba(0,0,0,.45)", background: bg, display: "grid", placeItems: "center" });
  const pieces = [];
  const cuts = d.cutouts || [];
  const hero = cuts.find((x) => x.role === "hero") || cuts[0];
  const scale = pick(1, 1.25);
  if (hero) {
    // Size the hero by its own shape: a standing figure gets a tall box instead of shrinking in a square.
    const hh = ((hero.aspect || 1) < 0.85 ? 470 : 360) * scale, hw = Math.round(Math.min(420 * scale, Math.max(220, hh * (hero.aspect || 1))));
    const actor = B.hero(hero, front, { mood: d.mood, sheen: 2.4 });
    css(actor.node, { width: hw + "px", height: hh + "px" });
    pieces.push({ node: actor.node, w: hw, h: hh, actor });
  }
  const logoTile = tile(200 * scale, 200 * scale, c.dark ? "#111" : c.base);
  const mark = css(B.logo(brand, c.dark ? "#fff" : c.ink, logoTile, 0.8, 0.9), { width: "58%", height: "58%" });
  pieces.push({ node: logoTile, w: 200 * scale, h: 200 * scale });
  cuts.filter((x) => x !== hero).slice(0, 2).forEach((cut) => pieces.push({ node: css(B.sticker(cut, front), { width: 210 * scale + "px", height: 210 * scale + "px" }), w: 210 * scale, h: 210 * scale }));
  if (d.brands[1]) { const t2 = tile(170 * scale, 170 * scale, "#111"); css(B.logoNode(d.brands[1], "#fff", t2), { width: "56%", height: "56%" }); pieces.push({ node: t2, w: 170 * scale, h: 170 * scale }); }
  if (d.stat) { const s = tile(250 * scale, 150 * scale, "#111"); const n = css(el("div", "", s), { font: `700 ${84 * scale}px/1 'Space Grotesk'`, letterSpacing: "-0.04em", color: c.dark ? "#ff5a36" : c.vivid }); n.textContent = d.stat.value; tape(s, 90); pieces.push({ node: s, w: 250 * scale, h: 150 * scale }); }
  if (d.art) [[20, 30], [80, 60], [45, 85]].forEach(([x, y]) => { const a = tile(250 * scale, 180 * scale, "#222"); css(a, { backgroundImage: `url(${d.art})`, backgroundSize: "190%", backgroundPosition: `${x}% ${y}%` }); tape(a, 100); pieces.push({ node: a, w: 250 * scale, h: 180 * scale }); });
  const items = pieces.slice(0, 5);
  // Slot centres (x, y), rotation and scale for each pile size; the pile reshuffles one slot on.
  const SW = {
    1: [[840, 300, -4, 1.3]],
    2: [[815, 330, -5, 1.15], [975, 120, 8, 0.9]],
    3: [[805, 340, -5, 1.08], [975, 125, 8, 0.9], [985, 470, 6, 0.85]],
    4: [[805, 330, -6, 1.02], [975, 115, 7, 0.85], [985, 465, 5, 0.85], [735, 95, -8, 0.75]],
    5: [[805, 330, -6, 0.98], [975, 110, 7, 0.8], [985, 470, 5, 0.8], [735, 90, -8, 0.72], [740, 535, 6, 0.72]],
  };
  const ST = {
    1: [[540, 960, -4, 1.3]],
    2: [[470, 990, -5, 1.1], [820, 760, 8, 0.9]],
    3: [[450, 1000, -5, 1.05], [820, 760, 8, 0.9], [830, 1150, 6, 0.85]],
    4: [[450, 1000, -6, 1.0], [830, 760, 7, 0.85], [840, 1140, 5, 0.85], [200, 770, -8, 0.75]],
    5: [[460, 1000, -6, 0.95], [840, 760, 7, 0.8], [850, 1150, 5, 0.8], [190, 760, -8, 0.72], [200, 1180, 6, 0.72]],
  };
  const slots = (isWide ? SW : ST)[items.length];
  const A = items.map((_, i) => slots[i]);
  const Bp = items.map((_, i) => (i === 0 ? [slots[0][0] + 15, slots[0][1] + 10, -slots[0][2], slots[0][3]] : slots[1 + (i % (items.length - 1 || 1))] || slots[i]));
  const from = items.map(() => [lerp(-300, W + 300, rand()), rand() > 0.5 ? -400 : H + 300, lerp(-60, 60, rand())]);
  items.forEach((_, i) => B.cue("pop", 0.25 + i * 0.16, 0.5, i % 2 ? 0.4 : -0.4));

  const box = isWide ? { x: 52, y: 0, w: 560, h: H } : { x: 70, y: 90, w: 940, h: 560 };
  const strip = css(el("div", "abs", mid), { left: box.x + "px", top: box.y + "px", width: box.w + "px", height: box.h + "px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const lines = d.headline.map((text, i) => i === d.accent
    ? B.line(strip, text.charAt(0) + text.slice(1).toLowerCase(), { font: "italic 400 80px/0.95 'Instrument Serif'", color: c.dark ? "#d4361c" : c.vivid, letterSpacing: "-0.01em", display: "block" })
    : B.line(strip, text, { font: "900 80px/0.9 Archivo", fontStretch: "62%", color: "#111", textTransform: "uppercase", display: "block" }));
  B.fitEach(lines, box.w - 20, box.h - 60, isWide ? 200 : 230, 34, 0.95);
  const under = B.underline(lines[d.accent] || lines[lines.length - 1], c.dark ? "#d4361c" : c.vivid, 2.0, 0.06);
  const plain = lines.filter((_, i) => i !== d.accent), accent = lines.filter((_, i) => i === d.accent);
  const animP = B.animate(plain, B.choose(d.seed, ["rise", "skew", "drop"]), { start: 0.9, out: [7.3, 7.75], seed: d.seed });
  const animA = B.animate(accent, "track", { start: 1.15, out: [7.35, 7.8], seed: d.seed + 1 });
  const shuffle = beat(8.6);
  B.cue("whoosh", shuffle, 0.6);
  B.cue("whoosh", 7.3, 0.7);

  const holdA = B.hold(strip, 2.0, 7.3);
  return {
    poster: 2.4,
    frame(t) {
      cam.update(t);
      amb(t);
      under(t);
      holdA(t);
      const sh = Math.min(1.04, sp(t, shuffle, "heavy"));
      const leave = ease.inCubic(seg(t, 7.3, 7.85));
      items.forEach(({ node, w, h, actor }, i) => {
        const land = Math.min(1.04, sp(t, 0.1 + i * 0.16, "heavy"));
        const [ax, ay, ar, as] = A[i], [bx, by, br, bs] = Bp[i], [fx, fy, fr] = from[i];
        const cx = lerp(fx, lerp(ax, bx, sh), land) + Math.sin(t * 0.9 + i) * 6 + leave * (i % 2 ? 1 : -1) * (W + 200);
        const cy = lerp(fy, lerp(ay, by, sh), land) + Math.cos(t * 0.7 + i) * 5;
        const r = lerp(fr, lerp(ar, br, sh), land), k = lerp(as, bs, sh);
        node.style.left = "0"; node.style.top = "0";
        if (actor) { actor.update(t, 1, 0); node.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px) rotate(${r}deg) scale(${k}) ` + node.style.transform; }
        else node.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px) rotate(${r}deg) scale(${k})`;
        node.style.zIndex = String(10 - i);
      });
      mark.draw(t);
      animP(t);
      animA(t);
    },
  };
};
