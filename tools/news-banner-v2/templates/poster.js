/* POSTER — kinetic typography on the beat. Each headline word slams in alone and fills the frame on
 * a hard colour cut (16th notes at 120 BPM), with a camera kick per hit. Then the headline locks up
 * as a stacked poster — solid and outline lines, the logo rolling in, a band of the news words
 * scrolling along the bottom — and an iris in the first card colour closes it for the loop. */
BANNER.templates.poster = (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, brandColors, onColor, pick, wide } = B;
  const W = B.W, H = B.H, isWide = wide();
  const brand = d.brands[0];
  const c = brandColors(brand, "#ff2e4d");
  const pop = c.dark ? "#ff2e4d" : c.base;
  const cards = [[pop, onColor(pop)], ["#0a0a0a", "#ffffff"], ["#ffffff", "#0a0a0a"]];
  stage.style.background = pop;
  const cam = B.camera(stage, { push: 0.03, drift: 6, sway: 0.2 });
  const back = cam.layer(0), mid = cam.layer(0.6);

  const words = d.headline.join(" ").split(/\s+/).filter(Boolean);
  // Words land on a 0.125 s grid: one, two or four sixteenths each, whatever fits in ~2.9 s.
  const per = [0.5, 0.375, 0.25].find((p) => words.length * p <= 2.9) || 0.25;
  const flash = words.map((w, i) => {
    const [bgc, ink] = cards[i % 3];
    const card = css(el("div", "layer", back), { background: bgc, display: "grid", placeItems: "center", visibility: "hidden" });
    const n = B.line(card, w, { font: "400 300px/0.9 Anton", color: ink, textTransform: "uppercase", letterSpacing: "0.005em" });
    B.fitLines([n], W - pick(160, 140), pick(500, 900), pick(520, 760), 80, 0.9);
    const start = 0.25 + i * per;
    cam.kick(start + 0.04, 7 + (i % 2) * 3);
    return { card, n, start };
  });
  const flashEnd = 0.25 + words.length * per;

  // Lock-up.
  const [bg2, ink2] = c.dark ? ["#f1efe9", "#0a0a0a"] : [pop, onColor(pop)];
  const lock = css(el("div", "layer", mid), { background: bg2, visibility: "hidden" });
  const box = isWide ? { x: 56, y: 0, w: 700, h: H - 110 } : { x: 70, y: 120, w: 940, h: 900 };
  const stack = css(el("div", "abs", lock), { left: box.x + "px", top: box.y + "px", width: box.w + "px", height: box.h + "px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const lines = d.headline.map((text, i) => {
    const n = B.line(stack, text, { font: "400 80px/0.92 Anton", color: ink2, textTransform: "uppercase", display: "block" });
    if (i !== d.accent && d.headline.length > 1 && i % 2 === 1) css(n, { color: "transparent", WebkitTextStroke: `0.045em ${ink2}` });
    return n;
  });
  B.fitEach(lines, box.w, box.h - 40, isWide ? 190 : 260, 40, 0.94);
  const animL = B.animate(lines, B.choose(d.seed, ["drop", "slam", "rise"]), { start: flashEnd + 0.05, stagger: 0.1, out: null, seed: d.seed, camera: cam });
  const LS = pick(200, 240);
  const logo = css(B.logo(brand, ink2, lock, flashEnd + 0.35, 0.8), isWide ? { position: "absolute", right: "70px", top: "110px", width: LS + "px", height: LS + "px" } : { position: "absolute", right: "80px", top: H - 230 - LS - 60 + "px", width: LS + "px", height: LS + "px" });
  const bandH = pick(96, 130);
  const band = css(el("div", "abs", lock), { left: 0, right: 0, bottom: 0, height: bandH + "px", background: "#0a0a0a", overflow: "hidden" });
  const strip = css(el("div", "abs", band), { left: 0, top: pick(12, 16) + "px", whiteSpace: "nowrap", font: `400 ${pick(70, 96)}px/1 Anton`, color: c.dark ? "#ffffff" : pop, textTransform: "uppercase" });
  const accentText = d.headline[d.accent] || d.headline[d.headline.length - 1];
  strip.textContent = Array(10).fill(accentText).join("  ✦  ");
  const close = B.iris(mid, pop, W / 2, H / 2);
  B.cue("whoosh", flashEnd, 0.6);
  B.cue("whoosh", 7.35, 0.8);

  return {
    poster: Math.min(6.5, flashEnd + 1.4),
    frame(t) {
      cam.update(t);
      flash.forEach(({ card, n, start }, i) => {
        const on = t >= start && (i === flash.length - 1 ? t < flashEnd : t < flash[i + 1].start);
        card.style.visibility = on ? "visible" : "hidden";
        if (on) { const p = sp(t, start, "pop"); n.style.transform = `scale(${1 + (1 - p) * 0.35})`; }
      });
      lock.style.visibility = t >= flashEnd ? "visible" : "hidden";
      animL(t);
      logo.draw(t);
      const lp = sp(t, flashEnd + 0.3, "pop");
      logo.style.transform = `translateX(${(1 - Math.min(1, lp)) * 260}px) rotate(${(1 - Math.min(1, lp)) * 200 + Math.sin(t * 1.2) * 4}deg)`;
      band.style.transform = `translateY(${(1 - Math.min(1, sp(t, flashEnd + 0.2, "snap"))) * 100}%)`;
      strip.style.transform = `translateX(${-((t - flashEnd) * 130)}px)`;
      close.update(t, 7.35, 7.9, 9, 10, 0);
    },
  };
};
