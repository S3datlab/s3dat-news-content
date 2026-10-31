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
  const pieces = [];
  const logoTile = tile(210, 210, c.dark ? "#111" : c.base);
  css(logoNode(brand, c.dark ? "#fff" : c.ink, logoTile), { width: "120px", height: "120px" });
  if (d.brands[1]) { const t2 = tile(170, 170, "#111"); css(logoNode(d.brands[1], "#fff", t2), { width: "96px", height: "96px" }); pieces.push(t2); }
  if (d.stat) { const s = tile(250, 150, "#111"); const n = css(el("div", "", s), { font: "700 84px/1 'Space Grotesk'", letterSpacing: "-0.04em", color: c.dark ? "#ff5a36" : c.vivid }); n.textContent = d.stat.value; pieces.push(s); }
  (d.cutouts || []).slice(0, 3).forEach((cut, i) => pieces.push(css(B.sticker(cut, root), { width: i ? "200px" : "300px", height: i ? "200px" : "300px" })));
  if (d.art) [[20, 30], [80, 60], [45, 85]].slice(0, Math.max(0, 4 - pieces.length)).forEach(([x, y]) => { const a = tile(250, 180, "#222"); css(a, { backgroundImage: `url(${d.art})`, backgroundSize: "190%", backgroundPosition: `${x}% ${y}%` }); pieces.unshift(a); });
  pieces.splice(1, 0, logoTile);
  const items = pieces.slice(0, 5);
  const A = [[620, 40, -7], [820, 60, 6], [640, 300, 4], [840, 320, -5], [740, 170, 2]];
  const Bp = [[600, 70, 5], [800, 30, -4], [860, 290, 7], [620, 320, -6], [730, 180, -2]];
  const from = items.map(() => [lerp(-300, 1400, rand()), rand() > 0.5 ? -360 : 900, lerp(-60, 60, rand())]);

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
      items.forEach((card, i) => {
        const land = ease.outCubic(seg(t, 0.1 + i * 0.16, 0.9 + i * 0.16));
        const [ax, ay, ar] = A[i], [bx, by, br] = Bp[i], [fx, fy, fr] = from[i];
        const x = lerp(fx, lerp(ax, bx, shuffle), land) + Math.sin(t * 0.9 + i) * 6 + leave * (i % 2 ? 900 : -900);
        const y = lerp(fy, lerp(ay, by, shuffle), land) + Math.cos(t * 0.7 + i) * 5;
        const r = lerp(fr, lerp(ar, br, shuffle), land);
        card.style.left = "0"; card.style.top = "0";
        card.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
        card.style.zIndex = String(card === logoTile ? 6 : i);
      });
      lines.forEach((n, i) => {
        const x = ease.outExpo(seg(t, 0.9 + i * 0.15, 1.7 + i * 0.15));
        n.style.transform = `translateY(${(1 - x) * 50}px)`;
        n.style.opacity = x * (1 - leave);
      });
    },
  };
};
