#!/usr/bin/env node
/**
 * S3DAT News banner engine — renders one story banner from stories/.../spec.json.
 *
 *   node render.mjs <story-dir> [--format wide|hd|social] [--out file.mp4] [--poster poster.webp]
 *                   [--sheet sheet.jpg] [--template name] [--blur n] [--frame s] [--frames a,b,c]
 *   node render.mjs <story-dir> --add-voice tall.mp4 --out voiced.mp4
 *
 * wide (site): 1080x608, 30 fps, 8 s, H.264, silent, at most 1.6 MB, plus a WebP poster.
 * hd (X, Threads, Bluesky, Mastodon, Facebook, LinkedIn, Pinterest, Substack): the same layout
 *   rendered at 1920x1080 device pixels (deviceScaleFactor 16/9), with the synthesised soundtrack.
 * social (Instagram Reels): 1080x1920 (9:16), 15 s: the reel, a composition of its own (social.js:
 *   headline hook, beats cut to the voice-over, kinetic captions, sign-off), with a Fish Audio voice-over
 *   (FISH_API_KEY, FISH_VOICE_ID) over the soundtrack. The script may carry S2 delivery cues such as
 *   [calm]; without a key the cut is silent apart from the soundtrack and the type is timed by estimate.
 * Motion blur: every frame is the average of --blur samples across a 180° shutter (default 8 for the
 * site banner and the hd cut, 6 for the reel).
 * --add-voice mixes the story's voice-over into a 9:16 cut rendered without one. The video is copied
 *   as is.
 * Needs Node 20+, ffmpeg, Chrome or Chromium, and `npm ci` in this folder.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { synthesize } from "./audio.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const FORMATS = {
  wide: { layout: "wide", width: 1080, height: 608, scale: 1, seconds: 8, blur: 8, sound: false,
    encode: { width: 1080, height: 608, maxBytes: 1_600_000, crf: 22, maxrate: "1700k" } },
  hd: { layout: "wide", width: 1080, height: 608, scale: 16 / 9, seconds: 8, blur: 8, sound: true,
    encode: { width: 1920, height: 1080, maxBytes: 24_000_000, crf: 17, maxrate: "16000k" } },
  social: { layout: "social", width: 1080, height: 1920, scale: 1, seconds: 15, blur: 6, sound: true,
    encode: { width: 1080, height: 1920, maxBytes: 24_000_000, crf: 18, maxrate: "12000k" } },
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
    format: { name: FORMATS[format].layout, width: FORMATS[format].width, height: FORMATS[format].height, seconds: FORMATS[format].seconds },
    story: readStory(dir),
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

/** The parts of story.json the social cut uses: topic, spec-sheet facts and the voice-over script. */
function readStory(dir) {
  const file = join(dir, "story.json");
  if (!existsSync(file)) return { facts: [], voiceover: "", topic: "" };
  const story = JSON.parse(readFileSync(file, "utf8"));
  const facts = Array.isArray(story.facts) ? story.facts.slice(0, 6).map((f) => ({ label: String(f.label || ""), value: String(f.value || "") })) : [];
  let voiceover = story.social && typeof story.social.voiceover === "string" ? story.social.voiceover : "";
  if (!voiceover && typeof story.lede === "string") {
    // Fallback: the lede, cut at a sentence end before about 36 words.
    const sentences = story.lede.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) { if ((voiceover + " " + sentence).trim().split(/\s+/).length > 36) break; voiceover = (voiceover + " " + sentence).trim(); }
  }
  return { facts, voiceover, topic: typeof story.topic === "string" ? story.topic.replace(/-/g, " ") : "" };
}

/** Phrase-by-phrase timings for the kinetic captions. The voice starts at 0.4 s and runs `spoken`
 *  seconds (after voiceMix's speed-up); each word gets a share of that time by its length, with
 *  extra room after sentence ends and [break]/[pause] cues. [emphasis] and words with digits are
 *  accents. Phrases break at sentence ends, at commas once three words are in, and at seven words. */
function captions(script, seconds) {
  const words = [];
  let accentNext = false, pause = 0;
  for (const m of String(script).matchAll(/\[([^\]]+)\]|([^\s\[\]]+)/g)) {
    if (m[1]) {
      const cue = m[1].trim().toLowerCase();
      if (cue === "emphasis") accentNext = true;
      else if (cue === "long-break") pause += 14;
      else if (cue === "break" || cue === "pause") pause += 7;
      continue;
    }
    words.push({ text: m[2], accent: accentNext || /\d/.test(m[2]), pause });
    accentNext = false;
    pause = 0;
  }
  if (!words.length) return [];
  const tempo = Math.min(1.15, Math.max(1, seconds / 13.6));
  const spoken = seconds ? seconds / tempo : words.length / 2.6;
  const weight = (w) => w.text.length + 1 + (/[.!?]["”’)]?$/.test(w.text) ? 5 : /[,;:]$/.test(w.text) ? 2 : 0);
  const total = words.reduce((sum, w) => sum + w.pause + weight(w), 0);
  let acc = 0;
  for (const w of words) {
    acc += w.pause;
    w.start = 0.4 + (spoken * acc) / total;
    acc += weight(w);
    w.end = 0.4 + (spoken * acc) / total;
  }
  const phrases = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const nextPause = i + 1 < words.length && words[i + 1].pause > 0;
    if (/[.!?]["”’)]?$/.test(w.text) || cur.length >= 7 || (cur.length >= 3 && (/[,;:—]$/.test(w.text) || nextPause)) || i === words.length - 1) {
      phrases.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur.map(({ text, accent, start }) => ({ text, accent, start })) });
      cur = [];
    }
  });
  return phrases;
}

