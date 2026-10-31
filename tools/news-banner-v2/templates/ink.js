/* INK — pure black, signal style. Letters flicker on one by one with an RGB split that settles;
   the logo breathes in a glow of the brand colour; a scan bar sweeps; at 3.6 s a slice glitch
   cuts to a centred composition with the logo above the headline. */
BANNER.templates.ink = (stage, d, B) => {
  const { el, css, seg, lerp, ease, fitLines, logoNode, brandColors, rng } = B;
  const brand = d.brands[0];
  const c = brandColors(brand, "#7cf5ff");
  const rand = rng(d.seed * 7919);
  const root = css(el("div", "layer", stage), { background: "#030303" });
  const glow = css(el("div", "abs", root), { left: "560px", top: "40px", width: "560px", height: "560px", borderRadius: "50%", background: `radial-gradient(closest-side, ${c.vivid}55, transparent)` });
  const scan = css(el("div", "abs", root), { left: 0, right: 0, height: "120px", background: "linear-gradient(180deg, transparent, rgba(255,255,255,.07), transparent)" });

  // Layout A: headline left, logo right.
  const a = css(el("div", "abs", root), { left: "64px", top: "0", bottom: "0", width: "600px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const letters = [];
  const lineNodes = d.headline.map((text, i) => {
    const line = css(el("div", "line", a), { font: "800 80px/0.95 Bricolage", fontStretch: "85%", letterSpacing: "-0.02em", color: i === d.accent ? c.vivid : "#f4f4f4", textTransform: "uppercase" });
    [...text].forEach((ch) => {
      const s = el("span", "", line);
      s.textContent = ch;
      s.style.display = "inline-block";
      if (ch === " ") s.style.width = "0.28em";
      letters.push({ s, start: 0.15 + rand() * 0.95, flick: rand() });
    });
    return line;
  });
  fitLines(lineNodes, 600, 420, 160, 40, 0.98);
  const logoA = css(logoNode(brand, "#ffffff", root), { position: "absolute", left: "740px", top: "184px", width: "240px", height: "240px" });

  // Layout B: centred.
  const b = css(el("div", "abs", root), { inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "26px", opacity: 0 });
  const logoB = css(logoNode(brand, c.vivid, b), { width: "150px", height: "120px" });
  const bLines = d.headline.map((text, i) => { const n = css(el("div", "line", b), { font: "800 80px/0.95 Bricolage", fontStretch: "100%", color: "#fff", textTransform: "uppercase", textAlign: "center" }); n.textContent = text; return n; });
  fitLines(bLines, 940, 300, 120, 34, 1);

  const slices = Array.from({ length: 7 }, () => rand());
  return {
    poster: 2.0,
    frame(t) {
      const out = seg(t, 7.55, 7.95);
      letters.forEach(({ s, start, flick }) => {
        const k = t - start;
        let o = k < 0 ? 0 : k < 0.18 ? (Math.floor((k + flick) * 40) % 2 ? 1 : 0.15) : 1;
        s.style.opacity = o * (1 - out);
        const split = Math.max(0, 1 - seg(t, start, start + 0.6)) * 6;
        s.style.textShadow = split ? `${split}px 0 #ff2e63, ${-split}px 0 #08d9d6` : "none";
      });
      const toB = seg(t, 3.6, 3.95);
      const glitch = t > 3.45 && t < 3.95;
      a.style.opacity = 1 - toB;
      a.style.clipPath = glitch ? `polygon(${slices.map((v, i) => `0 ${i * 15}%, 100% ${i * 15}%`).join(",")}, 0 100%)` : "none";
      a.style.transform = glitch ? `translateX(${(slices[Math.floor(t * 60) % 7] - 0.5) * 50}px)` : "none";
      b.style.opacity = toB * (1 - out);
      b.style.transform = `scale(${lerp(1.08, 1, ease.outExpo(toB))})`;
      const pop = ease.outBack(seg(t, 0.8, 1.4));
      logoA.style.opacity = (1 - toB);
      logoA.style.transform = `scale(${Math.max(0, pop)})`;
      logoA.style.filter = `drop-shadow(0 0 ${18 + Math.sin(t * 3) * 10}px ${c.vivid})`;
      logoB.style.filter = `drop-shadow(0 0 ${14 + Math.sin(t * 3) * 8}px ${c.vivid})`;
      glow.style.opacity = 0.6 + Math.sin(t * 2.2) * 0.25;
      glow.style.transform = `translateX(${lerp(0, -280, ease.inOut(toB))}px)`;
      scan.style.transform = `translateY(${((t * 260) % 860) - 140}px)`;
    },
  };
};
