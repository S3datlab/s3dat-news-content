/* CUTOUT — illustrated cut-outs as die-cut stickers on a flat colour field. The hero springs up and
 * acts the story's mood (and changes pose on the beat when Makima supplies poses); props orbit it
 * in parallax; the real logo draws itself on a round badge. Halfway, the disc behind the hero
 * opens like an iris into the next colour (a match cut, not a hard cut) and the composition swaps.
 * At the end the field closes back to the first colour, so the loop is seamless. */
BANNER.templates.cutout = (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, beat, logo, brandColors, rng, luminance, onColor, pick, wide } = B;
  const cuts = d.cutouts || [];
  if (!cuts.length) return BANNER.templates.paper(stage, d, B);
  const W = B.W, H = B.H, isWide = wide();
  const brand = d.brands[0];
  const c = brandColors(brand, "#ff4f8b");
  const rand = rng(d.seed * 6007);
  const pops = ["#ffe14d", "#ff7ab6", "#7cf29a", "#8ecbff", "#ff8a3d", "#c9a8ff"];
  const pop = pops[(d.seed + Math.floor(rand() * 6)) % pops.length];
  const fields = { white: "#ffffff", black: "#0a0a0a", brand: c.dark ? "#0a0a0a" : c.base, pop };
  const order = ["white", "black", "brand", "pop"];
  const first = fields[d.bg] ? d.bg : order[d.seed % 4];
  const second = first === "black" ? (c.dark ? "pop" : "brand") : first === "white" ? "black" : "white";
  const bgA = fields[first], bgB = fields[second];
  const accentOn = (bg) => [c.dark ? pop : c.base, pop, "#ff2e4d", "#0a0a0a", "#ffffff"].find((x) => Math.abs(luminance(x) - luminance(bg)) > 0.25 && x !== bg) || onColor(bg);

  stage.style.background = bgA;
  const cam = B.camera(stage, { push: 0.04, drift: isWide ? 10 : 12, sway: 0.4 });
  const back = cam.layer(0.35), mid = cam.layer(0.7), front = cam.layer(1.1);

  // Geometry for both layouts.
  const G = isWide
    ? { disc: 460, discA: [830, 314], discB: [260, 314], heroW: 460, heroH: 540, heroA: 600, heroB: 30, heroBottom: -16, textA: [52, 0, 560, H], textB: [530, 0, 520, H] }
    : { disc: 640, discA: [540, 930], discB: [540, 930], heroW: 640, heroH: 760, heroA: 220, heroB: 220, heroBottom: -20, textA: [70, 90, 940, 560], textB: [70, 90, 940, 560] };

  const irisNode = B.iris(back, bgB, G.discA[0], G.discA[1]);
  const disc = css(el("div", "abs", back), { width: G.disc + "px", height: G.disc + "px", borderRadius: "50%", marginLeft: -G.disc / 2 + "px", marginTop: -G.disc / 2 + "px" });

  const heroCut = cuts.find((x) => x.role === "hero") || cuts[0];
  const props = cuts.filter((x) => x !== heroCut).slice(0, 3);
  const actor = B.hero(heroCut, mid, { mood: d.mood, ink: onColor(bgA) === "#ffffff" ? "#ffffff" : "#111111", sheen: 2.3 });
  css(actor.node, { width: G.heroW + "px", height: G.heroH + "px", bottom: G.heroBottom + "px" });
  B.cue("land", 0.45, 0.8);

  // Prop slots relative to the hero box: top right, bottom right, bottom left.
  const P = isWide ? [[330, 40, 150], [345, 350, 140], [-10, 420, 120]] : [[520, 700, 170], [-50, 800, 170], [500, 1060, 150]];
  const propImgs = props.map((p, i) => css(B.sticker(p, front), { width: P[i][2] + "px", height: P[i][2] + "px", top: P[i][1] + "px" }));
  props.forEach((_, i) => B.cue("pop", 0.7 + i * 0.18, 0.45, i % 2 ? 0.4 : -0.4));

  const badge = css(el("div", "abs", front), { width: pick(124, 150) + "px", height: pick(124, 150) + "px", borderRadius: "50%", background: "#ffffff", display: "grid", placeItems: "center", top: pick(40, 640) + "px", boxShadow: "0 10px 26px rgba(0,0,0,.25)" });
  const mark = css(logo(brand, c.dark ? "#0a0a0a" : c.base, badge, 1.15, 1.0), { width: "58%", height: "58%" });

  const block = (font, stretch, bg, box) => {
    const [x, y, w, h] = box;
    const wrapBox = css(el("div", "abs", mid), { left: x + "px", top: y + "px", width: w + "px", height: h + "px", display: "flex", flexDirection: "column", justifyContent: "center" });
    const ink = onColor(bg);
    const lines = d.headline.map((text, i) => {
      const wrap = css(el("div", "", wrapBox), { alignSelf: "flex-start", padding: i === d.accent ? "0 14px" : "0", background: i === d.accent ? accentOn(bg) : "transparent" });
      const n = B.line(wrap, text, { font, fontStretch: stretch, color: i === d.accent ? onColor(accentOn(bg)) : ink, textTransform: "uppercase", letterSpacing: "-0.01em" });
      return { wrap, n };
    });
    B.fitEach(lines.map((x) => x.n), w - 30, h - 60, isWide ? 150 : 210, 34, 0.95);
    return { box: wrapBox, lines };
  };
  const A = block("900 80px/0.9 Archivo", "62%", bgA, G.textA);
  const Bt = block("800 80px/0.92 Bricolage", "80%", bgB, G.textB);
  const kindA = B.choose(d.seed, ["drop", "slam", "weight", "skew"]);
  const kindB = B.choose(d.seed + 1, ["track", "rise", "skew"]);
  const swap = beat(8), outAt = 7.2;
  const animA = B.animate(A.lines.map((x) => x.n), kindA, { start: 0.35, out: [swap - 0.35, swap - 0.05], seed: d.seed, camera: cam });
  const animB = B.animate(Bt.lines.map((x) => x.n), kindB, { start: swap + 0.45, out: [outAt, outAt + 0.45], seed: d.seed + 3 });
  B.cue("riser", swap - 1.0, 0.5);
  B.cue("whoosh", swap, 0.9);
  B.cue("whoosh", outAt + 0.05, 0.6);

  return {
    poster: 2.6,
    frame(t) {
      cam.update(t);
      const k = ease.inOut(seg(t, swap, swap + 0.6));
      const leave = ease.inCubic(seg(t, outAt, outAt + 0.5));
      // Disc: grows in, becomes the iris that opens the second colour, then shrinks away.
      const dx = lerp(G.discA[0], G.discB[0], k), dy = lerp(G.discA[1], G.discB[1], k);
      const discIn = sp(t, 0.05, "pop");
      css(disc, { left: dx + "px", top: dy + "px", background: accentOn(t < swap + 0.3 ? bgA : bgB), transform: `scale(${Math.max(0, discIn) * (1 - leave)})` });
      irisNode.update(t, swap, swap + 0.55, outAt + 0.15, outAt + 0.75, G.disc / 2);
      const heroX = lerp(G.heroA, G.heroB, k);
      actor.node.style.left = heroX + "px";
      actor.update(t, sp(t, 0.15, "pop"), leave);
      propImgs.forEach((img, i) => {
        const p = sp(t, 0.6 + i * 0.18, "pop");
        let dy2 = Math.sin(t * 1.8 + i * 2) * 10, dr = Math.sin(t * 1.2 + i) * 8;
        if (d.mood === "down") { dy2 += t * 9; dr += t * 5 * (i % 2 ? -1 : 1); }
        if (d.mood === "up") dy2 -= t * 6;
        if (d.mood === "shock") dy2 += (i - 1) * 30 * ease.outExpo(seg(t, 1.25, 1.8));
        img.style.left = heroX + P[i][0] + "px";
        img.style.transform = `translateY(${dy2 - leave * 600}px) rotate(${dr}deg) scale(${Math.max(0, p)})`;
      });
      badge.style.left = heroX + pick(6, -40) + "px";
      badge.style.transform = `scale(${Math.max(0, sp(t, 1.05, "pop")) * (1 - leave)}) rotate(${Math.sin(t * 2) * 6}deg)`;
      mark.draw(t);
      animA(t);
      animB(t);
      // The accent highlight wipes in after its line and wipes out with it.
      const wipe = (wrap, a, b) => { wrap.style.clipPath = `inset(0 ${(1 - ease.inOut(seg(t, a, a + 0.4))) * 100}% 0 ${ease.inOut(seg(t, b, b + 0.35)) * 100}%)`; };
      A.lines.forEach(({ wrap }, i) => { wrap.style.visibility = t < swap + 0.1 ? "visible" : "hidden"; if (i === d.accent) wipe(wrap, 0.55, swap - 0.4); });
      Bt.lines.forEach(({ wrap }, i) => { wrap.style.visibility = t >= swap + 0.3 ? "visible" : "hidden"; if (i === d.accent) wipe(wrap, swap + 0.6, outAt); });
    },
  };
};
