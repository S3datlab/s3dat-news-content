/* PORTRAIT — the person behind the story in a tall panel tinted with the brand colour: an
 * illustrated hero acting the mood (or a licensed photo in duotone), a slow push inside the panel,
 * the headline set large beside it, the logo drawing itself on a badge. Halfway the panel glides
 * to the other side (a continuous move, no cut) and the headline re-sets; it drops out for the loop. */
BANNER.templates.portrait = (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, beat, brandColors, mix, luminance, pick, wide } = B;
  const drawn = !d.person && (d.cutouts || []).find((x) => x.role === "hero");
  if (!d.person && !drawn) return BANNER.templates.brand(stage, d, B);
  const W = B.W, H = B.H, isWide = wide();
  const brand = d.brands[0];
  const c = brandColors(brand, "#ff6a3d");
  const tint = c.dark ? "#3a3a3a" : c.base;
  const bg = mix(tint, "#050505", 0.84);
  stage.style.background = bg;
  const cam = B.camera(stage, { push: 0.04, drift: 9, sway: 0.25 });
  const back = cam.layer(0.3), mid = cam.layer(0.8);
  // Soft brand-tinted light behind everything.
  const halo = css(el("div", "abs", back), { width: pick(900, 1100) + "px", height: pick(900, 1100) + "px", borderRadius: "50%", background: `radial-gradient(closest-side, ${B.alpha(tint, 0.35)}, transparent)` });

  const PW = pick(430, 700), PH = pick(528, 760), PY = pick(40, 90);
  const panel = css(el("div", "abs", mid), { top: PY + "px", width: PW + "px", height: PH + "px", borderRadius: "24px", overflow: "hidden", background: tint });
  const stripes = css(el("div", "abs", panel), { inset: "-40%", backgroundImage: `repeating-linear-gradient(135deg, ${B.alpha("#ffffff", 0.06)} 0 18px, transparent 18px 44px)` });
  css(el("div", "layer", panel), { background: `radial-gradient(circle at 50% 38%, ${B.alpha(mix(tint, "#ffffff", 0.45), 0.85)}, transparent 70%)` });
  let actor = null, photo = null;
  if (d.person) {
    photo = el("img", "cover", panel);
    photo.src = d.person.image;
    css(photo, { filter: "grayscale(1) contrast(1.15) brightness(1.05)", mixBlendMode: "multiply", transformOrigin: "50% 35%" });
  } else {
    actor = B.hero(drawn, panel, { mood: d.mood, edged: false, ink: "#ffffff", sheen: null });
    css(actor.node, { left: PW * 0.05 + "px", width: PW * 0.9 + "px", height: PH * 0.95 + "px", bottom: "0px" });
  }
  css(el("div", "layer", panel), { background: `linear-gradient(180deg, transparent 60%, ${B.alpha(mix(tint, "#000000", 0.5), 0.8)})` });
  const badge = css(el("div", "abs", panel), { right: "22px", bottom: "22px", width: pick(96, 120) + "px", height: pick(96, 120) + "px", borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,.35)" });
  const mark = css(B.logo(brand, c.dark ? "#111" : c.base, badge, 1.0, 0.9), { width: "58%", height: "58%" });

  const TW = pick(520, 940);
  const text = css(el("div", "abs", mid), isWide ? { top: "0", bottom: "0", width: TW + "px", display: "flex", flexDirection: "column", justifyContent: "center" } : { left: "70px", width: TW + "px", top: PY + PH + 50 + "px", bottom: "80px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const accentColor = c.dark ? "#fff" : luminance(c.base) < 0.06 ? mix(c.base, "#ffffff", 0.45) : c.base;
  const lines = d.headline.map((t, i) => B.line(text, t, { font: "800 80px/0.94 Bricolage", fontStretch: "80%", letterSpacing: "-0.025em", color: i === d.accent ? accentColor : "#fff", textTransform: "uppercase", display: "block" }));
  B.fitEach(lines, TW - 20, pick(460, 440), pick(150, 170), 34, 0.96);
  const swap = beat(8.5);
  const anim1 = B.animate(lines, B.choose(d.seed, ["weight", "skew", "rise"]), { start: 0.5, out: [swap - 0.4, swap - 0.1], seed: d.seed });
  const anim2 = B.animate(lines.map((n) => n), "track", { start: 9, out: null, seed: d.seed + 1 });
  // Second setting: the same lines re-enter after the glide (driven below with their own timing).
  B.cue("land", 0.2, 0.7);
  B.cue("whoosh", swap, 0.8);
  B.cue("swish", swap + 0.5, 0.5);
  B.cue("whoosh", 7.35, 0.7);

  return {
    poster: 2.3,
    frame(t) {
      cam.update(t);
      const g = ease.inOut(seg(t, swap, swap + 0.75));
      const away = ease.inCubic(seg(t, 7.35, 7.85));
      const enter = Math.min(1.03, sp(t, 0.05, "heavy"));
      const panelX = isWide ? lerp(W - 60 - PW, 60, g) : (W - PW) / 2;
      const textX = isWide ? lerp(60, W - 60 - TW, g) : 70;
      panel.style.left = panelX + "px";
      panel.style.transform = `translateY(${(1 - enter) * (H + 40) + away * (H + 60)}px) rotate(${isWide ? Math.sin(seg(t, swap, swap + 0.75) * Math.PI) * -3 : 0}deg)`;
      halo.style.left = panelX + PW / 2 - pick(450, 550) + "px";
      halo.style.top = PY + PH / 2 - pick(450, 550) + "px";
      stripes.style.transform = `translate(${t * 14}px, ${t * 7}px)`;
      if (photo) photo.style.transform = `scale(${lerp(1.04, 1.16, t / 8)})`;
      if (actor) actor.update(t, sp(t, 0.35, "pop"), 0);
      if (!isWide && actor) panel.style.background = t > swap + 0.3 ? mix(tint, "#ffffff", 0.12) : tint;
      badge.style.transform = `scale(${Math.max(0, sp(t, 0.95, "pop"))})`;
      mark.draw(t);
      text.style.left = textX + "px";
      if (t < swap) anim1(t);
      else {
        lines.forEach((n) => { n.style.fontWeight = "800"; n.style.clipPath = "none"; n.style.transform = "none"; });
        anim2(t + (9 - (swap + 0.6)));
        lines.forEach((n, i) => (n.style.opacity = Number(n.style.opacity || 1) * (1 - ease.inCubic(seg(t, 7.3 + i * 0.05, 7.7 + i * 0.05)))));
      }
    },
  };
};