/** Fish Audio text-to-speech; returns the mp3 path, or null without a key or script. */
async function voiceover(text, out) {
  const key = process.env.FISH_API_KEY;
  if (!key || !text) return null;
  // S2 reads [bracket] cues in the text as delivery directions; they are not spoken.
  const body = { text, format: "mp3", mp3_bitrate: 192, normalize: true, latency: "normal", language: "en" };
  if (process.env.FISH_VOICE_ID) body.reference_id = process.env.FISH_VOICE_ID;
  const res = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", model: process.env.FISH_MODEL || "s2.1-pro-free" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Fish Audio TTS failed with HTTP ${res.status}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  return out;
}

/** The voice starts at 0.4 s and must end before the end card (14 s); long reads are sped up
 *  slightly. The soundtrack ducks under the voice; the mix is normalised to -14 LUFS. */
function voiceMix(bed, voice, seconds) {
  const tempo = Math.min(1.15, Math.max(1, seconds / 13.6));
  return `[${bed}]volume=0.6[bed];[${voice}]atempo=${tempo.toFixed(3)},adelay=400|400,apad,asplit=2[vo1][vo2];` +
    `[bed][vo1]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=300[duck];` +
    `[duck][vo2]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]`;
}

async function addVoice(dir, input, out) {
  const tmp = mkdtempSync(join(tmpdir(), "s3voice-"));
  try {
    const voice = await voiceover(readStory(dir).voiceover, join(tmp, "voice.mp3"));
    if (!voice) throw new Error("--add-voice needs FISH_API_KEY and a voice-over script");
    const seconds = await probeSeconds(voice);
    const target = resolve(out || input.replace(/\.mp4$/, "-voiced.mp4"));
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", resolve(input), "-i", voice, "-filter_complex", voiceMix("0:a", "1:a", seconds),
      "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-shortest", target]);
    console.log(JSON.stringify({ out: target, voice: Number(seconds.toFixed(2)), bytes: statSync(target).size }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function probeSeconds(file) {
  return new Promise((ok) => {
    const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
    let out = "";
    p.stdout.on("data", (c) => (out += c));
    p.on("close", () => ok(parseFloat(out) || 0));
  });
}

/** BROWSER=chromium (default), firefox or webkit: the Playwright engine that draws the frames.
 *  Firefox and WebKit are for machines where Chromium cannot start; compare their frames first. */
const BROWSER = ["chromium", "firefox", "webkit"].includes(process.env.BROWSER) ? process.env.BROWSER : "chromium";

async function loadChromium() {
  if (process.env.PLAYWRIGHT_MODULE) return (await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href))[BROWSER];
  try {
    return (await import("playwright-core"))[BROWSER];
  } catch {
    return (await import("playwright"))[BROWSER];
  }
}

/** CHROME_CHANNEL=chrome uses an installed Google Chrome; CHROME_PATH an explicit binary;
 *  CHROME_ARGS extra flags (space-separated), for locked-down machines. The 3D template always
 *  renders on SwiftShader so CI and laptops draw the same pixels. */
function launchOptions(template) {
  if (BROWSER !== "chromium") {
    const o = process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {};
    // Headless Firefox without a GPU refuses WebGL unless forced (the 3D template needs it).
    if (BROWSER === "firefox") o.firefoxUserPrefs = { "webgl.force-enabled": true, "webgl.disabled": false, "webgl.enable-webgl2": true };
    return o;
  }
  const o = process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL } : process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  o.args = (process.env.CHROME_ARGS || "").split(/\s+/).filter(Boolean);
  if (template === "monolith") o.args.push("--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist");
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
  if (a["add-voice"]) return addVoice(dir, String(a["add-voice"]), a.out);
  const format = FORMATS[a.format] ? a.format : "wide";
  const F = FORMATS[format];
  const data = await buildData(dir, a.template, format);
  const tmp = mkdtempSync(join(tmpdir(), "s3news-"));
  let voice = null, voiceSeconds = 0;
  if (format === "social") {
    voice = await voiceover(data.story.voiceover, join(tmp, "voice.mp3"));
    if (voice) voiceSeconds = await probeSeconds(voice);
    data.story.captions = captions(data.story.voiceover, voiceSeconds);
  }
  const chromium = await loadChromium();
  const browser = await chromium.launch(launchOptions(data.template));
  const page = await browser.newPage({ viewport: { width: F.width, height: F.height }, deviceScaleFactor: F.scale });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await serve(page);
  await page.goto(`${ORIGIN}/stage.html`);
  const { poster, cues } = await page.evaluate((d) => window.__setup(d), data).catch((e) => { throw new Error(`setup failed: ${e.message} ${errors.join(" | ")}`); });
  const shot = async (t, quality = 92) => { await page.evaluate((x) => window.__frame(x), t); return page.screenshot({ type: "jpeg", quality }); };
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
      const tw = F.layout === "social" ? 360 : 540, th = Math.round((tw * F.height) / F.width);
      await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", `scale=${tw}:${th},tile=${cols}x${rows}:padding=4:color=gray`, "-frames:v", "1", resolve(a.sheet || join(dir, "frames.jpg"))]);
    }
    await done();
    return;
  }

  // Motion blur: N samples across a 180° shutter centred on each frame time.
  const DURATION = F.seconds;
  const N = Math.max(1, Math.min(16, Number(a.blur) || F.blur));
  const frames = DURATION * FPS;
  let k = 0;
  for (let i = 0; i < frames; i++) {
    for (let s = 0; s < N; s++) {
      const t = (i + (N === 1 ? 0 : ((s + 0.5) / N - 0.5) * 0.5)) / FPS;
      writeFileSync(join(tmp, `f${String(k++).padStart(5, "0")}.jpg`), await shot(t, N > 1 ? 92 : 94));
    }
  }
  await page.evaluate((x) => window.__frame(x), poster);
  const png = (await page.screenshot({ type: "png" })).toString("base64");
  // Encode the poster as WebP in Chromium (so the ffmpeg build needs no libwebp), at layout size.
  const webp = await page.evaluate(async ([b64, w, h]) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    return cv.toDataURL("image/webp", 0.82).split(",")[1];
  }, [png, F.width, F.height]);
  if (a.sheet) {
    const picks = Array.from({ length: 16 }, (_, i) => Math.min(frames - 1, Math.round((i * DURATION / 16 + 0.25) * FPS)) * N + Math.floor(N / 2));
    const list = join(tmp, "sheet.txt");
    writeFileSync(list, picks.map((p) => `file 'f${String(p).padStart(5, "0")}.jpg'`).join("\n"));
    const tw = F.layout === "social" ? 270 : 360, th = Math.round((tw * F.height) / F.width);
    await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", `scale=${tw}:${th},tile=4x4`, "-frames:v", "1", resolve(a.sheet)]);
  }

  const audio = join(tmp, "sound.wav");
  if (F.sound) writeFileSync(audio, synthesize(cues, { seconds: DURATION, seed: data.seed }));
  const blend = N > 1 ? `tmix=frames=${N},select='not(mod(n+1\\,${N}))',setpts=N/(${FPS}*TB),` : "";
  /** Encode the frames at one size; raises the CRF until the file fits. */
  const encode = async (out, E, sound) => {
    let crf = E.crf, size = 0;
    for (;;) {
      const argv = ["-y", "-loglevel", "error", "-framerate", String(FPS * N), "-i", join(tmp, "f%05d.jpg")];
      // JPEG frames are full-range BT.601: convert to the limited-range BT.709 every player expects.
      // The hd render is 1920x1081 device pixels; square pixels keep players from stretching it back.
      const video = `${blend}scale=${E.width}:${E.height}:flags=lanczos:in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,setsar=1`;
      if (sound && voice) {
        argv.push("-i", audio, "-i", voice, "-filter_complex", `[0:v]${video}[v];` + voiceMix("1:a", "2:a", voiceSeconds), "-map", "[v]", "-map", "[a]");
      } else if (sound) {
        argv.push("-i", audio, "-filter_complex", `[0:v]${video}[v];[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]`, "-map", "[v]", "-map", "[a]");
      } else argv.push("-vf", video);
      argv.push(
        "-r", String(FPS), "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", String(crf),
        "-maxrate", E.maxrate, "-bufsize", `${parseInt(E.maxrate, 10) * 2}k`,
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-g", String(FPS * 2), "-t", String(DURATION),
      );
      argv.push(...(sound ? ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"] : ["-an"]), out);
      await run("ffmpeg", argv);
      size = statSync(out).size;
      if (size <= E.maxBytes || crf >= 32) return { bytes: size, crf };
      crf += 2;
    }
  };

  const out = resolve(a.out || join(dir, format === "wide" ? "banner.mp4" : `banner-${format}.mp4`));
  const encoded = await encode(out, F.encode, F.sound);
  const result = { out, template: data.template, format, ...encoded, width: F.encode.width, height: F.encode.height, fps: FPS, seconds: DURATION, blur: N, cues: cues.length, voice: voice ? Number(voiceSeconds.toFixed(2)) : null };
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
