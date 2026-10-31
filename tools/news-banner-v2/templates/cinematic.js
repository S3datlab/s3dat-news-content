/* CINEMATIC — one strong image, full bleed, treated like film: slow push and drift, a second
   shot cut from another region of the same image at 4.4 s. The headline arrives as stacked
   label strips; the logo sits on a solid chip. Cut-outs, when present, float on top in parallax. */
BANNER.templates.cinematic = (stage, d, B) => {
  const { el, css, seg, lerp, ease, fitLines, logoNode, brandColors } = B;
  if (!d.art) return BANNER.templates.brand(stage, d, B);
  const brand = d.brands[0];
  const c = brandColors(brand, "#ffd400");
  const tag = c.dark ? "#ffd400" : c.base;
  const root = css(el("div", "layer", stage), { background: "#000" });
  const shots = [0, 1].map(() => css(el("div", "layer", root), { backgroundImage: `url(${d.art})`, backgroundSize: "cover", backgroundRepeat: "no-repeat" }));
  css(el("div", "layer", root), { background: "linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,0) 62%)" });
  const grain = css(el("div", "layer", root), { opacity: 0.08, backgroundImage: "radial-gradient(#fff 0.6px, transparent 0.6px)", backgroundSize: "3px 3px", mixBlendMode: "overlay" });

  const props = (d.cutouts || []).slice(0, 2).map((cut, i) => {
    const img = B.sticker(cut, root, false);
    css(img, { width: i ? "220px" : "360px", height: i ? "220px" : "360px", right: i ? "330px" : "40px", bottom: i ? "300px" : "10px" });
    return img;
  });

  const stack = css(el("div", "abs", root), { left: "48px", bottom: "52px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px" });
  const strips = d.headline.map((text, i) => {
    const s = css(el("div", "", stack), { background: i === d.accent ? tag : "#ffffff", padding: "6px 18px 4px", overflow: "hidden" });
    const n = css(el("div", "line", s), { font: "800 80px/0.95 Bricolage", fontStretch: "78%", letterSpacing: "-0.02em", color: i === d.accent ? B.onColor(tag) : "#0a0a0a", textTransform: "uppercase" });
    n.textContent = text;
    return { s, n };
  });
  fitLines(strips.map((x) => x.n), 680, 330, 110, 34, 1.1);
  const chip = css(el("div", "abs", root), { left: "48px", top: "44px", width: "86px", height: "86px", borderRadius: "18px", background: "#ffffff", display: "grid", placeItems: "center" });
  css(logoNode(brand, c.dark ? "#0a0a0a" : c.base, chip), { width: "54px", height: "54px" });

  return {
    poster: 2.2,
    frame(t) {
      const cut = t >= 4.4;
      shots[0].style.visibility = cut ? "hidden" : "visible";
      shots[1].style.visibility = cut ? "visible" : "hidden";
      const a = seg(t, 0, 4.4), b = seg(t, 4.4, 8);
      shots[0].style.transform = `scale(${lerp(1.08, 1.2, a)}) translateX(${lerp(0, -24, a)}px)`;
      shots[0].style.backgroundPosition = "50% 50%";
      shots[1].style.transform = `scale(${lerp(1.7, 1.55, b)})`;
      shots[1].style.backgroundPosition = `${lerp(70, 64, b)}% ${lerp(35, 40, b)}%`;
      grain.style.transform = `translate(${(Math.floor(t * 24) % 3) - 1}px, ${(Math.floor(t * 24) % 2)}px)`;
      strips.forEach(({ s, n }, i) => {
        const x = ease.outExpo(seg(t, 0.5 + i * 0.16, 1.3 + i * 0.16));
        s.style.clipPath = `inset(0 ${(1 - x) * 100}% 0 0)`;
        n.style.transform = `translateX(${(1 - x) * -40}px)`;
        const re = cut ? ease.outBack(seg(t, 4.4 + i * 0.06, 4.9 + i * 0.06)) : 1;
        s.style.transform = cut ? `rotate(${lerp(-3, i % 2 ? 1.5 : -1.5, re)}deg)` : "none";
      });
      chip.style.transform = `scale(${Math.max(0, ease.outBack(seg(t, 1.0, 1.5)))})`;
      props.forEach((p, i) => {
        const x = ease.outBack(seg(t, 0.8 + i * 0.3, 1.5 + i * 0.3));
        p.style.transform = `translateY(${(1 - Math.min(1, x)) * 400 + Math.sin(t * 1.4 + i) * 10}px) rotate(${Math.sin(t + i) * 3}deg)`;
      });
      root.style.opacity = 1 - seg(t, 7.7, 8) * 0.6;
    },
  };
};
