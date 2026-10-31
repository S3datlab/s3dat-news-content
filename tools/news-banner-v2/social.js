/* SOCIAL — the second half of the 15-second vertical cut for X, Threads, Instagram, LinkedIn and the
 * rest. After the banner (0-8 s, drawn by the template in a 4:5 frame centred in 9:16), three fact
 * cards from the story's spec sheet slam in on alternating colours, then an end card signs the
 * clip as S3DAT News. Everything sits inside the platforms' safe zone (clear of captions and
 * buttons at the edges). Returns frame(t) for t in seconds since the cards begin. */
BANNER.social = (root, d, B) => {
  const { el, css, seg, lerp, ease, sp, brandColors, onColor } = B;
  const W = 1080, H = 1920;
  const brand = d.brands[0];
  const c = brandColors(brand, "#5cc8ff");
  const pop = c.dark ? "#5cc8ff" : c.base;
  const story = d.story || {};
  // Cards: facts with numbers first, at most three.
  const facts = (story.facts || []).filter((f) => f && f.label && f.value);
  const ranked = [...facts.filter((f) => /\d/.test(f.value)), ...facts.filter((f) => !/\d/.test(f.value))].slice(0, 3);
  const cards = ranked.length ? ranked : (d.stat ? [{ label: d.stat.label || "Key number", value: d.stat.value }] : []);
  const palette = [[pop, onColor(pop)], ["#0a0a0a", "#ffffff"], ["#f2f0ea", "#0a0a0a"]];
  const per = cards.length ? Math.min(2.2, 6.0 / cards.length) : 0;
  const endAt = cards.length * per;

  const layers = cards.map((f, i) => {
    const [bg, ink] = palette[i % 3];
    const layer = css(el("div", "layer", root), { background: bg, visibility: "hidden" });
    const box = css(el("div", "abs", layer), { left: "84px", right: "84px", top: "420px", bottom: "520px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "28px" });
    const label = B.line(box, f.label, { font: "600 46px/1 'Space Grotesk'", letterSpacing: "0.06em", textTransform: "uppercase", color: ink, opacity: 0.72, display: "block" });
    const value = el("div", "", box);
    // Long values wrap onto at most three lines; each line is fitted to the width.
    const words = String(f.value).split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) { if ((cur + " " + w).trim().length > 16 && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
    if (cur) lines.push(cur);
    const nodes = lines.slice(0, 3).map((t, j) => B.line(value, t, { font: "900 100px/0.92 Archivo", fontStretch: "70%", color: j === 0 && bg === "#0a0a0a" ? pop : ink, textTransform: "uppercase", display: "block" }));
    B.fitEach(nodes, W - 168, 720, 300, 60, 0.95);
    const start = i * per;
    B.cue(i === 0 ? "whoosh" : "swish", 8 + start, 0.8, i % 2 ? 0.3 : -0.3);
    B.cue("hit", 8 + start + 0.12, 0.6);
    return { layer, label, nodes, start };
  });

  // End card.
  const end = css(el("div", "layer", root), { background: "#0a0a0a", visibility: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "34px" });
  const blade = "M250.5 65.1 C196.8 69.9 139.7 101.4 106.8 144.2 C90.7 164.9 70.2 213.0 64.4 243.7 C44.0 349.7 95.9 454.2 193.3 503.5 C247.0 530.6 329.8 543.9 382.3 533.9 C393.1 531.9 407.0 529.4 413.0 528.5 C421.6 527.2 473.0 511.7 473.0 510.4 C473.0 510.2 464.9 509.9 455.1 509.8 C399.6 508.8 355.1 488.3 329.0 451.8 C300.3 411.6 300.5 360.5 329.5 317.4 C344.6 295.0 356.9 285.3 383.5 273.7 C409.5 262.6 446.3 232.0 458.8 211.7 C471.5 190.8 471.8 189.5 471.2 145.6 C470.8 106.8 470.8 106.8 465.8 95.4 C459.8 81.2 448.4 68.6 440.6 67.4 C415.5 63.8 284.8 62.2 250.5 65.1 Z";
  const mark = el("div", "", end);
  mark.innerHTML = `<svg viewBox="0 0 1000 1000" width="220" height="220"><defs><linearGradient id="sg" gradientUnits="userSpaceOnUse" x1="160" y1="175" x2="505" y2="570"><stop offset="0" stop-color="#afceeb"/><stop offset="0.52" stop-color="#6790bd"/><stop offset="1" stop-color="#2d4f76"/></linearGradient></defs>${[0, 90, 180, 270].map((r) => `<path d="${blade}" transform="rotate(${r} 500 500)" fill="url(#sg)"/>`).join("")}</svg>`;
  const word = B.line(end, "S3DAT NEWS", { font: "900 120px/1 Archivo", fontStretch: "80%", color: "#ffffff", letterSpacing: "-0.01em" });
  const url = B.line(end, "news.s3dat.com", { font: "500 52px/1 'Space Grotesk'", color: "#5cc8ff" });
  B.cue("pop", 8 + endAt + 0.1, 0.7);

  return {
    duration: endAt + 1.0,
    frame(t) {
      layers.forEach(({ layer, label, nodes, start }, i) => {
        const next = i < layers.length - 1 ? layers[i + 1].start : endAt;
        const on = t >= start && t < next;
        layer.style.visibility = on ? "visible" : "hidden";
        if (!on) return;
        const wipe = ease.outExpo(seg(t, start, start + 0.28));
        layer.style.clipPath = `inset(${(1 - wipe) * 100}% 0 0 0)`;
        label.style.transform = `translateY(${(1 - Math.min(1, sp(t, start + 0.05, "snap"))) * 30}px)`;
        label.style.opacity = 0.72 * seg(t, start + 0.05, start + 0.2);
        nodes.forEach((n, j) => {
          const p = sp(t, start + 0.1 + j * 0.08, "pop");
          n.style.transform = `translateY(${(1 - Math.min(1, p)) * 80}px) scale(${1 + (1 - p) * 0.25})`;
          n.style.transformOrigin = "0 100%";
          n.style.opacity = seg(t, start + 0.1 + j * 0.08, start + 0.16 + j * 0.08);
        });
      });
      const e = t >= endAt;
      end.style.visibility = e ? "visible" : "hidden";
      if (e) {
        const p = sp(t, endAt, "pop");
        mark.style.transform = `rotate(${(1 - Math.min(1, p)) * -120 + (t - endAt) * 20}deg) scale(${Math.max(0, p)})`;
        word.style.opacity = url.style.opacity = seg(t, endAt + 0.12, endAt + 0.3);
        word.style.transform = `translateY(${(1 - ease.outExpo(seg(t, endAt + 0.12, endAt + 0.5))) * 30}px)`;
      }
    },
  };
};
