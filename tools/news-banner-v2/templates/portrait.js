/* PORTRAIT — the person behind the story (a licensed photo) in a tall duotone panel tinted with
   the brand colour, a slow push-in, the headline set large beside it, a logo badge on the photo.
   Beat two swaps sides. Without a person, the panel shows the logo instead. */
BANNER.templates.portrait = (stage, d, B) => {
  const { el, css, seg, lerp, ease, fitLines, logoNode, brandColors, mix } = B;
  const drawn = !d.person && (d.cutouts || []).find((x) => x.role === "hero");
  if (!d.person && !drawn) return BANNER.templates.brand(stage, d, B);
  const brand = d.brands[0];
  const c = brandColors(brand, "#ff6a3d");
  const tint = c.dark ? "#3a3a3a" : c.base;
  const root = css(el("div", "layer", stage), { background: mix(tint, "#050505", 0.82) });
  const panel = css(el("div", "abs", root), { top: "40px", width: "430px", height: "528px", borderRadius: "22px", overflow: "hidden", background: tint });
  let photo;
  if (d.person) {
    photo = el("img", "cover", panel);
    photo.src = d.person.image;
    css(photo, { filter: "grayscale(1) contrast(1.15) brightness(1.05)", mixBlendMode: "multiply", transformOrigin: "50% 35%" });
    css(el("div", "layer", panel), { background: `linear-gradient(180deg, transparent 55%, ${mix(tint, "#000", 0.5)})` });
  } else {
    // An illustrated hero (no photo): full colour, standing in the panel.
    css(el("div", "layer", panel), { background: `radial-gradient(circle at 50% 40%, ${mix(tint, "#ffffff", 0.35)}, ${tint} 70%)` });
    photo = el("img", "abs", panel);
    photo.src = drawn.image;
    css(photo, { left: "20px", right: "20px", bottom: "0", width: "390px", height: "500px", objectFit: "contain", objectPosition: "50% 100%", transformOrigin: "50% 100%", filter: "drop-shadow(0 16px 20px rgba(0,0,0,.3))" });
  }
  const badge = css(el("div", "abs", panel), { right: "22px", bottom: "22px", width: "96px", height: "96px", borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,.35)" });
  css(logoNode(brand, c.dark ? "#111" : c.base, badge), { width: "56px", height: "56px" });

  const text = css(el("div", "abs", root), { top: "0", bottom: "0", width: "520px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const lines = d.headline.map((t, i) => { const n = css(el("div", "line", text), { font: "800 80px/0.94 Bricolage", fontStretch: "80%", letterSpacing: "-0.025em", color: i === d.accent ? (c.dark ? "#fff" : c.base) : "#fff", textTransform: "uppercase" }); n.textContent = t; return n; });
  B.fitEach(lines, 490, 460, 150, 34, 0.96);
  if (!c.dark && B.luminance(c.base) < 0.06) lines.forEach((n, i) => { if (i === d.accent) n.style.color = mix(c.base, "#ffffff", 0.45); });

  return {
    poster: 1.8,
    frame(t) {
      const swap = ease.inOut(seg(t, 4.3, 5.1));
      const panelX = lerp(590, 60, swap), textX = lerp(60, 520, swap);
      const enter = ease.outExpo(seg(t, 0, 0.9));
      panel.style.left = panelX + "px";
      panel.style.transform = `translateY(${(1 - enter) * 620}px)`;
      if (photo) photo.style.transform = `scale(${lerp(1.04, 1.16, seg(t, 0, 8))})`;
      badge.style.transform = `scale(${Math.max(0, ease.outBack(seg(t, 1.0, 1.5)))})`;
      text.style.left = textX + "px";
      lines.forEach((n, i) => {
        const x = ease.outExpo(seg(t, 0.4 + i * 0.13, 1.3 + i * 0.13));
        const re = ease.outExpo(seg(t, 4.6 + i * 0.1, 5.4 + i * 0.1));
        const vis = t < 4.3 ? x : re;
        n.style.clipPath = `inset(0 ${(1 - vis) * 100}% 0 0)`;
      });
    },
  };
};
