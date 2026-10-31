/* DATA — the number is the story. Graph paper drifts in parallax, the figure rolls in on odometer
 * digits, a chart line draws behind it (rising or falling with the mood) and a callout pops at its
 * tip. The camera then dives into the tip: it opens as an iris onto the headline in the brand
 * colour, and closes back to the empty graph paper for the loop. */
BANNER.templates.data = (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, beat, brandColors, onColor, rng, pick, wide } = B;
  if (!d.stat) return BANNER.templates.poster(stage, d, B);
  const W = B.W, H = B.H, isWide = wide();
  const brand = d.brands[0];
  const c = brandColors(brand, "#0a7cff");
  const color = c.dark ? "#0a0a0a" : c.base;
  const rand = rng(d.seed * 31337);
  const down = d.mood === "down";
  stage.style.background = "#ffffff";
  const cam = B.camera(stage, { push: 0.04, drift: 10, sway: 0.2 });
  const grid = cam.layer(0.3), mid = cam.layer(0.8);
  css(grid, { backgroundImage: "linear-gradient(#e7e7e7 1px, transparent 1px), linear-gradient(90deg, #e7e7e7 1px, transparent 1px)", backgroundSize: "54px 54px", inset: "-60px" });

  // Chart across the lower frame.
  const top = pick(250, 640), bottom = pick(575, 1100);
  const pts = Array.from({ length: 11 }, (_, i) => {
    const x = (i * W) / 10;
    const y = down ? lerp(top, bottom, i / 10) : lerp(bottom, top, i / 10);
    return [x, y + (rand() - 0.5) * pick(90, 140) * (i > 0 && i < 10 ? 1 : 0.3)];
  });
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const chart = el("div", "layer", mid);
  chart.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${path} L${W},${H} L0,${H} Z" fill="${color}" fill-opacity="0"/><path d="${path}" fill="none" stroke="${color}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`;
  const [area, lineEl] = chart.querySelectorAll("path");
  const tip = pts[10];
  const dot = css(el("div", "abs", mid), { width: "28px", height: "28px", marginLeft: "-14px", marginTop: "-14px", borderRadius: "50%", background: color, boxShadow: `0 0 0 9px ${B.alpha(color, 0.18)}` });

  // The number on odometer digits, the label under it, the logo.
  const numBox = css(el("div", "abs", mid), { left: pick(56, 70) + "px", top: pick(40, 120) + "px" });
  const odo = B.odometer(numBox, d.stat.value, { font: "700 300px 'Space Grotesk'", letterSpacing: "-0.06em", color: "#0a0a0a" }, 0.35);
  B.fitLines([odo.node], pick(880, 940), pick(320, 380), pick(330, 420), 120, 1.02);
  odo.lock();
  const label = B.line(numBox, d.stat.label, { font: `700 ${pick(36, 46)}px/1 'Space Grotesk'`, letterSpacing: "-0.01em", color, textTransform: "uppercase", display: "block", marginTop: "14px" });
  const animLabel = B.animate([label], "skew", { start: 1.15, out: null, seed: d.seed });
  const mark = css(B.logo(brand, color, mid, 0.7, 0.9), { position: "absolute", right: pick(56, 70) + "px", top: pick(46, 120) + "px", width: pick(96, 120) + "px", height: pick(96, 120) + "px" });
  const callout = css(el("div", "abs", mid), { padding: "8px 16px 10px", borderRadius: "999px", background: color, color: onColor(color), font: `700 ${pick(34, 44)}px/1 'Space Grotesk'`, letterSpacing: "-0.03em", whiteSpace: "nowrap" });
  callout.textContent = d.stat.value;
  const cw = callout.getBoundingClientRect().width;
  css(callout, { left: Math.min(W - cw - 24, tip[0] - cw - 26) + "px", top: tip[1] - pick(70, 84) + "px" });
  B.cue("draw", 0.3, 0.6);
  B.cue("pop", 2.55, 0.6);

  // Dive: the tip becomes an iris onto the headline.
  const dive = beat(7.6), back2 = beat(14.4);
  const iris = B.iris(mid, color, tip[0] - 14, tip[1]);
  const head = css(el("div", "abs", iris.node), isWide ? { left: "56px", right: "56px", top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" } : { left: "70px", right: "70px", top: "300px", bottom: "200px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const lines = d.headline.map((text, i) => B.line(head, text, { font: "900 80px/0.9 Archivo", fontStretch: "72%", color: onColor(color), textTransform: "uppercase", display: "block", opacity: i === d.accent ? 1 : 0.92 }));
  B.fitEach(lines, pick(968, 940), pick(420, 700), pick(170, 240), 40, 0.92);
  const chip = css(el("div", "abs", iris.node), { left: pick(56, 70) + "px", top: pick(50, 130) + "px", padding: "10px 22px 12px", borderRadius: "999px", background: onColor(color), color, font: `700 ${pick(56, 72)}px/1 'Space Grotesk'`, letterSpacing: "-0.04em", whiteSpace: "nowrap" });
  chip.textContent = d.stat.value;
  const animH = B.animate(lines, B.choose(d.seed, ["drop", "skew", "weight", "rise"]), { start: dive + 0.6, out: [back2 - 0.45, back2 - 0.1], seed: d.seed + 2 });
  B.cue("riser", dive - 1, 0.5);
  B.cue("whoosh", dive, 0.9);
  B.cue("whoosh", back2, 0.7);

  return {
    poster: 2.6,
    frame(t) {
      cam.update(t);
      const draw = ease.inOut(seg(t, 0.25, 2.5));
      lineEl.setAttribute("stroke-dashoffset", String(1 - draw));
      area.setAttribute("fill-opacity", String(0.09 * draw));
      const k = draw * 10, i = Math.min(9, Math.floor(k)), f = k - i;
      const pulse = 1 + 0.25 * Math.max(0, Math.sin(TAU_ * (t - 2.5) * 1.2)) * (t > 2.5 ? 1 : 0);
      css(dot, { left: lerp(pts[i][0], pts[i + 1][0], f) + "px", top: lerp(pts[i][1], pts[i + 1][1], f) + "px", opacity: seg(t, 0.25, 0.4), transform: `scale(${pulse * (1 + ease.inCubic(seg(t, dive - 0.3, dive)) * 1.5)})` });
      odo.update(t);
      numBox.style.transform = `translateY(${(1 - Math.min(1, sp(t, 0.15, "snap"))) * 60}px)`;
      animLabel(t);
      mark.draw(t);
      callout.style.transform = `scale(${Math.max(0, sp(t, 2.55, "pop"))})`;
      callout.style.transformOrigin = "100% 100%";
      const hidden = t >= dive + 0.55 && t < back2;
      for (const n of [chart, dot, numBox, mark, callout]) n.style.visibility = hidden || t >= back2 ? "hidden" : "visible";
      iris.update(t, dive, dive + 0.55, back2, back2 + 0.6, 0);
      animH(t);
      chip.style.transform = `scale(${Math.max(0, sp(t, dive + 0.8, "pop")) * (1 - ease.inCubic(seg(t, back2 - 0.4, back2)))})`;
    },
  };
};
const TAU_ = Math.PI * 2;
