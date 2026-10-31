/* POSTER — kinetic typography. Each word of the headline slams in alone, filling the frame, on a
   hard cut between the brand colour, black and white. Then the whole headline locks up as a
   stacked poster (solid and outline lines), the logo rolls in and a band of the accent words
   scrolls along the bottom. */
BANNER.templates.poster = (stage, d, B) => {
  const { el, css, seg, lerp, ease, fitLines, logoNode, brandColors } = B;
  const brand = d.brands[0];
  const c = brandColors(brand, "#ff2e4d");
  const pop = c.dark ? "#ff2e4d" : c.base;
  const cards = [[pop, B.onColor(pop)], ["#0a0a0a", "#ffffff"], ["#ffffff", "#0a0a0a"]];
  const root = css(el("div", "layer", stage), { background: "#0a0a0a" });

  const words = d.headline.join(" ").split(/\s+/).filter(Boolean);
  const per = Math.max(0.3, Math.min(0.6, 3.0 / words.length));
  const flash = words.map((w, i) => {
    const [bg, ink] = cards[i % 3];
    const card = css(el("div", "layer", root), { background: bg, display: "grid", placeItems: "center", visibility: "hidden" });
    const n = css(el("div", "line", card), { font: "400 300px/0.9 Anton", color: ink, textTransform: "uppercase", letterSpacing: "0.005em" });
    n.textContent = w;
    fitLines([n], 920, 520, 520, 80, 0.9);
    return { card, n, start: 0.1 + i * per };
  });
  const flashEnd = 0.1 + words.length * per;

  // Lock-up.
  const [bg2, ink2] = c.dark ? ["#f1efe9", "#0a0a0a"] : [pop, B.onColor(pop)];
  const lock = css(el("div", "layer", root), { background: bg2, visibility: "hidden" });
  const stack = css(el("div", "abs", lock), { left: "56px", top: "0", bottom: "110px", width: "700px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const lines = d.headline.map((text, i) => {
    const n = css(el("div", "line", stack), { font: "400 80px/0.92 Anton", color: ink2, textTransform: "uppercase" });
    if (i !== d.accent && d.headline.length > 1 && i % 2 === 1) css(n, { color: "transparent", WebkitTextStroke: `0.045em ${ink2}` });
    n.textContent = text;
    return n;
  });
  B.fitEach(lines, 700, 420, 190, 40, 0.94);
  const logo = css(logoNode(brand, ink2, lock), { position: "absolute", right: "70px", top: "120px", width: "200px", height: "200px" });
  const band = css(el("div", "abs", lock), { left: 0, right: 0, bottom: 0, height: "96px", background: "#0a0a0a", overflow: "hidden" });
  const strip = css(el("div", "abs", band), { left: 0, top: "12px", whiteSpace: "nowrap", font: "400 70px/1 Anton", color: c.dark ? "#ffffff" : pop, textTransform: "uppercase" });
  const accentText = d.headline[d.accent] || d.headline[d.headline.length - 1];
  strip.textContent = Array(8).fill(accentText).join("  ✦  ");

  return {
    poster: Math.min(7, flashEnd + 1.2),
    frame(t) {
      flash.forEach(({ card, n, start }, i) => {
        const on = t >= start && (i === flash.length - 1 ? t < flashEnd : t < flash[i + 1].start);
        card.style.visibility = on ? "visible" : "hidden";
        if (on) { const x = seg(t, start, start + per); n.style.transform = `scale(${lerp(1.07, 1, ease.outExpo(x))})`; }
      });
      const show = t >= flashEnd;
      lock.style.visibility = show ? "visible" : "hidden";
      lines.forEach((n, i) => {
        const x = ease.outExpo(seg(t, flashEnd + i * 0.1, flashEnd + 0.7 + i * 0.1));
        n.style.transform = `translateY(${(1 - x) * 120}px) scaleY(${lerp(1.6, 1, x)})`;
        n.style.transformOrigin = "bottom left";
      });
      const lp = ease.outBack(seg(t, flashEnd + 0.3, flashEnd + 1.0));
      logo.style.transform = `translateX(${(1 - Math.min(1, lp)) * 300}px) rotate(${(1 - Math.min(1, lp)) * 220 + Math.sin(t * 1.2) * 4}deg) scale(${Math.max(0, lp)})`;
      band.style.transform = `translateY(${(1 - ease.outExpo(seg(t, flashEnd + 0.2, flashEnd + 0.9))) * 100}%)`;
      strip.style.transform = `translateX(${-((t - flashEnd) * 120)}px)`;
      root.style.transform = `scale(${1 + ease.inCubic(seg(t, 7.6, 8)) * 0.04})`;
    },
  };
};
