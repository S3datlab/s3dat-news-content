/* INK — pure black signal. The frame powers on like a CRT, the headline decodes out of noise, the
 * logo draws itself in a glowing stroke. A slice glitch cuts to a centred composition with the
 * logo turning in 3D behind the headline. At the end the picture collapses into a line and a dot,
 * back to black, so the loop starts where it ended. */
BANNER.templates.ink = (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, beat, brandColors, rng, pick, wide } = B;
  const W = B.W, H = B.H, isWide = wide();
  const brand = d.brands[0];
  const c = brandColors(brand, "#7cf5ff");
  const rand = rng(d.seed * 7919);
  stage.style.background = "#030304";
  const tube = css(el("div", "layer", stage), { transformOrigin: "50% 50%" });
  const cam = B.camera(tube, { push: 0.05, drift: 9, sway: 0.35 });
  const back = cam.layer(0.25), mid = cam.layer(0.7);
  const amb = B.ambient(back, { bg: "#030304", ink: "#ffffff", accent: c.vivid, text: d.headline.join(" "), y: H * 0.84, size: isWide ? 220 : 300, seed: d.seed });

  const glow = css(el("div", "abs", back), { width: pick(620, 820) + "px", height: pick(620, 820) + "px", borderRadius: "50%", background: `radial-gradient(closest-side, ${B.alpha(c.vivid, 0.38)}, transparent)` });
  css(el("div", "layer", tube), { backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px)", pointerEvents: "none" });
  const scan = css(el("div", "abs", tube), { left: 0, right: 0, height: "140px", background: "linear-gradient(180deg, transparent, rgba(255,255,255,.06), transparent)" });

  // Layout A.
  const aBox = isWide ? { x: 64, y: 0, w: 600, h: H } : { x: 70, y: 560, w: 940, h: 640 };
  const a = css(el("div", "abs", mid), { left: aBox.x + "px", top: aBox.y + "px", width: aBox.w + "px", height: aBox.h + "px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const aLines = d.headline.map((text, i) => B.line(a, text, { font: "800 80px/0.98 Bricolage", fontStretch: "85%", letterSpacing: "-0.02em", color: i === d.accent ? c.vivid : "#f4f4f4", textTransform: "uppercase", display: "block" }));
  B.fitLines(aLines, aBox.w, aBox.h - 80, isWide ? 160 : 210, 40, 1.0);
  const under = B.underline(aLines[d.accent] || aLines[aLines.length - 1], c.vivid, 1.7, 0.07);
  const kindA = B.choose(d.seed, ["decode", "drop", "decode"]);
  const cut = beat(7);
  const animA = B.animate(aLines, kindA, { start: 0.45, out: null, seed: d.seed, color: c.vivid });
  const LS = pick(250, 320);
  const lx = isWide ? W - 110 - LS : W / 2 - LS / 2, ly = isWide ? H / 2 - LS / 2 : 170;
  const logoA = css(B.logo(brand, "#ffffff", mid, 0.9, 1.2), { position: "absolute", left: lx + "px", top: ly + "px", width: LS + "px", height: LS + "px" });
  css(glow, { left: lx + LS / 2 - pick(310, 410) + "px", top: ly + LS / 2 - pick(310, 410) + "px" });

  // Layout B: centred, a giant outline logo turning in 3D behind.
  const b = css(el("div", "layer", mid), { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "28px", perspective: "900px" });
  const ghost = css(B.logoNode(brand, "transparent", b), { position: "absolute", left: W / 2 - pick(300, 380) + "px", top: H / 2 - pick(300, 380) + "px", width: pick(600, 760) + "px", height: pick(600, 760) + "px", opacity: 0.22 });
  ghost.querySelectorAll("path,rect,circle,polygon,ellipse").forEach((p) => { p.setAttribute("fill", "none"); p.setAttribute("stroke", c.vivid); p.setAttribute("stroke-width", "0.18"); p.setAttribute("vector-effect", "non-scaling-stroke"); p.style.strokeWidth = "2px"; });
  const bLines = d.headline.map((text, i) => B.line(b, text, { font: "800 80px/1 Bricolage", fontStretch: "100%", color: i === d.accent ? c.vivid : "#ffffff", textTransform: "uppercase", textAlign: "center" }));
  B.fitLines(bLines, pick(940, 960), pick(320, 560), isWide ? 120 : 170, 34, 1.04);
  const animB = B.animate(bLines, "track", { start: cut + 0.35, out: [7.0, 7.35], seed: d.seed + 2 });
  const slices = Array.from({ length: 9 }, () => rand());
  B.cue("glitch", 0.02, 0.8);
  B.cue("glitch", cut - 0.15, 1);
  B.cue("swish", 7.4, 0.7);

  const holdA = B.hold(a, 1.5, cut);
  return {
    poster: 2.2,
    frame(t) {
      cam.update(t);
      amb(t);
      under(t);
      holdA(t);
      // CRT power on (0-0.3 s) and off (7.4-7.95 s).
      const on = ease.outExpo(seg(t, 0.0, 0.28));
      const offY = ease.inCubic(seg(t, 7.4, 7.7)), offX = ease.inCubic(seg(t, 7.65, 7.92));
      const sy = t < 1 ? Math.max(0.004, on) : Math.max(0.004, 1 - offY * 0.996);
      const sx = t < 1 ? 1 : Math.max(0.002, 1 - offX);
      tube.style.transform = `scale(${sx}, ${sy})`;
      tube.style.filter = `brightness(${t < 0.3 ? 1 + (1 - on) * 3 : 1 + offY * 2.5})`;
      tube.style.opacity = t > 7.9 ? 1 - seg(t, 7.9, 7.98) : 1;
      const toB = t >= cut + 0.12;
      const glitch = t > cut - 0.2 && t < cut + 0.15;
      a.style.visibility = toB ? "hidden" : "visible";
      logoA.style.visibility = toB ? "hidden" : "visible";
      b.style.visibility = toB ? "visible" : "hidden";
      const target = glitch ? (toB ? b : a) : null;
      for (const n of [a, b]) { n.style.clipPath = "none"; n.style.translate = "0px 0px"; }
      if (target) {
        const k = Math.floor(t * 60) % 9;
        target.style.clipPath = `polygon(${slices.map((v, i) => `0 ${i * 11 + v * 4}%, 100% ${i * 11 + v * 4}%`).join(",")}, 100% 100%, 0 100%)`;
        target.style.translate = `${(slices[k] - 0.5) * 70}px 0px`;
        target.style.textShadow = "6px 0 #ff2e63, -6px 0 #08d9d6";
      } else { a.style.textShadow = b.style.textShadow = "none"; }
      animA(t);
      animB(t);
      logoA.draw(t);
      logoA.style.filter = `drop-shadow(0 0 ${16 + Math.sin(t * 3) * 8}px ${c.vivid})`;
      logoA.style.transform = `scale(${1 + Math.sin(t * 1.6) * 0.015})`;
      ghost.style.transform = `rotateY(${(t - cut) * 38}deg) rotateX(${Math.sin(t) * 8}deg) scale(${lerp(1.15, 1, ease.outExpo(seg(t, cut, cut + 1)))})`;
      glow.style.opacity = 0.55 + Math.sin(t * 2.2) * 0.25;
      glow.style.translate = `${toB ? lerp(0, (W / 2 - (lx + LS / 2)), ease.inOut(seg(t, cut, cut + 0.8))) : 0}px 0px`;
      scan.style.transform = `translateY(${((t * 300) % (H + 280)) - 140}px)`;
    },
  };
};
