#!/usr/bin/env node
/**
 * S3DAT News banner engine — renders one story banner from stories/.../spec.json.
 *
 *   node render.mjs <story-dir> [--format wide|social] [--out file.mp4] [--poster poster.webp]
 *                   [--sheet sheet.jpg] [--template name] [--blur n] [--frame s] [--frames a,b,c]
 *
 * wide (site):     1080x608, 30 fps, 8 s, H.264 yuv420p, silent, at most 1.6 MB, plus a WebP poster.
 * social (X, LinkedIn): 1080x1350 (4:5) with a soundtrack synthesised from the template's cues.
 * Motion blur: every frame is the average of --blur samples across a 180° shutter (default 8).
 * Needs Node 20+, ffmpeg, Chrome or Chromium, and `npm ci` in this folder.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { synthesize } from "./audio.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FPS = 30, DURATION = 8;
const FORMATS = {
  wide: { width: 1080, height: 608, maxBytes: 1_600_000, crf: 22 },
  social: { width: 1080, height: 1350, maxBytes: 6_000_000, crf: 20 },
};
export const TEMPLATES = ["paper", "ink", "brand", "collage", "versus", "portrait", "data", "poster", "cinematic", "cutout", "monolith"];
const MOODS = ["up", "down", "shock", "calm"];
const FIELDS = ["white", "black", "brand", "pop"];
const MAX_ASSET_BYTES = 900_000;
const HEX = /^#[0-9a-f]{6}$/i;
const ORIGIN = "http://banner.local";

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i];
    else out._.push(a);
  }
  return out;
}

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".ttf": "font/ttf", ".txt": "text/plain",
};
function dataUrl(file) {
  const type = MIME[extname(file).toLowerCase()];
  if (!type || !type.startsWith("image/")) throw new Error(`Unsupported image type: ${file}`);
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
    throw new Error("simple-icons is not installed (npm ci in tools/news-banner-v2)");
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

async function buildData(dir, override, format) {
  const spec = JSON.parse(readFileSync(join(dir, "spec.json"), "utf8"));
  const template = override || spec.template;
  if (!TEMPLATES.includes(template)) throw new Error(`template must be one of ${TEMPLATES.join(", ")}`);
  const headline = (spec.headline || []).map((s) => String(s).toUpperCase().trim()).filter(Boolean);
  if (headline.length < 1 || headline.length > 3) throw new Error("headline needs 1-3 lines");
  return {
    template,
    format: { name: format, width: FORMATS[format].width, height: FORMATS[format].height },
    headline,
    accent: Number.isInteger(spec.accent) ? spec.accent : headline.length - 1,
    stat: spec.stat && spec.stat.value ? { value: String(spec.stat.value), label: String(spec.stat.label || "").toUpperCase() } : null,
    brands: await resolveBrands(spec, dir),
    art: spec.art ? dataUrl(join(dir, spec.art)) : null,
    person: spec.person && spec.person.src ? { image: dataUrl(join(dir, spec.person.src)), name: spec.person.name || "" } : null,
    cutouts: (spec.cutouts || []).slice(0, 4).map((c) => ({
      image: dataUrl(join(dir, c.src)),
      role: c.role === "hero" ? "hero" : "prop",
      poses: c.role === "hero" ? (c.poses || []).slice(0, 2).map((p) => ({ image: dataUrl(join(dir, p)) })) : [],
    })),
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

/** CHROME_CHANNEL=chrome uses an installed Google Chrome; CHROME_PATH an explicit binary. The 3D
 *  template always renders on SwiftShader so CI and laptops draw the same pixels. */
function launchOptions(template) {
  const o = process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL } : process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  if (template === "monolith") o.args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  return o;
}

/** Serve the engine folder (and node_modules for three.js) on a private origin, so ES modules load. */
async function serve(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = normalize(join(HERE, path));
    if (!file.startsWith(HERE + sep) || !existsSync(file) || !statSync(file).isFile()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: MIME[extname(file).toLowerCase()] || "application/octet-stream", body: readFileSync(file) });
  });
}

function run(cmd, argv) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (c) => (err += c));
    p.on("close", (code) => (code === 0 ? ok() : fail(new Error(`${cmd} failed: ${err.slice(-600)}`))));
  });
}

