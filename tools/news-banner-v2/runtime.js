/* S3DAT News banner engine v2 — shared runtime. Every template is a pure function of time:
   setup(ctx) builds the DOM once, frame(t) sets every style for time t (seconds). No CSS
   animations or timers, so frame-by-frame capture is exact and repeatable. */
(function () {
  const W = 1080, H = 608, DURATION = 8;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, x) => a + (b - a) * x;
  const ease = {
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inCubic: (x) => x * x * x,
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: (x, s = 1.7) => { const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
    outElastic: (x) => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  };
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const onColor = (hex) => (luminance(hex) > 0.45 ? "#0a0a0a" : "#ffffff");
  function mix(a, b, x) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return "#" + A.map((v, i) => Math.round(lerp(v, B[i], x)).toString(16).padStart(2, "0")).join("");
  }
  /** Brand colours that read on screen: near-black brands get a vivid partner colour. */
  function brandColors(brand, fallback) {
    const base = brand && brand.color ? brand.color : fallback;
    const dark = luminance(base) < 0.02;
    return { base, vivid: dark ? fallback : base, ink: onColor(base), dark };
  }
  function el(tag, cls, parent, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    if (parent) parent.appendChild(node);
    return node;
  }
  function css(node, styles) { Object.assign(node.style, styles); return node; }
  /** Largest font size (px) at which every line fits maxWidth and the block fits maxHeight. */
  function fitLines(nodes, maxWidth, maxHeight, maxSize, minSize, lineHeight = 0.9) {
    // Measure the text itself: a flex column would otherwise stretch each line to its width.
    nodes.forEach((n) => (n.style.width = "max-content"));
    let lo = minSize, hi = maxSize;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      nodes.forEach((n) => (n.style.fontSize = mid + "px"));
      const widest = Math.max(...nodes.map((n) => n.getBoundingClientRect().width / (n._scale || 1)));
      const tall = nodes.length * mid * lineHeight;
      if (widest <= maxWidth && tall <= maxHeight) lo = mid; else hi = mid;
    }
    nodes.forEach((n) => (n.style.fontSize = lo + "px"));
    return lo;
  }
  /** Poster stacking: every line grows to fill maxWidth on its own, then the stack shrinks to fit maxHeight. */
  function fitEach(nodes, maxWidth, maxHeight, maxSize, minSize, lineHeight = 0.92) {
    nodes.forEach((n) => { n.style.width = "max-content"; n.style.fontSize = "100px"; });
    const sizes = nodes.map((n) => Math.min(maxSize, (100 * maxWidth) / Math.max(1, n.getBoundingClientRect().width)));
    const total = sizes.reduce((sum, s) => sum + s * lineHeight, 0);
    const k = total > maxHeight ? maxHeight / total : 1;
    const out = sizes.map((s) => Math.max(minSize, s * k));
    nodes.forEach((n, i) => (n.style.fontSize = out[i] + "px"));
    return out;
  }
  function logoNode(brand, color, parent, cls = "logo") {
    const box = el("div", cls, parent);
    if (brand && brand.svgPath) {
      box.innerHTML = `<svg viewBox="0 0 24 24"><path fill="${color}" d="${brand.svgPath}"/></svg>`;
    } else if (brand && brand.svg) {
      box.innerHTML = brand.svg;
      const svg = box.querySelector("svg");
      const vb = svg && (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
      // Wide wordmarks would shrink to a sliver inside a square box: let them overflow sideways.
      // Wide wordmarks: keep roughly the visual area of a square mark instead of shrinking to a
      // sliver inside the square box (they may overflow it sideways).
      const aspect = vb && vb.length === 4 ? vb[2] / vb[3] : 1;
      if (aspect > 1.25) { box.classList.add("wide"); box.style.setProperty("--w", Math.min(130, Math.sqrt(0.45 * aspect) * 100).toFixed(1) + "%"); }
      if (svg) { svg.removeAttribute("width"); svg.removeAttribute("height"); if (color) svg.querySelectorAll("path,circle,rect,polygon,ellipse").forEach((p) => { if (brand.recolor !== false) p.setAttribute("fill", color); }); }
    } else if (brand && brand.image) {
      box.innerHTML = `<img src="${brand.image}" alt="">`;
    } else if (brand) {
      const word = el("div", "", box);
      word.textContent = brand.name;
      css(word, { font: "800 64px/1 Archivo", color, whiteSpace: "nowrap", display: "grid", placeItems: "center", height: "100%" });
    }
    return box;
  }
  /** Bake a white die-cut edge into a transparent cut-out once, so frames only composite it. */
  async function bakeSticker(src) {
    const img = new Image();
    img.src = src;
    await img.decode();
    const w = Math.max(4, Math.round(Math.max(img.naturalWidth, img.naturalHeight) * 0.016));
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth + w * 2;
    cv.height = img.naturalHeight + w * 2;
    const g = cv.getContext("2d");
    for (let a = 0; a < 16; a++) g.drawImage(img, w + Math.cos((a / 16) * Math.PI * 2) * w, w + Math.sin((a / 16) * Math.PI * 2) * w);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = "source-over";
    g.drawImage(img, w, w);
    return { url: cv.toDataURL("image/png"), aspect: cv.width / cv.height };
  }
  /** A cut-out as a sticker: the baked edge version when there is one, plus one soft shadow. */
  function sticker(cut, parent, edged = true) {
    const img = el("img", "abs", parent);
    img.src = edged && cut.edged ? cut.edged : cut.image;
    img.style.filter = "drop-shadow(0 16px 18px rgba(0,0,0,.28))";
    img.style.objectFit = "contain";
    return img;
  }
  /** "$4.2B" -> { prefix: "$", value: 4.2, decimals: 1, suffix: "B" } so a stat can count up. */
  function parseStat(text) {
    const m = String(text).match(/^([^0-9-]*)(-?[0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/);
    if (!m) return null;
    const num = m[2].replace(/,/g, "");
    return { prefix: m[1], value: parseFloat(num), decimals: (num.split(".")[1] || "").length, suffix: m[3], comma: m[2].includes(",") };
  }
  function formatStat(p, x) {
    let v = (p.value * x).toFixed(p.decimals);
    if (p.comma) v = Number(v).toLocaleString("en-US", { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals });
    return p.prefix + v + p.suffix;
  }
  window.BANNER = { W, H, DURATION, clamp, seg, lerp, ease, rng, luminance, onColor, mix, brandColors, el, css, fitLines, logoNode, fitEach, bakeSticker, sticker, parseStat, formatStat, templates: {} };
})();
