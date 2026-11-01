/* SOCIAL — the 15-second vertical cut for Instagram Reels (1080x1920).
 *
 * The 16:9 banner plays as a card near the top. Behind it the same banner runs again, scaled up and
 * blurred, so the whole frame takes its colours from the video. Below it the voice-over is set as
 * kinetic type: one phrase at a time, words rising in and lighting up as they are spoken (timings
 * from render.mjs, d.story.captions), numbers and [emphasis] words on a pill in the brand colour. It
 * ends on the S3DAT News sign-off. Everything sits inside the Reels safe zone: clear of the header
 * at the top, the caption and buttons at the bottom and the action column on the right.
 *
 * BANNER.social(root, d, B, bg, frame) fills root (above the banner) and bg (behind it; frame is the
 * blurred copy of the banner, or null) and returns frame(t) for t in seconds from the start. */
BANNER.social = (root, d, B, bg, mirror) => {
  const { el, css, seg, lerp, ease, sp, brandColors, onColor, alpha, mix } = B;
  const W = 1080, H = 1920;
  const card = d.format.card; // where the banner card sits: { x, y, w, h }
  const story = d.story || {};
  const c = brandColors(d.brands[0], "#5cc8ff");
  const pop = c.dark || B.luminance(c.base) < 0.05 ? "#5cc8ff" : c.base;
  const popInk = onColor(pop);
  const DURATION = d.format.seconds;

  /* ---------- background: the banner's own colours ---------- */
  if (!mirror) {
    // No blurred copy (the 3D template renders once): a field in the brand colour instead.
    css(el("div", "layer", bg), { background: `radial-gradient(90% 60% at 30% 20%, ${alpha(pop, 0.55)}, transparent 70%), radial-gradient(80% 60% at 80% 85%, ${alpha(mix(pop, "#000000", 0.4), 0.7)}, transparent 70%), #07090c` });
  }
  css(el("div", "layer", bg), { background: "linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.18) 22%, rgba(0,0,0,0.58) 50%, rgba(0,0,0,0.86) 100%)" });
  const glow = css(el("div", "layer", bg), { background: `radial-gradient(70% 38% at 18% 78%, ${alpha(pop, 0.32)}, transparent 72%)` });
  B.grain(bg, 0.07);

  /* ---------- header: S3DAT NEWS · topic ---------- */
  const blade = "M250.5 65.1 C196.8 69.9 139.7 101.4 106.8 144.2 C90.7 164.9 70.2 213.0 64.4 243.7 C44.0 349.7 95.9 454.2 193.3 503.5 C247.0 530.6 329.8 543.9 382.3 533.9 C393.1 531.9 407.0 529.4 413.0 528.5 C421.6 527.2 473.0 511.7 473.0 510.4 C473.0 510.2 464.9 509.9 455.1 509.8 C399.6 508.8 355.1 488.3 329.0 451.8 C300.3 411.6 300.5 360.5 329.5 317.4 C344.6 295.0 356.9 285.3 383.5 273.7 C409.5 262.6 446.3 232.0 458.8 211.7 C471.5 190.8 471.8 189.5 471.2 145.6 C470.8 106.8 470.8 106.8 465.8 95.4 C459.8 81.2 448.4 68.6 440.6 67.4 C415.5 63.8 284.8 62.2 250.5 65.1 Z";
  const rotor = (size, id) => `<svg viewBox="0 0 1000 1000" width="${size}" height="${size}"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="160" y1="175" x2="505" y2="570"><stop offset="0" stop-color="#afceeb"/><stop offset="0.52" stop-color="#6790bd"/><stop offset="1" stop-color="#2d4f76"/></linearGradient></defs>${[0, 90, 180, 270].map((r) => `<path d="${blade}" transform="rotate(${r} 500 500)" fill="url(#${id})"/>`).join("")}</svg>`;
  const header = css(el("div", "abs", root), { left: card.x + "px", top: card.y - 86 + "px", display: "flex", alignItems: "center", gap: "16px" });
  const headMark = el("div", "", header, rotor(46, "sh"));
  B.line(header, "S3DAT NEWS", { font: "900 40px/1 Archivo", fontStretch: "80%", color: "#ffffff", letterSpacing: "0.01em" });
  if (story.topic) {
    css(el("div", "", header), { width: "2px", height: "30px", background: "rgba(255,255,255,0.35)" });
    B.line(header, String(story.topic).toUpperCase(), { font: "600 27px/1 'Space Grotesk'", color: "rgba(255,255,255,0.78)", letterSpacing: "0.14em" });
  }

  /* ---------- progress under the card ---------- */
  const track = css(el("div", "abs", root), { left: card.x + "px", top: card.y + card.h + 26 + "px", width: card.w + "px", height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.16)", overflow: "hidden" });
  const fill = css(el("div", "", track), { height: "100%", width: "100%", background: pop, transformOrigin: "0 50%", borderRadius: "3px" });

  /* ---------- kinetic captions ---------- */
  const box = { x: 64, y: card.y + card.h + 96, w: 860, h: 1460 - (card.y + card.h + 96) };
  const area = css(el("div", "abs", root), { left: box.x + "px", top: box.y + "px", width: box.w + "px", height: box.h + "px" });
  const phrases = (story.captions || []).map((p) => {
    const node = css(el("div", "abs", area), { left: 0, top: 0, width: box.w + "px", font: "900 112px/1.0 Archivo", fontStretch: "76%", textTransform: "uppercase", letterSpacing: "-0.005em", color: "#ffffff", visibility: "hidden" });
    const words = p.words.map((w) => {
      const mask = css(el("span", "", node), { display: "inline-block", overflow: "hidden", verticalAlign: "top", padding: "0.06em 0.05em 0.02em", margin: "0 0.12em 0.04em 0" });
      const inner = css(el("span", "", mask), { display: "inline-block", padding: w.accent ? "0 0.14em" : "0", borderRadius: "0.14em", whiteSpace: "nowrap" });
      inner.textContent = w.text;
      return { ...w, mask, inner };
    });
    // Largest size up to 112px at which the phrase fits the area in at most four lines.
    for (let size = 112; size >= 60; size -= 3) {
      node.style.fontSize = size + "px";
      if (node.getBoundingClientRect().height <= Math.min(box.h, size * 1.0 * 4 + 40) && node.scrollWidth <= box.w + 1) break;
    }
    return { ...p, node, words };
  });
  const last = phrases.length ? phrases[phrases.length - 1].end : 0;
  const signAt = Math.min(DURATION - 1.4, Math.max(last + 0.1, DURATION - 2.2));

  /* ---------- sign-off ---------- */
  const sign = css(el("div", "abs", area), { left: 0, top: 0, width: box.w + "px", display: "flex", flexDirection: "column", gap: "26px", visibility: "hidden" });
  const signRow = css(el("div", "", sign), { display: "flex", alignItems: "center", gap: "22px" });
  const signMark = el("div", "", signRow, rotor(92, "ss"));
  const signWord = B.line(signRow, "S3DAT NEWS", { font: "900 92px/1 Archivo", fontStretch: "78%", color: "#ffffff" });
  const signLabel = B.line(sign, "FULL STORY", { font: "600 30px/1 'Space Grotesk'", color: "rgba(255,255,255,0.7)", letterSpacing: "0.16em", display: "block" });
  const signUrl = css(B.line(sign, "news.s3dat.com", { font: "700 64px/1 'Space Grotesk'", color: popInk, display: "inline-block" }), { background: pop, padding: "14px 26px 18px", borderRadius: "16px", alignSelf: "flex-start" });

  return {
    frame(t) {
      // Header and progress.
      const h = sp(t, 0.05, "snap");
      header.style.opacity = seg(t, 0.05, 0.3);
      header.style.transform = `translateY(${(1 - Math.min(1, h)) * -24}px)`;
      headMark.style.transform = `rotate(${t * 24}deg)`;
      fill.style.transform = `scaleX(${seg(t, 0, DURATION)})`;
      glow.style.opacity = 0.75 + 0.25 * Math.sin(t * 1.3);

      // One phrase on screen at a time: words rise in, light up as spoken, then the phrase lifts away.
      phrases.forEach((p, i) => {
        const next = i < phrases.length - 1 ? phrases[i + 1].start : signAt;
        const on = t >= p.start - 0.14 && t < next + 0.05 && t < signAt + 0.2;
        p.node.style.visibility = on ? "visible" : "hidden";
        if (!on) return;
        const out = ease.inCubic(seg(t, next - 0.12, next + 0.05));
        p.node.style.opacity = 1 - out;
        p.node.style.transform = `translateY(${-out * 70}px)`;
        p.words.forEach((w, j) => {
          const rise = sp(t, p.start - 0.14 + j * 0.035, "snap");
          w.inner.style.transform = `translateY(${(1 - Math.min(1.08, rise)) * 105}%)`;
          const lit = seg(t, w.start - 0.04, w.start + 0.08);
          if (w.accent) {
            const k = sp(t, w.start - 0.04, "pop");
            w.inner.style.background = alpha(pop, lit);
            w.inner.style.color = lit > 0.5 ? popInk : `rgba(255,255,255,${lerp(0.4, 1, lit)})`;
            w.inner.style.transform += ` scale(${1 + 0.08 * Math.sin(Math.min(1, k) * Math.PI)})`;
          } else {
            w.inner.style.color = `rgba(255,255,255,${lerp(0.4, 1, lit)})`;
          }
        });
      });

      // Sign-off.
      const s = t >= signAt;
      sign.style.visibility = s ? "visible" : "hidden";
      if (s) {
        const p = sp(t, signAt, "pop");
        signMark.style.transform = `rotate(${(1 - Math.min(1, p)) * -140 + (t - signAt) * 30}deg) scale(${Math.max(0, Math.min(1.1, p))})`;
        signWord.style.opacity = seg(t, signAt + 0.08, signAt + 0.25);
        signWord.style.transform = `translateX(${(1 - ease.outExpo(seg(t, signAt + 0.08, signAt + 0.5))) * -40}px)`;
        signLabel.style.opacity = 0.7 * seg(t, signAt + 0.2, signAt + 0.4);
        const u = sp(t, signAt + 0.26, "pop");
        signUrl.style.transform = `translateY(${(1 - Math.min(1, u)) * 50}px) scale(${0.9 + 0.1 * Math.min(1.05, u)})`;
        signUrl.style.opacity = seg(t, signAt + 0.26, signAt + 0.4);
      }
    },
  };
};
