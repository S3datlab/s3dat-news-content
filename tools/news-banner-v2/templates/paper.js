/* PAPER — white editorial. Rules draw in, the headline rises line by line out of masks in a
   condensed black face, the logo pops inside a drawn circle, a highlighter sweeps the accent line.
   Beat two: a brand-colour panel wipes across and the composition inverts. */
BANNER.templates.paper = (stage, d, B) => {
  const { el, css, seg, lerp, ease, fitLines, logoNode, brandColors } = B;
  const brand = d.brands[0];
  const c = brandColors(brand, "#ff3b1f");
  const root = css(el("div", "layer", stage), { background: "#f5f3ee" });
  const rules = [0, 1].map((i) => css(el("div", "abs", root), { left: "60px", right: "60px", height: "2px", top: i ? "548px" : "60px", background: "#111", transformOrigin: "left" }));

  const block = css(el("div", "abs", root), { left: "60px", top: "92px", width: "640px", zIndex: 0 });
  const lines = d.headline.map((text, i) => {
    const mask = el("div", "mask", block);
    const line = css(el("span", "line", mask), { font: "900 80px/0.9 Archivo", fontStretch: "68%", letterSpacing: "-0.01em", color: i === d.accent ? c.vivid : "#0e0e0e", textTransform: "uppercase", position: "relative" });
    line.textContent = text;
    return { mask, line };
  });
  const size = fitLines(lines.map((l) => l.line), 620, 400, 170, 40, 0.92);
  lines.forEach(({ mask }) => css(mask, { height: size * 0.96 + "px" }));
  block.style.top = Math.round((608 - lines.length * size * 0.96) / 2) + "px";
  const accent = lines[d.accent] || lines[lines.length - 1];
  const hl = css(el("div", "abs", accent.mask), { left: "-6px", right: "-6px", bottom: size * 0.08 + "px", height: size * 0.34 + "px", background: c.vivid, opacity: 0.18, transformOrigin: "left" });
  accent.mask.style.position = "relative";
  accent.line.style.zIndex = 1;

  const ring = css(el("div", "abs", root), { left: "730px", top: "149px", width: "310px", height: "310px" });
  ring.innerHTML = `<svg viewBox="0 0 100 100" width="310" height="310"><circle cx="50" cy="50" r="48" fill="none" stroke="#111" stroke-width="0.8" stroke-dasharray="302" stroke-dashoffset="302"/></svg>`;
  const circle = ring.querySelector("circle");
  const logo = css(logoNode(brand, c.base, root), { position: "absolute", left: "795px", top: "214px", width: "180px", height: "180px" });

  const panel = css(el("div", "abs", root), { inset: "0", background: c.vivid, transform: "translateX(100%)" });
  const inv = css(el("div", "abs", panel), { left: "60px", right: "60px", top: "0", bottom: "0", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: "6px" });
  const invLogo = css(logoNode(brand, c.ink, inv), { width: "86px", height: "86px", marginBottom: "22px" });
  const invLines = d.headline.map((text) => { const n = css(el("span", "line", inv), { font: "900 80px/0.9 Archivo", fontStretch: "100%", color: c.ink, textTransform: "uppercase" }); n.textContent = text; return n; });
  fitLines(invLines, 960, 330, 130, 36, 0.95);

  return {
    poster: 1.9,
    frame(t) {
      rules.forEach((r, i) => (r.style.transform = `scaleX(${ease.outExpo(seg(t, 0.05 + i * 0.1, 0.8 + i * 0.1))})`));
      lines.forEach(({ line }, i) => {
        const x = ease.outExpo(seg(t, 0.25 + i * 0.13, 1.15 + i * 0.13));
        line.style.transform = `translateY(${(1 - x) * 105}%)`;
      });
      hl.style.transform = `scaleX(${ease.inOut(seg(t, 1.6, 2.4))})`;
      circle.setAttribute("stroke-dashoffset", String(302 * (1 - ease.outCubic(seg(t, 0.7, 1.7)))));
      const pop = ease.outBack(seg(t, 0.9, 1.5));
      logo.style.transform = `scale(${Math.max(0, pop)}) rotate(${(1 - Math.min(1, pop)) * -40 + Math.sin(t * 1.3) * 3}deg)`;
      const wipe = ease.inOut(seg(t, 4.2, 4.9)) - ease.inOut(seg(t, 7.35, 7.95));
      panel.style.transform = `translateX(${(1 - wipe) * 100}%)`;
      invLines.forEach((n, i) => { const x = ease.outExpo(seg(t, 4.6 + i * 0.1, 5.4 + i * 0.1)); n.style.transform = `translateX(${(1 - x) * 60}px)`; n.style.opacity = x; });
      invLogo.style.transform = `scale(${Math.max(0, ease.outBack(seg(t, 4.8, 5.4)))})`;
    },
  };
};
