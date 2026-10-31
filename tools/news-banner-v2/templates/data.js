/* DATA — the number is the story. White graph paper, the figure counts up huge in the brand
   colour while a chart line draws behind it (rising or falling with the story's mood). Beat two
   hands the frame to the headline and parks the number in a solid chip. */
BANNER.templates.data = (stage, d, B) => {
  const { el, css, seg, lerp, ease, fitLines, logoNode, brandColors, parseStat, formatStat, rng } = B;
  if (!d.stat) return BANNER.templates.poster(stage, d, B);
  const brand = d.brands[0];
  const c = brandColors(brand, "#0a7cff");
  const color = c.dark ? "#0a0a0a" : c.base;
  const rand = rng(d.seed * 31337);
  const down = d.mood === "down";
  const root = css(el("div", "layer", stage), { background: "#ffffff", backgroundImage: "linear-gradient(#e9e9e9 1px, transparent 1px), linear-gradient(90deg, #e9e9e9 1px, transparent 1px)", backgroundSize: "54px 54px", backgroundPosition: "-1px -1px" });

  // Chart line across the frame; up or down with the mood.
  const pts = Array.from({ length: 11 }, (_, i) => {
    const x = i * 108;
    const trend = down ? lerp(150, 470, i / 10) : lerp(470, 140, i / 10);
    return [x, trend + (rand() - 0.5) * 90];
  });
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y.toFixed(1)}`).join(" ");
  const chart = css(el("div", "layer", root), {});
  chart.innerHTML = `<svg width="1080" height="608" viewBox="0 0 1080 608"><path d="${path} L1080,608 L0,608 Z" fill="${color}" fill-opacity="0"/><path d="${path}" fill="none" stroke="${color}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`;
  const line = chart.querySelectorAll("path")[1], area = chart.querySelectorAll("path")[0];
  const dot = css(el("div", "abs", root), { width: "26px", height: "26px", marginLeft: "-13px", marginTop: "-13px", borderRadius: "50%", background: color, boxShadow: `0 0 0 8px ${color}33` });

  const parsed = parseStat(d.stat.value);
  const big = css(el("div", "abs", root), { left: "56px", top: "40px", font: "700 300px/0.82 'Space Grotesk'", letterSpacing: "-0.06em", color: "#0a0a0a", whiteSpace: "nowrap" });
  big.textContent = d.stat.value;
  fitLines([big], 900, 330, 330, 120, 0.82);
  const label = css(el("div", "abs", root), { left: "62px", font: "700 38px/1 'Space Grotesk'", letterSpacing: "-0.01em", color, textTransform: "uppercase", whiteSpace: "nowrap" });
  label.textContent = d.stat.label;
  const bigSize = parseFloat(big.style.fontSize);
  label.style.top = 40 + bigSize * 0.86 + 14 + "px";

  const logo = css(logoNode(brand, color, root), { position: "absolute", right: "56px", top: "48px", width: "96px", height: "96px" });

  // Beat two: headline takes over, number parks in a chip.
  const head = css(el("div", "abs", root), { left: "56px", right: "56px", bottom: "56px", display: "flex", flexDirection: "column" });
  const lines = d.headline.map((text, i) => { const n = css(el("div", "line", head), { font: "900 80px/0.9 Archivo", fontStretch: "72%", color: i === d.accent ? color : "#0a0a0a", textTransform: "uppercase" }); n.textContent = text; return n; });
  fitLines(lines, 968, 330, 160, 40, 0.92);
  const chip = css(el("div", "abs", root), { left: "56px", top: "56px", padding: "10px 22px 12px", borderRadius: "999px", background: color, color: c.dark ? "#fff" : c.ink, font: "700 64px/1 'Space Grotesk'", letterSpacing: "-0.04em", whiteSpace: "nowrap" });
  chip.textContent = d.stat.value;

  return {
    poster: 2.4,
    frame(t) {
      const draw = ease.inOut(seg(t, 0.2, 2.6));
      line.setAttribute("stroke-dashoffset", String(1 - draw));
      area.setAttribute("fill-opacity", String(0.09 * draw));
      const k = draw * 10, i = Math.min(9, Math.floor(k)), f = k - i;
      dot.style.left = lerp(pts[i][0], pts[i + 1][0], f) + "px";
      dot.style.top = lerp(pts[i][1], pts[i + 1][1], f) + "px";
      dot.style.opacity = seg(t, 0.2, 0.4);
      const count = ease.outExpo(seg(t, 0.3, 2.2));
      big.textContent = parsed ? formatStat(parsed, count) : d.stat.value;
      const hand = ease.inOut(seg(t, 4.0, 4.7));
      big.style.transform = `translateY(${(1 - ease.outExpo(seg(t, 0.1, 0.9))) * 60 - hand * 420}px)`;
      big.style.opacity = 1 - hand;
      label.style.opacity = seg(t, 1.2, 1.8) * (1 - hand);
      label.style.transform = `translateX(${(1 - ease.outExpo(seg(t, 1.2, 2.0))) * -30}px)`;
      chart.style.transform = `translateY(${hand * 60}px)`;
      chart.style.opacity = 1 - hand * 0.55;
      logo.style.transform = `scale(${Math.max(0, ease.outBack(seg(t, 0.8, 1.3)))}) rotate(${Math.sin(t * 1.5) * 4}deg)`;
      lines.forEach((n, j) => { const x = ease.outExpo(seg(t, 4.4 + j * 0.12, 5.2 + j * 0.12)); n.style.transform = `translateY(${(1 - x) * 70}px)`; n.style.opacity = x * (1 - seg(t, 7.5, 7.95)); });
      const cp = ease.outBack(seg(t, 4.6, 5.2));
      chip.style.transform = `scale(${Math.max(0, cp)})`;
      chip.style.opacity = 1 - seg(t, 7.5, 7.95);
    },
  };
};
