/* BRAND — the company's own colour fills the frame. A giant logo turns behind a wide headline in
 * parallax; the small logo draws itself. Venetian bars sweep the frame to a negative version
 * where the big logo draws on black, then sweep back to the empty colour field for the loop. */
BANNER.templates.brand = (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, beat, brandColors, mix, pick, wide } = B;
  const W = B.W, H = B.H, isWide = wide();
  const brand = d.brands[0];
  const c = brandColors(brand, "#3d5afe");
  const bg = c.dark ? "#f2f0ea" : c.base;
  const ink = c.dark ? "#0b0b0b" : c.ink;
  stage.style.background = bg;
  const cam = B.camera(stage, { push: 0.05, drift: 12, sway: 0.4 });
  const back = cam.layer(0.25), mid = cam.layer(0.75);

  const GS = pick(780, 1100);
  const giant = css(B.logoNode(brand, ink, back), { position: "absolute", left: (isWide ? W - GS * 0.62 : W / 2 - GS / 2) + "px", top: (isWide ? -GS * 0.18 : H * 0.12) + "px", width: GS + "px", height: GS + "px", opacity: 0.08 });

  const aBox = isWide ? { x: 64, y: 0, w: 900, h: H } : { x: 70, y: 380, w: 940, h: 820 };
  const a = css(el("div", "abs", mid), { left: aBox.x + "px", top: aBox.y + "px", width: aBox.w + "px", height: aBox.h + "px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const aLines = d.headline.map((text, i) => {
    const n = B.line(a, text, { font: "900 80px/0.92 Archivo", fontStretch: "125%", letterSpacing: "-0.03em", color: ink, textTransform: "uppercase", display: "block" });
    if (i === d.accent) css(n, { color: "transparent", WebkitTextStroke: `0.045em ${ink}` });
    return n;
  });
  B.fitEach(aLines, aBox.w, aBox.h - 120, isWide ? 140 : 190, 34, 0.94);
  const swap = beat(7.5), back2 = beat(14.4);
  const animA = B.animate(aLines, B.choose(d.seed, ["slam", "weight", "skew"]), { start: 0.45, out: [swap + 0.2, swap + 0.4], seed: d.seed });
  const small = css(B.logo(brand, ink, mid, 0.25, 0.9), isWide ? { position: "absolute", left: "64px", top: "54px", width: "70px", height: "70px" } : { position: "absolute", left: W / 2 - 50 + "px", top: "150px", width: "100px", height: "100px" });

  // Negative.
  const neg = css(el("div", "layer", mid), { background: "#0a0a0a" });
  const negLogo = css(B.logo(brand, c.dark ? "#ffffff" : c.base, neg, swap + 0.45, 1.0), isWide
    ? { position: "absolute", left: "64px", top: H / 2 - 110 + "px", width: "220px", height: "220px" }
    : { position: "absolute", left: W / 2 - 140 + "px", top: "220px", width: "280px", height: "280px" });
  const negBox = css(el("div", "abs", neg), isWide ? { left: "330px", right: "56px", top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" } : { left: "70px", right: "70px", top: "580px", bottom: "120px", display: "flex", flexDirection: "column", alignItems: "center" });
  const negLines = d.headline.map((text) => B.line(negBox, text, { font: "900 80px/0.92 Archivo", fontStretch: "110%", color: c.dark ? "#fff" : c.base, textTransform: "uppercase" }));
  B.fitEach(negLines, isWide ? 690 : 940, isWide ? 420 : 620, isWide ? 150 : 190, 30, 0.95);
  const animB = B.animate(negLines, B.choose(d.seed + 1, ["drop", "rise", "decode"]), { start: swap + 0.55, out: null, seed: d.seed + 4, color: "#ffffff" });
  const tones = c.dark ? ["#0a0a0a", "#1a1a1a", "#2a2a2a"] : ["#0a0a0a", mix(c.base, "#000000", 0.55), mix(c.base, "#000000", 0.25)];
  const barsIn = B.bars(mid, tones, 7, true);
  const barsOut = B.bars(mid, [bg, mix(bg, "#000000", 0.08), mix(bg, "#ffffff", 0.15)], 7, true);
  B.cue("whoosh", swap - 0.1, 0.9);
  B.cue("whoosh", back2 - 0.1, 0.8);

  return {
    poster: 2.0,
    frame(t) {
      cam.update(t);
      giant.style.transform = `rotate(${t * 7}deg) scale(${lerp(1.25, 1, ease.outExpo(seg(t, 0, 1.8)))})`;
      animA(t);
      small.draw(t);
      const showNeg = t >= swap + 0.25 && t < back2 + 0.25;
      neg.style.visibility = showNeg ? "visible" : "hidden";
      a.style.visibility = small.style.visibility = t < swap + 0.25 ? "visible" : "hidden";
      barsIn.update(t, swap - 0.15, swap + 0.25, swap + 0.3, swap + 0.75);
      barsOut.update(t, back2 - 0.15, back2 + 0.25, back2 + 0.3, back2 + 0.75);
      negLogo.draw(t);
      negLogo.style.transform = `rotate(${(1 - Math.min(1, sp(t, swap + 0.45, "pop"))) * -30}deg)`;
      animB(t);
    },
  };
};