async function main() {
  const a = args(process.argv.slice(2));
  const dir = resolve(a._[0] || ".");
  const format = a.format === "social" ? "social" : "wide";
  const F = FORMATS[format];
  const data = await buildData(dir, a.template, format);
  const chromium = await loadChromium();
  const browser = await chromium.launch(launchOptions(data.template));
  const page = await browser.newPage({ viewport: { width: F.width, height: F.height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await serve(page);
  await page.goto(`${ORIGIN}/stage.html`);
  const { poster, cues } = await page.evaluate((d) => window.__setup(d), data).catch((e) => { throw new Error(`setup failed: ${e.message} ${errors.join(" | ")}`); });
  const shot = async (t, quality = 92) => { await page.evaluate((x) => window.__frame(x), t); return page.screenshot({ type: "jpeg", quality }); };
  const tmp = mkdtempSync(join(tmpdir(), "s3news-"));
  const done = async () => { await browser.close(); rmSync(tmp, { recursive: true, force: true }); };

  if (a.frames || a.frame !== undefined) {
    // Quick look without motion blur: one frame, or a contact sheet of chosen moments.
    const times = String(a.frames || a.frame).split(",").map(Number);
    for (let i = 0; i < times.length; i++) writeFileSync(join(tmp, `q${i}.jpg`), await shot(times[i], 94));
    if (times.length === 1) writeFileSync(resolve(a.poster || a.sheet || join(dir, `frame-${times[0]}.jpg`)), readFileSync(join(tmp, "q0.jpg")));
    else {
      const cols = Math.min(4, times.length), rows = Math.ceil(times.length / cols);
      const list = join(tmp, "q.txt");
      writeFileSync(list, times.map((_, i) => `file 'q${i}.jpg'`).join("\n"));
      const tw = format === "social" ? 360 : 540, th = Math.round((tw * F.height) / F.width);
      await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", `scale=${tw}:${th},tile=${cols}x${rows}:padding=4:color=gray`, "-frames:v", "1", resolve(a.sheet || join(dir, "frames.jpg"))]);
    }
    await done();
    return;
  }

  // Motion blur: N samples across a 180° shutter centred on each frame time.
  const N = Math.max(1, Math.min(12, Number(a.blur) || 8));
  const frames = DURATION * FPS;
  let k = 0;
  for (let i = 0; i < frames; i++) {
    for (let s = 0; s < N; s++) {
      const t = (i + (N === 1 ? 0 : ((s + 0.5) / N - 0.5) * 0.5)) / FPS;
      writeFileSync(join(tmp, `f${String(k++).padStart(5, "0")}.jpg`), await shot(t, N > 1 ? 90 : 94));
    }
  }
  await page.evaluate((x) => window.__frame(x), poster);
  const png = (await page.screenshot({ type: "png" })).toString("base64");
  // Encode the poster as WebP in Chromium, so the ffmpeg build needs no libwebp.
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
    const picks = Array.from({ length: 16 }, (_, i) => Math.min(frames - 1, Math.round((i * DURATION / 16 + 0.25) * FPS)) * N + Math.floor(N / 2));
    const list = join(tmp, "sheet.txt");
    writeFileSync(list, picks.map((p) => `file 'f${String(p).padStart(5, "0")}.jpg'`).join("\n"));
    const tw = format === "social" ? 270 : 360, th = Math.round((tw * F.height) / F.width);
    await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", `scale=${tw}:${th},tile=4x4`, "-frames:v", "1", resolve(a.sheet)]);
  }

  let audio = null;
  if (format === "social") {
    audio = join(tmp, "sound.wav");
    writeFileSync(audio, synthesize(cues, { seconds: DURATION, seed: data.seed }));
  }

  const out = resolve(a.out || join(dir, format === "social" ? "banner-social.mp4" : "banner.mp4"));
  const blend = N > 1 ? `tmix=frames=${N},select='not(mod(n+1\\,${N}))',setpts=N/(${FPS}*TB),` : "";
  let crf = F.crf, size = 0;
  for (;;) {
    const argv = ["-y", "-loglevel", "error", "-framerate", String(FPS * N), "-i", join(tmp, "f%05d.jpg")];
    if (audio) argv.push("-i", audio);
    argv.push(
      // JPEG frames are full-range BT.601: convert to the limited-range BT.709 every player expects.
      "-vf", `${blend}scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p`,
      "-r", String(FPS), "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", String(crf),
      "-maxrate", format === "social" ? "6000k" : "1700k", "-bufsize", format === "social" ? "12000k" : "3400k",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", "-g", String(FPS * 2), "-t", String(DURATION),
    );
    if (audio) argv.push("-c:a", "aac", "-b:a", "160k", "-ar", "48000");
    else argv.push("-an");
    argv.push(out);
    await run("ffmpeg", argv);
    size = statSync(out).size;
    if (size <= F.maxBytes || crf >= 32) break;
    crf += 2;
  }
  const result = { out, template: data.template, format, bytes: size, crf, width: F.width, height: F.height, fps: FPS, seconds: DURATION, blur: N, cues: cues.length };
  if (format === "wide") {
    const posterOut = resolve(a.poster || join(dir, "poster.webp"));
    writeFileSync(posterOut, Buffer.from(webp, "base64"));
    Object.assign(result, { poster: posterOut, poster_bytes: statSync(posterOut).size });
  }
  await done();
  if (errors.length) console.error("page errors:", errors.join(" | "));
  console.log(JSON.stringify(result));
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
