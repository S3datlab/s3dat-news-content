#!/usr/bin/env node
/**
 * S3DAT News banner engine v2 — renders one story banner from stories/.../spec.json.
 *
 *   node render.mjs <story-dir> [--out banner.mp4] [--poster poster.webp] [--sheet sheet.jpg]
 *                   [--template name] [--frame seconds]
 *
 * Output: 1080x608, 30 fps, 8 s, H.264 yuv420p, no audio, at most 1.6 MB; WebP poster.
 * Needs Node 20+, ffmpeg, Chrome or Chromium, and `npm ci` in this folder (playwright-core, simple-icons).
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 1080, H = 608, FPS = 30, DURATION = 8, MAX_BYTES = 1_600_000;
export const TEMPLATES = ["paper", "ink", "brand", "collage", "versus", "portrait", "data", "poster", "cinematic", "cutout"];
const MOODS = ["up", "down", "shock", "calm"];
const FIELDS = ["white", "black", "brand", "pop"];
const MAX_ASSET_BYTES = 900_000;
const HEX = /^#[0-9a-f]{6}$/i;

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i];
    else out._.push(a);
  }
  return out;
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
function dataUrl(file) {
  const type = MIME[extname(file).toLowerCase()];
  if (!type) throw new Error(`Unsupported image type: ${file}`);
  if (statSync(file).size > MAX_ASSET_BYTES) throw new Error(`${file} is larger than ${MAX_ASSET_BYTES} bytes`);
  return `data:${type};base64,${readFileSync(file).toString("base64")}`;
}

/** Keep only drawing elements of an SVG logo: no scripts, event handlers, external references or
 *  CSS (a <style> block would leak into the page and beat the recolouring). */
