/* VERSUS — a diagonal split in the two brands' colours. The halves slide in, the logos rush to
   the centre and collide (shake and flash), a VS sticker slams, the headline band rises. */
BANNER.templates.versus = (stage, d, B) => {
  const { el, css, seg, lerp, ease, fitLines, logoNode, brandColors, luminance } = B;
  const [b1, b2] = [d.brands[0], d.brands[1] || { name: "?", color: "#222" }];
  const c1 = brandColors(b1, "#2f6bff"), c2 = brandColors(b2, "#ff3d57");
  let col1 = c1.dark ? "#111111" : c1.base, col2 = c2.dark ? "#f2f0ea" : c2.base;
  if (Math.abs(luminance(col1) - luminance(col2)) < 0.03) col2 = "#f2f0ea";
  const ink1 = B.onColor(col1), ink2 = B.onColor(col2);
  const root = css(el("div", "layer", stage), { background: "#000" });
  const shake = css(el("div", "layer", root), {});
  const left = css(el("div", "abs", shake), { inset: "0", background: col1, clipPath: "polygon(0 0, 60% 0, 40% 100%, 0 100%)" });
  const right = css(el("div", "abs", shake), { inset: "0", background: col2, clipPath: "polygon(60% 0, 100% 0, 100% 100%, 40% 100%)" });
  const l1 = css(logoNode(b1, ink1, shake), { position: "absolute", left: "150px", top: "110px", width: "230px", height: "230px" });
  const l2 = css(logoNode(b2, ink2, shake), { position: "absolute", left: "700px", top: "110px", width: "230px", height: "230px" });
  const vs = css(el("div", "abs", shake), { left: "470px", top: "170px", width: "140px", height: "110px", display: "grid", placeItems: "center", font: "900 84px/1 Archivo", fontStretch: "125%", color: "#0b0b0b", background: "#f7ff3c", border: "5px solid #0b0b0b", borderRadius: "14px", boxShadow: "8px 8px 0 #0b0b0b" });
  vs.textContent = "VS";
  const flash = css(el("div", "layer", root), { background: "#fff", opacity: 0 });
  const band = css(el("div", "abs", root), { left: 0, right: 0, bottom: 0, height: "190px", background: "#0b0b0b", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 56px" });
  const lines = d.headline.map((text, i) => { const n = css(el("div", "line", band), { font: "400 80px/0.95 Anton", color: i === d.accent ? "#f7ff3c" : "#fff", textTransform: "uppercase", letterSpacing: "0.005em" }); n.textContent = text; return n; });
  fitLines(lines, 968, 160, 110, 30, 0.98);

  return {
    poster: 2.6,
    frame(t) {
      const slide = ease.outExpo(seg(t, 0, 0.7));
      left.style.transform = `translateX(${(1 - slide) * -100}%)`;
      right.style.transform = `translateX(${(1 - slide) * 100}%)`;
      // The logos rush together, collide at the centre, then bounce back to leave room for VS.
      const rush = ease.inCubic(seg(t, 0.6, 1.25)), back = ease.outBack(seg(t, 1.25, 1.9));
      const near = lerp(lerp(0, 150, rush), 20, back);
      l1.style.transform = `translateX(${(1 - slide) * -500 + near}px) rotate(${Math.sin(t * 2) * 3}deg)`;
      l2.style.transform = `translateX(${(1 - slide) * 500 - near}px) rotate(${Math.sin(t * 2 + 1) * -3}deg)`;
      const hit = seg(t, 1.25, 1.6);
      const amp = hit > 0 && hit < 1 ? (1 - hit) * 14 : 0;
      shake.style.transform = `translate(${Math.sin(t * 90) * amp}px, ${Math.cos(t * 77) * amp}px)`;
      flash.style.opacity = hit > 0 && hit < 1 ? (1 - hit) * 0.7 : 0;
      const pop = ease.outBack(seg(t, 1.3, 1.75), 2.4);
      vs.style.transform = `scale(${Math.max(0, pop) * (1 + Math.sin(t * 4) * 0.03)}) rotate(${lerp(-25, -6, Math.min(1, pop))}deg)`;
      const rise = ease.outExpo(seg(t, 2.0, 2.8)) - ease.inCubic(seg(t, 7.4, 7.95));
      band.style.transform = `translateY(${(1 - rise) * 100}%)`;
      lines.forEach((n, i) => { const x = ease.outExpo(seg(t, 2.2 + i * 0.12, 3 + i * 0.12)); n.style.transform = `translateX(${(1 - x) * 40}px)`; n.style.opacity = x; });
      const swing = Math.sin(seg(t, 4.5, 7.3) * Math.PI) * 30;
      left.style.clipPath = `polygon(0 0, ${60 + swing * 0.2}% 0, ${40 - swing * 0.2}% 100%, 0 100%)`;
      right.style.clipPath = `polygon(${60 + swing * 0.2}% 0, 100% 0, 100% 100%, ${40 - swing * 0.2}% 100%)`;
    },
  };
};
