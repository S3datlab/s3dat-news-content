/* COLLAGE — off-white paper with a pile of pieces: the story's cut-outs as die-cut stickers (or crops
   of the story image as photo cards), the logo on a brand-colour tile, the stat on a black tile.
   Pieces fly in at angles, drift, and reshuffle once. The headline sits on the paper, the accent
   line set in an italic serif. */
BANNER.templates.collage = (stage, d, B) => {
  const { el, css, seg, lerp, ease, fitLines, logoNode, brandColors, rng } = B;
  const brand = d.brands[0];
  const c = brandColors(brand, "#ff5a36");
  const rand = rng(d.seed * 104729);
  const root = css(el("div", "layer", stage), { background: "#eeebe4" });
  css(el("div", "layer", root), { backgroundImage: "radial-gradient(rgba(0,0,0,.06) 1px, transparent 1px)", backgroundSize: "6px 6px" });

  const tile = (w, h, bg) => css(el("div", "abs", root), { width: w + "px", height: h + "px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 18px 40px -18px rgba(0,0,0,.45)", background: bg, display: "grid", placeItems: "center" });
  // Pieces in order of importance: hero, logo tile, props, second logo, stat, story-image crops.
  const pieces = [];
  const cuts = d.cutouts || [];
  const hero = cuts.find((x) => x.role === "hero") || cuts[0];
  if (hero) pieces.push({ node: css(B.sticker(hero, root), { width: "340px", height: "340px" }), w: 340, h: 340 });
  const logoTile = tile(200, 200, c.dark ? "#111" : c.base);
  css(logoNode(brand, c.dark ? "#fff" : c.ink, logoTile), { width: "116px", height: "116px" });
  pieces.push({ node: logoTile, w: 200, h: 200 });
  cuts.filter((x) => x !== hero).slice(0, 2).forEach((cut) => pieces.push({ node: css(B.sticker(cut, root), { width: "210px", height: "210px" }), w: 210, h: 210 }));
  if (d.brands[1]) { const t2 = tile(170, 170, "#111"); css(logoNode(d.brands[1], "#fff", t2), { width: "96px", height: "96px" }); pieces.push({ node: t2, w: 170, h: 170 }); }
  if (d.stat) { const s = tile(250, 150, "#111"); const n = css(el("div", "", s), { font: "700 84px/1 'Space Grotesk'", letterSpacing: "-0.04em", color: c.dark ? "#ff5a36" : c.vivid }); n.textContent = d.stat.value; pieces.push({ node: s, w: 250, h: 150 }); }
  if (d.art) [[20, 30], [80, 60], [45, 85]].forEach(([x, y]) => { const a = tile(250, 180, "#222"); css(a, { backgroundImage: `url(${d.art})`, backgroundSize: "190%", backgroundPosition: `${x}% ${y}%` }); pieces.push({ node: a, w: 250, h: 180 }); });
  const items = pieces.slice(0, 5);
  // Slot centres (x, y), rotation and scale for each pile size; the pile reshuffles one slot on.
  const SLOTS = {
    1: [[840, 300, -4, 1.3]],
    2: [[815, 330, -5, 1.15], [975, 120, 8, 0.9]],
    3: [[805, 340, -5, 1.08], [975, 125, 8, 0.9], [985, 470, 6, 0.85]],
    4: [[805, 330, -6, 1.02], [975, 115, 7, 0.85], [985, 465, 5, 0.85], [735, 95, -8, 0.75]],
    5: [[805, 330, -6, 0.98], [975, 110, 7, 0.8], [985, 470, 5, 0.8], [735, 90, -8, 0.72], [740, 535, 6, 0.72]],
  };
  const slots = SLOTS[items.length];
  const A = items.map((_, i) => slots[i]);
  const Bp = items.map((_, i) => (i === 0 ? [slots[0][0] + 15, slots[0][1] + 10, -slots[0][2], slots[0][3]] : slots[1 + (i % (items.length - 1 || 1))] || slots[i]));
  const from = items.map(() => [lerp(-300, 1400, rand()), rand() > 0.5 ? -360 : 980, lerp(-60, 60, rand())]);

  const strip = css(el("div", "abs", root), { left: "52px", top: "0", bottom: "0", width: "560px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const lines = d.headline.map((text, i) => {
    const n = css(el("div", "line", strip), i === d.accent
      ? { font: "italic 400 80px/0.95 'Instrument Serif'", color: c.dark ? "#d4361c" : c.vivid, textTransform: "none", letterSpacing: "-0.01em" }
      : { font: "900 80px/0.9 Archivo", fontStretch: "62%", color: "#111", textTransform: "uppercase" });
    n.textContent = i === d.accent ? text.charAt(0) + text.slice(1).toLowerCase() : text;
    return n;
  });
  B.fitEach(lines, 540, 460, 140, 34, 0.95);

  return {
    poster: 2.2,
    frame(t) {
      const shuffle = ease.inOut(seg(t, 4.3, 5.1));
      const leave = ease.inCubic(seg(t, 7.35, 7.95));
      items.forEach(({ node, w, h }, i) => {
        const land = ease.outCubic(seg(t, 0.1 + i * 0.16, 0.9 + i * 0.16));
        const [ax, ay, ar, as] = A[i], [bx, by, br, bs] = Bp[i], [fx, fy, fr] = from[i];
        const cx = lerp(fx, lerp(ax, bx, shuffle), land) + Math.sin(t * 0.9 + i) * 6 + leave * (i % 2 ? 900 : -900);
        const cy = lerp(fy, lerp(ay, by, shuffle), land) + Math.cos(t * 0.7 + i) * 5;
        const r = lerp(fr, lerp(ar, br, shuffle), land);
        const k = lerp(as, bs, shuffle);
        node.style.left = "0"; node.style.top = "0";
        node.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px) rotate(${r}deg) scale(${k})`;
        node.style.zIndex = String(10 - i);
      });
      lines.forEach((n, i) => {
        const x = ease.outExpo(seg(t, 0.9 + i * 0.15, 1.7 + i * 0.15));
        n.style.transform = `translateY(${(1 - x) * 50}px)`;
        n.style.opacity = x * (1 - leave);
      });
    },
  };
};
