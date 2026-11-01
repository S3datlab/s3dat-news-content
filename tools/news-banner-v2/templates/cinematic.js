/* CINEMATIC — one strong image treated like film. A shutter of letterbox bars opens, the camera
 * pushes and drifts, a whip pan (motion-blurred) carries us to a second shot cut from another
 * region of the same image; the headline arrives as label strips, the logo draws on a chip, and
 * cut-outs float in the foreground. The shutter closes at the end, so the loop starts in black. */
BANNER.templates.cinematic = (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, beat, brandColors, onColor, pick, wide } = B;
  if (!d.art) return BANNER.templates.brand(stage, d, B);
  const W = B.W, H = B.H, isWide = wide();
  const brand = d.brands[0];
  const c = brandColors(brand, "#ffd400");
  const tag = c.dark ? "#ffd400" : c.base;
  stage.style.background = "#000";
  const cam = B.camera(stage, { push: 0.06, drift: 14, sway: 0.3 });
  const plate = cam.layer(0.4), fg = cam.layer(1.2), ui = cam.layer(0.8);
  const amb = B.ambient(fg, { bg: "#000000", ink: "#ffffff", accent: "rgba(255,255,255,0.7)", marquee: false, shapes: 16, seed: d.seed });
  const shots = [0, 1].map(() => css(el("div", "layer", plate), { inset: "-8%", backgroundImage: `url(${d.art})`, backgroundSize: "cover", backgroundRepeat: "no-repeat" }));
  css(el("div", "layer", plate), { background: isWide ? "linear-gradient(90deg, rgba(0,0,0,.6), rgba(0,0,0,0) 62%)" : "linear-gradient(0deg, rgba(0,0,0,.7), rgba(0,0,0,0) 55%)" });

  const props = (d.cutouts || []).slice(0, 2).map((cut, i) => {
    const img = B.sticker(cut, fg, false);
    css(img, isWide ? { width: i ? "220px" : "360px", height: i ? "220px" : "360px", right: i ? "330px" : "40px", bottom: i ? "300px" : "10px" } : { width: i ? "260px" : "460px", height: i ? "260px" : "460px", right: i ? "560px" : "30px", top: i ? "220px" : "260px" });
    return img;
  });

  const stack = css(el("div", "abs", ui), isWide ? { left: "48px", bottom: "64px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px" } : { left: "60px", bottom: "120px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px" });
  const strips = d.headline.map((text, i) => {
    const s = css(el("div", "", stack), { background: i === d.accent ? tag : "#ffffff", padding: "6px 18px 4px", overflow: "hidden" });
    const n = B.line(s, text, { font: "800 80px/0.95 Bricolage", fontStretch: "78%", letterSpacing: "-0.02em", color: i === d.accent ? onColor(tag) : "#0a0a0a", textTransform: "uppercase" });
    return { s, n };
  });
  B.fitLines(strips.map((x) => x.n), pick(680, 900), pick(330, 520), pick(110, 150), 34, 1.1);
  const animS = B.animate(strips.map((x) => x.n), B.choose(d.seed, ["skew", "rise"]), { start: 0.75, out: null, seed: d.seed });
  const chip = css(el("div", "abs", ui), { left: pick(48, 60) + "px", top: pick(64, 90) + "px", width: pick(86, 110) + "px", height: pick(86, 110) + "px", borderRadius: "18px", background: "#ffffff", display: "grid", placeItems: "center" });
  const mark = css(B.logo(brand, c.dark ? "#0a0a0a" : c.base, chip, 1.1, 0.9), { width: "62%", height: "62%" });
  const barH = pick(54, 0);
  const bars = [0, 1].map((i) => css(el("div", "abs", stage), { left: 0, right: 0, height: H / 2 + 2 + "px", background: "#000", [i ? "bottom" : "top"]: "0" }));
  css(el("div", "layer", stage), { background: "radial-gradient(120% 95% at 50% 45%, transparent 55%, rgba(0,0,0,.5))", pointerEvents: "none" });
  B.grain(stage, 0.08);
  const whip = beat(8.6);
  B.cue("swish", 0.05, 0.6);
  B.cue("whoosh", whip - 0.1, 1);
  B.cue("swish", 7.45, 0.7);

  return {
    poster: 2.6,
    frame(t) {
      cam.update(t);
      amb(t);
      // Shutter: bars open from the middle to letterbox (or nothing on 4:5), close at the end.
      const open = Math.min(1, ease.outExpo(seg(t, 0, 0.6))) * (1 - ease.inCubic(seg(t, 7.45, 7.95)));
      bars.forEach((b) => (b.style.height = lerp(H / 2 + 2, barH, open) + "px"));
      // Two shots joined by a whip pan.
      const w = seg(t, whip - 0.12, whip + 0.22), wp = ease.inOut(w);
      const a = seg(t, 0, whip), b2 = seg(t, whip, 8);
      shots[0].style.transform = `translateX(${-wp * W * 1.1}px) scale(${lerp(1.0, 1.1, a)})`;
      shots[0].style.backgroundPosition = "50% 50%";
      shots[1].style.transform = `translateX(${(1 - wp) * W * 1.1}px) scale(${lerp(1.55, 1.42, b2)})`;
      shots[1].style.backgroundPosition = `${lerp(72, 64, b2)}% ${lerp(32, 40, b2)}%`;
      shots[0].style.visibility = w < 1 ? "visible" : "hidden";
      shots[1].style.visibility = w > 0 ? "visible" : "hidden";
      animS(t);
      strips.forEach(({ s }, i) => {
        const x = Math.min(1, sp(t, 0.7 + i * 0.12, "snap"));
        s.style.clipPath = `inset(0 ${(1 - x) * 100}% 0 0)`;
        const re = t > whip ? Math.min(1.1, sp(t, whip + 0.1 + i * 0.06, "wobble")) : 0;
        s.style.transform = t > whip ? `rotate(${lerp(-3, i % 2 ? 1.5 : -1.5, re)}deg)` : "none";
      });
      chip.style.transform = `scale(${Math.max(0, sp(t, 1.0, "pop"))})`;
      mark.draw(t);
      props.forEach((p, i) => {
        const x = sp(t, 0.8 + i * 0.3, "pop");
        p.style.transform = `translateY(${(1 - Math.min(1, x)) * 400 + Math.sin(t * 1.4 + i) * 10}px) rotate(${Math.sin(t + i) * 3}deg)`;
      });
    },
  };
};
