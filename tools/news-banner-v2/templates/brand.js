/* BRAND — the company's own colour fills the frame. A giant logo turns slowly behind an expanded,
   wide headline that slides in with a skew; black blocks wipe the frame to a negative version. */
BANNER.templates.brand = (stage, d, B) => {
  const { el, css, seg, lerp, ease, fitLines, logoNode, brandColors } = B;
  const brand = d.brands[0];
  const c = brandColors(brand, "#3d5afe");
  const bg = c.dark ? "#f2f0ea" : c.base;
  const ink = c.dark ? "#0b0b0b" : c.ink;
  const root = css(el("div", "layer", stage), { background: bg });
  const giant = css(logoNode(brand, ink, root), { position: "absolute", left: "540px", top: "-120px", width: "760px", height: "760px", opacity: 0.12 });

  const a = css(el("div", "abs", root), { left: "60px", top: "0", bottom: "0", width: "900px", display: "flex", flexDirection: "column", justifyContent: "center" });
  // The accent line is an outline of the ink colour: readable on any brand colour.
  const aLines = d.headline.map((text, i) => {
    const n = css(el("div", "line", a), { font: "900 80px/0.92 Archivo", fontStretch: "125%", letterSpacing: "-0.03em", color: ink, textTransform: "uppercase" });
    if (i === d.accent) css(n, { color: "transparent", WebkitTextStroke: `2.5px ${ink}` });
    n.textContent = text;
    return n;
  });
  fitLines(aLines, 900, 360, 130, 34, 0.94);
  const logoSmall = css(logoNode(brand, ink, root), { position: "absolute", left: "64px", top: "56px", width: "64px", height: "64px" });

  const block = css(el("div", "abs", root), { left: 0, top: 0, bottom: 0, width: "100%", background: "#0a0a0a", transform: "translateX(-100%)" });
  const neg = css(el("div", "abs", block), { inset: "0", display: "flex", alignItems: "center", gap: "48px", padding: "0 64px" });
  const negLogo = css(logoNode(brand, c.dark ? "#ffffff" : c.base, neg), { width: "190px", height: "190px", flex: "none" });
  const negText = css(el("div", "", neg), { display: "flex", flexDirection: "column" });
  const negLines = d.headline.map((text) => { const n = css(el("div", "line", negText), { font: "900 80px/0.92 Archivo", fontStretch: "110%", color: c.dark ? "#fff" : c.base, textTransform: "uppercase" }); n.textContent = text; return n; });
  fitLines(negLines, 700, 360, 130, 30, 0.95);

  return {
    poster: 1.6,
    frame(t) {
      giant.style.transform = `rotate(${t * 6}deg) scale(${lerp(1.25, 1, ease.outExpo(seg(t, 0, 1.6)))})`;
      aLines.forEach((n, i) => {
        const x = ease.outExpo(seg(t, 0.25 + i * 0.14, 1.1 + i * 0.14));
        n.style.transform = `translateX(${(1 - x) * -120}px) skewX(${(1 - x) * -18}deg)`;
        n.style.opacity = x;
      });
      logoSmall.style.transform = `scale(${Math.max(0, ease.outBack(seg(t, 0.9, 1.4)))})`;
      const w1 = ease.inOut(seg(t, 3.7, 4.3));
      const w2 = ease.inOut(seg(t, 7.3, 7.9));
      block.style.transform = `translateX(${(w1 - 1) * 100 + w2 * 100}%)`;
      negLines.forEach((n, i) => { const x = ease.outExpo(seg(t, 4.1 + i * 0.12, 4.9 + i * 0.12)); n.style.transform = `translateY(${(1 - x) * 40}px)`; n.style.opacity = x; });
      negLogo.style.transform = `rotate(${(1 - ease.outBack(seg(t, 4.0, 4.8))) * -90}deg) scale(${Math.max(0, ease.outBack(seg(t, 4.0, 4.8)))})`;
    },
  };
};
