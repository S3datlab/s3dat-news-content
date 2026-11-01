/* PAPER — white editorial page. Rules draw in, the headline arrives in a condensed black face, a
 * highlighter sweeps the news line and the logo draws itself inside a hand-drawn ring. Then the
 * ring becomes an iris: the brand colour opens from it (a match cut) onto an inverted composition.
 * The iris closes back into the ring, the ring signs off, and the page is empty again for the loop. */
BANNER.templates.paper = (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, beat, brandColors, onColor, pick, wide } = B;
  const W = B.W, H = B.H, isWide = wide();
  const brand = d.brands[0];
  const c = brandColors(brand, "#ff3b1f");
  const paper = "#f4f1ea";
  stage.style.background = paper;
  const cam = B.camera(stage, { push: 0.035, drift: 8, sway: 0.25 });
  const back = cam.layer(0.3), mid = cam.layer(0.65), front = cam.layer(1);
  const amb = B.ambient(back, { bg: paper, ink: "#0e0e0e", accent: c.vivid, text: d.headline.join(" "), y: H * 0.86, size: isWide ? 200 : 280, shapes: 10, seed: d.seed });

  const M = pick(60, 70);
  const rules = [0, 1].map((i) => css(el("div", "abs", back), { left: M + "px", right: M + "px", height: "2px", top: (i ? H - M : M) + "px", background: "#111", transformOrigin: i ? "right" : "left" }));

  // Headline.
  const box = isWide ? { x: 60, w: 620, h: 420 } : { x: 70, w: 940, h: 640 };
  const block = css(el("div", "abs", mid), { left: box.x + "px", width: box.w + "px", zIndex: 0 });
  const lines = d.headline.map((text, i) => B.line(block, text, { font: "900 80px/0.92 Archivo", fontStretch: "68%", letterSpacing: "-0.01em", color: i === d.accent ? c.vivid : "#0e0e0e", textTransform: "uppercase", position: "relative", display: "block" }));
  const size = B.fitLines(lines, box.w, box.h, isWide ? 170 : 230, 40, 0.94);
  const blockH = lines.length * size * 0.94;
  block.style.top = (isWide ? (H - blockH) / 2 : 150) + "px";
  const accent = lines[d.accent] || lines[lines.length - 1];
  const hl = css(el("div", "abs", block), { left: "-8px", height: size * 0.34 + "px", top: (d.accent + 0.55) * size * 0.94 + "px", width: accent.getBoundingClientRect().width + 16 + "px", background: c.vivid, opacity: 0.2, transformOrigin: "left", zIndex: -1 });
  const kindA = B.choose(d.seed, ["rise", "skew", "weight", "outline"]);
  const swap = beat(7.5), back2 = beat(13);
  const animA = B.animate(lines, kindA, { start: 0.5, out: [swap + 0.15, swap + 0.4], seed: d.seed, color: "#0e0e0e" });

  // Ring + logo.
  const R = pick(155, 190);
  const cx = isWide ? W - 60 - R - 30 : W / 2, cy = isWide ? H / 2 : H - 70 - R - 60;
  const ring = css(el("div", "abs", front), { left: cx - R + "px", top: cy - R + "px", width: 2 * R + "px", height: 2 * R + "px" });
  ring.innerHTML = `<svg viewBox="0 0 100 100" width="${2 * R}" height="${2 * R}" style="overflow:visible"><circle cx="50" cy="50" r="48" fill="none" stroke="#111" stroke-width="0.8" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(-90 50 50)"/></svg>`;
  const circle = ring.querySelector("circle");
  const mark = css(B.logo(brand, c.base, front, 1.0, 1.1), { position: "absolute", left: cx - R * 0.58 + "px", top: cy - R * 0.58 + "px", width: R * 1.16 + "px", height: R * 1.16 + "px" });
  B.cue("draw", 0.8, 0.5);

  // Inverted composition inside the iris.
  const iris = B.iris(front, c.vivid, cx, cy);
  const inv = css(el("div", "layer", iris.node), {});
  const invLogo = css(B.logo(brand, c.ink, inv, swap + 0.55, 0.9), isWide
    ? { position: "absolute", left: "70px", top: H / 2 - 100 + "px", width: "200px", height: "200px" }
    : { position: "absolute", left: W / 2 - 120 + "px", top: "200px", width: "240px", height: "240px" });
  const invBox = css(el("div", "abs", inv), isWide ? { left: "320px", top: "0", bottom: "0", width: "700px", display: "flex", flexDirection: "column", justifyContent: "center" } : { left: "70px", right: "70px", top: "520px", bottom: "120px", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center" });
  const invLines = d.headline.map((text) => B.line(invBox, text, { font: "900 80px/0.92 Archivo", fontStretch: "100%", color: c.ink, textTransform: "uppercase" }));
  B.fitEach(invLines, isWide ? 690 : 940, isWide ? 420 : 640, isWide ? 140 : 190, 30, 0.95);
  const animB = B.animate(invLines, B.choose(d.seed + 2, ["drop", "track", "skew"]), { start: swap + 0.65, out: [back2 - 0.45, back2 - 0.1], seed: d.seed + 5 });
  B.cue("riser", swap - 1.0, 0.5);
  B.cue("whoosh", swap, 0.9);
  B.cue("whoosh", back2, 0.7);

  const holdA = B.hold(block, 1.6, swap + 0.1);
  return {
    poster: 2.4,
    frame(t) {
      cam.update(t);
      amb(t);
      holdA(t);
      const outro = ease.inCubic(seg(t, 7.3, 7.85));
      rules.forEach((r, i) => (r.style.transform = `scaleX(${Math.max(0, Math.min(1.02, sp(t, 0.05 + i * 0.12, "snap"))) * (1 - outro)})`));
      animA(t);
      block.style.visibility = t < swap + 0.6 ? "visible" : "hidden";
      hl.style.transform = `scaleX(${ease.inOut(seg(t, 1.7, 2.3)) * (1 - ease.inCubic(seg(t, swap + 0.1, swap + 0.4)))})`;
      // Ring: draws, anticipates (squeezes) before the iris, then undraws for the sign-off.
      const drawRing = ease.inOut(seg(t, 0.8, 1.9)) * (1 - ease.inOut(seg(t, 7.25, 7.8)));
      circle.setAttribute("stroke-dashoffset", String(1 - drawRing));
      const squeeze = 1 - 0.06 * Math.sin(Math.PI * seg(t, swap - 0.35, swap + 0.05));
      ring.style.transform = `scale(${squeeze}) rotate(${t * 12}deg)`;
      mark.draw(t);
      mark.style.transform = `scale(${squeeze * (1 - outro)}) rotate(${Math.sin(t * 1.3) * 3}deg)`;
      iris.update(t, swap, swap + 0.6, back2, back2 + 0.6, 0);
      invLogo.draw(t);
      animB(t);
    },
  };
};
