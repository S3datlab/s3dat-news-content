/* CUTOUT — illustrated cut-outs (made for the story, transparent background) as die-cut stickers on
   a flat colour field. The hero character or object springs up from the bottom and acts out the
   story's mood (up: bounce, down: slump and shudder, shock: shake and punch, calm: float); props
   orbit it; the real logo sits on a round sticker. Beat two hard-cuts the colour and swaps sides. */
BANNER.templates.cutout = (stage, d, B) => {
  const { el, css, seg, lerp, ease, fitLines, logoNode, brandColors, rng, luminance, onColor } = B;
  const cuts = d.cutouts || [];
  if (!cuts.length) return BANNER.templates.paper(stage, d, B);
  const brand = d.brands[0];
  const c = brandColors(brand, "#ff4f8b");
  const rand = rng(d.seed * 6007);
  const pops = ["#ffe14d", "#ff7ab6", "#7cf29a", "#8ecbff", "#ff8a3d", "#c9a8ff"];
  const pop = pops[Math.floor(rand() * pops.length)];
  const fields = { white: "#ffffff", black: "#0a0a0a", brand: c.dark ? "#0a0a0a" : c.base, pop };
  const order = ["white", "black", "brand", "pop"];
  const first = fields[d.bg] ? d.bg : order[d.seed % 4];
  const second = first === "black" ? (c.dark ? "pop" : "brand") : first === "white" ? "black" : "white";
  const bgA = fields[first], bgB = fields[second];
  const accentOn = (bg) => {
    const cand = [c.dark ? pop : c.base, pop, "#ff2e4d", "#0a0a0a", "#ffffff"];
    return cand.find((x) => Math.abs(luminance(x) - luminance(bg)) > 0.25 && x !== bg) || onColor(bg);
  };

  const root = css(el("div", "layer", stage), { background: bgA });
  const disc = css(el("div", "abs", root), { width: "460px", height: "460px", borderRadius: "50%", background: accentOn(bgA), top: "84px" });

  const hero = cuts.find((x) => x.role === "hero") || cuts[0];
  const props = cuts.filter((x) => x !== hero).slice(0, 3);
  const heroImg = css(B.sticker(hero, root), { width: "460px", height: "540px", bottom: "-16px", transformOrigin: "50% 100%" });
  // Prop slots relative to the hero box: top right, bottom right, bottom left.
  const P = [[330, 40, 150], [345, 350, 140], [-10, 420, 120]];
  const propImgs = props.map((p, i) => css(B.sticker(p, root), { width: P[i][2] + "px", height: P[i][2] + "px", top: P[i][1] + "px" }));
  const badge = css(el("div", "abs", root), { width: "124px", height: "124px", borderRadius: "50%", background: "#ffffff", display: "grid", placeItems: "center", top: "40px", boxShadow: "0 10px 26px rgba(0,0,0,.25)" });
  css(logoNode(brand, c.dark ? "#0a0a0a" : c.base, badge), { width: "70px", height: "70px" });

  const mk = (font, stretch, bg, width) => {
    const box = css(el("div", "abs", root), { top: "0", bottom: "0", width: width + "px", display: "flex", flexDirection: "column", justifyContent: "center" });
    const ink = onColor(bg);
    const lines = d.headline.map((text, i) => {
      const wrap = css(el("div", "", box), { alignSelf: "flex-start", padding: i === d.accent ? "0 14px" : "0", background: i === d.accent ? accentOn(bg) : "transparent" });
      const n = css(el("div", "line", wrap), { font, fontStretch: stretch, color: i === d.accent ? onColor(accentOn(bg)) : ink, textTransform: "uppercase", letterSpacing: "-0.01em" });
      n.textContent = text;
      return { wrap, n };
    });
    B.fitEach(lines.map((x) => x.n), width - 30, 470, 150, 34, 0.95);
    return { box, lines };
  };
  const A = mk("900 80px/0.9 Archivo", "62%", bgA, 560);
  const Bt = mk("800 80px/0.92 Bricolage", "80%", bgB, 520);
  A.box.style.left = "52px";
  Bt.box.style.left = "530px";

  const mood = ["up", "down", "shock", "calm"].includes(d.mood) ? d.mood : "calm";
  const act = (t) => {
    if (mood === "up") return { y: -Math.abs(Math.sin(t * 3.4)) * 22, r: Math.sin(t * 3.4) * 2, s: 1 + Math.abs(Math.cos(t * 3.4)) * 0.025 };
    if (mood === "down") { const slump = ease.inOut(seg(t, 1.2, 2.6)); const shud = t > 2.6 && t < 3.1 ? Math.sin(t * 70) * 3 : 0; return { y: slump * 18, r: -slump * 5 + shud, s: 1 - slump * 0.02 }; }
    if (mood === "shock") { const k = Math.max(seg(t, 1.0, 1.4) < 1 && t > 1.0 ? 1 - seg(t, 1.0, 1.4) : 0, t > 4.6 && t < 5.0 ? 1 - seg(t, 4.6, 5.0) : 0); return { y: 0, r: Math.sin(t * 80) * 4 * k, s: 1 + k * 0.08 }; }
    return { y: Math.sin(t * 1.6) * 8, r: Math.sin(t * 0.9) * 1.5, s: 1 };
  };

  return {
    poster: 2.3,
    frame(t) {
      const swap = ease.inOut(seg(t, 4.2, 4.75));
      const cut = t >= 4.45;
      root.style.background = cut ? bgB : bgA;
      disc.style.background = accentOn(cut ? bgB : bgA);
      const heroX = lerp(600, 30, swap);
      const enter = ease.outBack(seg(t, 0.15, 0.95), 1.4), leave = ease.inCubic(seg(t, 7.35, 7.9));
      const m = act(t);
      heroImg.style.left = heroX + "px";
      heroImg.style.transform = `translateY(${(1 - enter) * 640 + m.y + leave * 700}px) rotate(${m.r}deg) scale(${m.s})`;
      disc.style.left = heroX + "px";
      disc.style.transform = `scale(${Math.max(0, ease.outBack(seg(t, 0.05, 0.6))) * (1 - leave)})`;
      propImgs.forEach((img, i) => {
        const x0 = heroX + P[i][0];
        const p = ease.outBack(seg(t, 0.7 + i * 0.18, 1.2 + i * 0.18), 2);
        let dy = Math.sin(t * 1.8 + i * 2) * 10, dr = Math.sin(t * 1.2 + i) * 8;
        if (mood === "down") { dy += t * 9; dr += t * 5 * (i % 2 ? -1 : 1); }
        if (mood === "up") dy -= t * 6;
        if (mood === "shock") { const burst = ease.outExpo(seg(t, 1.0, 1.6)); dy += (i - 1) * 30 * burst; }
        img.style.left = x0 + "px";
        img.style.transform = `translateY(${dy + leave * -500}px) rotate(${dr}deg) scale(${Math.max(0, p)})`;
      });
      badge.style.left = heroX + 6 + "px";
      badge.style.transform = `scale(${Math.max(0, ease.outBack(seg(t, 1.1, 1.6)) - leave)}) rotate(${Math.sin(t * 2) * 6}deg)`;
      A.lines.forEach(({ wrap }, i) => {
        const x = ease.outExpo(seg(t, 0.35 + i * 0.12, 1.15 + i * 0.12));
        const out = ease.inCubic(seg(t, 4.15, 4.45));
        wrap.style.transform = `translateX(${(1 - x) * -80 - out * 700}px)`;
        wrap.style.opacity = cut ? 0 : x;
      });
      Bt.lines.forEach(({ wrap }, i) => {
        const x = ease.outExpo(seg(t, 4.55 + i * 0.12, 5.3 + i * 0.12));
        wrap.style.transform = `translateY(${(1 - x) * 60}px)`;
        wrap.style.opacity = cut ? x * (1 - leave) : 0;
      });
    },
  };
};
