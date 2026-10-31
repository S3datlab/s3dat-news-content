/* VERSUS — two brands, two colours, one collision. The halves slide in on a diagonal, both logos
 * draw themselves, rush together and hit: camera shake, a white flash, impact lines, a VS sticker
 * slamming on a spring. The headline band rises; the divider swings for a second clash; at the
 * end the halves leave in opposite directions, back to black for the loop. */
BANNER.templates.versus = (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, beat, brandColors, luminance, onColor, pick, wide } = B;
  const W = B.W, H = B.H, isWide = wide();
  const [b1, b2] = [d.brands[0], d.brands[1] || { name: "?", color: "#222222" }];
  const c1 = brandColors(b1, "#2f6bff"), c2 = brandColors(b2, "#ff3d57");
  let col1 = c1.dark ? "#111111" : c1.base, col2 = c2.dark ? "#f2f0ea" : c2.base;
  if (Math.abs(luminance(col1) - luminance(col2)) < 0.03) col2 = "#f2f0ea";
  const ink1 = onColor(col1), ink2 = onColor(col2);
  stage.style.background = "#000";
  const cam = B.camera(stage, { push: 0.03, drift: 8, sway: 0.3 });
  const field = cam.layer(0.4), mid = cam.layer(0.9);

  const bandH = pick(190, 300);
  const fieldH = H - (isWide ? 0 : bandH);
  // Diagonal split: vertical-ish on 16:9, horizontal-ish on 4:5.
  const half = (first) => css(el("div", "abs", field), { left: 0, top: 0, width: W + "px", height: fieldH + "px", background: first ? col1 : col2 });
  const h1 = half(true), h2 = half(false);
  const LS = pick(230, 300);
  const p1 = isWide ? [W * 0.27, H * 0.37] : [W / 2, fieldH * 0.25], p2 = isWide ? [W * 0.73, H * 0.37] : [W / 2, fieldH * 0.75];
  const center = isWide ? [W / 2, H * 0.37] : [W / 2, fieldH / 2];
  const l1 = css(B.logo(b1, ink1, mid, 0.25, 0.9), { position: "absolute", left: p1[0] - LS / 2 + "px", top: p1[1] - LS / 2 + "px", width: LS + "px", height: LS + "px" });
  const l2 = css(B.logo(b2, ink2, mid, 0.3, 0.9), { position: "absolute", left: p2[0] - LS / 2 + "px", top: p2[1] - LS / 2 + "px", width: LS + "px", height: LS + "px" });
  const hit = 1.25;
  cam.kick(hit, 16);
  const burst = B.burst(mid, center[0], center[1], "#f7ff3c", 12, pick(70, 90), pick(190, 240));
  const vs = css(el("div", "abs", mid), { left: center[0] - pick(72, 90) + "px", top: center[1] - pick(56, 70) + "px", width: pick(144, 180) + "px", height: pick(112, 140) + "px", display: "grid", placeItems: "center", font: `900 ${pick(84, 104)}px/1 Archivo`, fontStretch: "125%", color: "#0b0b0b", background: "#f7ff3c", border: "5px solid #0b0b0b", borderRadius: "14px", boxShadow: "8px 8px 0 #0b0b0b" });
  vs.textContent = "VS";
  const flash = css(el("div", "layer", stage), { background: "#fff", opacity: 0, pointerEvents: "none" });
  const band = css(el("div", "abs", mid), { left: "-40px", right: "-40px", bottom: "-40px", height: bandH + 40 + "px", background: "#0b0b0b", display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${56 + 40}px 40px` });
  const lines = d.headline.map((text, i) => B.line(band, text, { font: "400 80px/0.95 Anton", color: i === d.accent ? "#f7ff3c" : "#fff", textTransform: "uppercase", letterSpacing: "0.005em", display: "block" }));
  B.fitEach(lines, W - 112, bandH - 40, pick(110, 150), 30, 0.98);
  const animL = B.animate(lines, B.choose(d.seed, ["skew", "rise", "slam"]), { start: 2.1, out: [7.35, 7.7], seed: d.seed, camera: cam });
  const clash2 = beat(9);
  cam.kick(clash2 + 0.3, 6);
  B.cue("whoosh", 0.05, 0.8);
  B.cue("riser", 0.4, 0.4);
  B.cue("pop", hit + 0.08, 0.9);
  B.cue("whoosh", 7.35, 0.8);

  return {
    poster: 3.0,
    frame(t) {
      cam.update(t);
      const slide = Math.min(1.02, sp(t, 0, "snap"));
      const away = ease.inCubic(seg(t, 7.35, 7.9));
      const swing = Math.sin(seg(t, clash2, 7.3) * Math.PI) * 10;
      if (isWide) {
        h1.style.clipPath = `polygon(0 0, ${60 + swing}% 0, ${40 - swing}% 100%, 0 100%)`;
        h2.style.clipPath = `polygon(${60 + swing}% 0, 100% 0, 100% 100%, ${40 - swing}% 100%)`;
        h1.style.transform = `translateX(${((1 - slide) * -100) - away * 100}%)`;
        h2.style.transform = `translateX(${((1 - slide) * 100) + away * 100}%)`;
      } else {
        h1.style.clipPath = `polygon(0 0, 100% 0, 100% ${42 - swing}%, 0 ${58 + swing}%)`;
        h2.style.clipPath = `polygon(0 ${58 + swing}%, 100% ${42 - swing}%, 100% 100%, 0 100%)`;
        h1.style.transform = `translateY(${((1 - slide) * -100) - away * 100}%)`;
        h2.style.transform = `translateY(${((1 - slide) * 100) + away * 100}%)`;
      }
      // Rush together, collide, bounce back to their corners.
      const rush = ease.inCubic(seg(t, 0.65, hit)), back = Math.min(1.05, sp(t, hit, "wobble"));
      const near = lerp(lerp(0, 0.62, rush), 0.08, back) - (t > clash2 && t < clash2 + 0.6 ? Math.sin(seg(t, clash2, clash2 + 0.6) * Math.PI) * -0.12 : 0);
      const ax = (center[0] - p1[0]) * near, ay = (center[1] - p1[1]) * near;
      const bx = (center[0] - p2[0]) * near, by = (center[1] - p2[1]) * near;
      const enter = 1 - Math.min(1, slide);
      l1.style.transform = `translate(${ax - (isWide ? enter * 500 : 0) - (isWide ? away * 700 : 0)}px, ${ay - (isWide ? 0 : enter * 500 + away * 700)}px) rotate(${Math.sin(t * 2) * 3}deg)`;
      l2.style.transform = `translate(${bx + (isWide ? enter * 500 + away * 700 : 0)}px, ${by + (isWide ? 0 : enter * 500 + away * 700)}px) rotate(${Math.sin(t * 2 + 1) * -3}deg)`;
      l1.draw(t); l2.draw(t);
      const f = seg(t, hit, hit + 0.18);
      flash.style.opacity = f > 0 && f < 1 ? (1 - f) * 0.75 : 0;
      burst(t, hit);
      const pop = sp(t, hit + 0.05, "pop");
      vs.style.transform = `scale(${Math.max(0, pop) * (1 + Math.sin(t * 4) * 0.03) * (1 - away)}) rotate(${lerp(-25, -6, Math.min(1, pop))}deg)`;
      band.style.transform = `translateY(${(1 - Math.min(1, sp(t, 1.9, "snap")) + away) * 100}%)`;
      animL(t);
    },
  };
};