function sanitizeSvg(svg) {
  let out = svg
    .replace(/<\?xml[^>]*>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<(script|style|foreignObject|iframe|image|title|desc|metadata)[\s\S]*?(<\/\1>|\/>)/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    // <use> may repeat a shape of the same file (#id); any other reference is dropped.
    .replace(/\s(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "")
    .replace(/\s(class|style)\s*=\s*("[^"]*"|'[^']*')/gi, "");
  // Without a viewBox the drawing cannot scale once width/height are removed: derive it.
  const open = out.match(/<svg\b[^>]*>/i);
  if (open && !/viewBox=/i.test(open[0])) {
    const w = parseFloat((open[0].match(/\swidth=["']?([0-9.]+)/i) || [])[1]);
    const h = parseFloat((open[0].match(/\sheight=["']?([0-9.]+)/i) || [])[1]);
    if (w > 0 && h > 0) out = out.replace(open[0], open[0].replace(/<svg\b/i, `<svg viewBox="0 0 ${w} ${h}"`));
  }
  return out;
}

const LIBRARY = JSON.parse(readFileSync(join(HERE, "logos", "manifest.json"), "utf8"));

async function loadIcons() {
  try {
    return await import("simple-icons");
  } catch {
    const fallback = process.env.SIMPLE_ICONS_MODULE;
    if (fallback) return import(pathToFileURL(fallback).href);
    throw new Error("simple-icons is not installed (npm i in tools/news-banner-v2)");
  }
}

async function resolveBrands(spec, dir) {
  const icons = await loadIcons();
  return (spec.brands || []).slice(0, 2).map((b) => {
    const brand = { name: String(b.name || "").slice(0, 40) };
    if (b.color !== undefined && !HEX.test(b.color)) throw new Error(`brand color must be #rrggbb, got ${b.color}`);
    if (b.icon) {
      const key = "si" + b.icon.charAt(0).toUpperCase() + b.icon.slice(1).replace(/[^a-z0-9]/gi, "").toLowerCase();
      const icon = Object.values(icons).find((i) => i && i.slug === b.icon) || icons[key];
      const own = Object.prototype.hasOwnProperty.call(LIBRARY, b.icon) ? LIBRARY[b.icon] : null;
      if (icon) {
        brand.svgPath = icon.path;
        brand.color = b.color || "#" + icon.hex;
        brand.name = brand.name || icon.title;
      } else if (own) {
        // Brands simple-icons does not carry, from logos/ (manifest.json records each source).
        brand.svg = sanitizeSvg(readFileSync(join(HERE, "logos", own.file), "utf8"));
        brand.recolor = own.recolor !== false;
        brand.color = b.color || own.color;
        brand.name = brand.name || own.name;
      } else throw new Error(`No icon "${b.icon}" in simple-icons or logos/; provide a logo file instead`);
    } else if (b.logo) {
      const file = join(dir, b.logo);
      if (extname(file).toLowerCase() === ".svg") {
        brand.svg = sanitizeSvg(readFileSync(file, "utf8"));
        brand.recolor = b.recolor !== false;
      } else brand.image = dataUrl(file);
      brand.color = b.color || "#111111";
    } else brand.color = b.color || "#111111";
    return brand;
  });
}

async function buildData(dir, override) {
  const spec = JSON.parse(readFileSync(join(dir, "spec.json"), "utf8"));
  const template = override || spec.template;
  if (!TEMPLATES.includes(template)) throw new Error(`template must be one of ${TEMPLATES.join(", ")}`);
  const headline = (spec.headline || []).map((s) => String(s).toUpperCase().trim()).filter(Boolean);
  if (headline.length < 1 || headline.length > 3) throw new Error("headline needs 1-3 lines");
  return {
    template,
    headline,
    accent: Number.isInteger(spec.accent) ? spec.accent : headline.length - 1,
    stat: spec.stat && spec.stat.value ? { value: String(spec.stat.value), label: String(spec.stat.label || "").toUpperCase() } : null,
    brands: await resolveBrands(spec, dir),
    art: spec.art ? dataUrl(join(dir, spec.art)) : null,
    person: spec.person && spec.person.src ? { image: dataUrl(join(dir, spec.person.src)), name: spec.person.name || "" } : null,
    cutouts: (spec.cutouts || []).slice(0, 4).map((c) => ({ image: dataUrl(join(dir, c.src)), role: c.role === "hero" ? "hero" : "prop" })),
    mood: MOODS.includes(spec.mood) ? spec.mood : "calm",
    bg: FIELDS.includes(spec.bg) ? spec.bg : null,
    seed: Number(spec.seed) || 7,
  };
}

async function loadChromium() {
  if (process.env.PLAYWRIGHT_MODULE) return (await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)).chromium;
  try {
    return (await import("playwright-core")).chromium;
  } catch {
    return (await import("playwright")).chromium;
  }
}

/** CHROME_CHANNEL=chrome uses an installed Google Chrome; CHROME_PATH an explicit binary. */
function launchOptions() {
  if (process.env.CHROME_CHANNEL) return { channel: process.env.CHROME_CHANNEL };
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH };
  return {};
}

function run(cmd, argv, input) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, argv, { stdio: [input ? "pipe" : "ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (c) => (err += c));
    p.on("close", (code) => (code === 0 ? ok() : fail(new Error(`${cmd} failed: ${err.slice(-400)}`))));
    if (input) input(p.stdin);
  });
}

async function main() {
  const a = args(process.argv.slice(2));
  const dir = resolve(a._[0] || ".");
  const data = await buildData(dir, a.template);
  const chromium = await loadChromium();
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(pathToFileURL(join(HERE, "stage.html")).href);
  const { poster } = await page.evaluate((d) => window.__setup(d), data);
  const shot = async (t) => { await page.evaluate((x) => window.__frame(x), t); return page.screenshot({ type: "jpeg", quality: 94 }); };

  if (a.frames) {
    // Quick look: a contact sheet of chosen moments, no video. --frames 0.6,1.5,3,5
    const times = String(a.frames).split(",").map(Number);
    const tmp = mkdtempSync(join(tmpdir(), "s3news-"));
    for (let i = 0; i < times.length; i++) writeFileSync(join(tmp, `q${i}.jpg`), await shot(times[i]));
    await browser.close();
    const cols = Math.min(4, times.length), rows = Math.ceil(times.length / cols);
    const list = join(tmp, "q.txt");
    writeFileSync(list, times.map((_, i) => `file 'q${i}.jpg'`).join("\n"));
    await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", `scale=540:304,tile=${cols}x${rows}:padding=4:color=gray`, "-frames:v", "1", resolve(a.sheet || join(dir, "frames.jpg"))]);
    rmSync(tmp, { recursive: true, force: true });
    return;
  }
  if (a.frame !== undefined) {
    writeFileSync(a.poster || join(dir, `frame-${a.frame}.jpg`), await shot(Number(a.frame)));
    await browser.close();
    return;
  }
  const tmp = mkdtempSync(join(tmpdir(), "s3news-"));
  const frames = DURATION * FPS;
  for (let i = 0; i < frames; i++) writeFileSync(join(tmp, `f${String(i).padStart(4, "0")}.jpg`), await shot(i / FPS));
  await page.evaluate((x) => window.__frame(x), poster);
  // Encode the poster as WebP in Chromium, so the ffmpeg build needs no libwebp.
  const png = (await page.screenshot({ type: "png" })).toString("base64");
  const webp = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    cv.getContext("2d").drawImage(img, 0, 0);
    return cv.toDataURL("image/webp", 0.82).split(",")[1];
  }, png);
  if (a.sheet) {
    const picks = Array.from({ length: 16 }, (_, i) => Math.min(frames - 1, Math.round((i * DURATION / 16 + 0.25) * FPS)));
    const list = join(tmp, "sheet.txt");
    writeFileSync(list, picks.map((p) => `file 'f${String(p).padStart(4, "0")}.jpg'`).join("\n"));
    await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "scale=360:203,tile=4x4", "-frames:v", "1", resolve(a.sheet)]);
  }
  await browser.close();

  const out = resolve(a.out || join(dir, "banner.mp4"));
  let crf = 22, size = 0;
  for (;;) {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(tmp, "f%04d.jpg"), "-an", "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", String(crf), "-maxrate", "1700k", "-bufsize", "3400k",
      // JPEG frames are full-range BT.601: convert to the limited-range BT.709 every player expects.
      "-vf", "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-g", String(FPS * 2), out]);
    size = statSync(out).size;
    if (size <= MAX_BYTES || crf >= 32) break;
    crf += 2;
  }
  const posterOut = resolve(a.poster || join(dir, "poster.webp"));
  writeFileSync(posterOut, Buffer.from(webp, "base64"));
  rmSync(tmp, { recursive: true, force: true });
  console.log(JSON.stringify({ out, poster: posterOut, template: data.template, bytes: size, crf, width: W, height: H, fps: FPS, seconds: DURATION, poster_bytes: statSync(posterOut).size }));
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
