#!/usr/bin/env node
// S3DAT product post card (PRODUCTS.md): 1080x1350 PNG for X, LinkedIn and Instagram.
//
//   node tools/product-card/render.mjs CARD.json [CARD.json ...]
//
// CARD.json: {"product": "s3-browser"|"s3-brain", "headline": "...", "kicker": "...",
//             "shot": "home-general.png", "fit": "cover"|"contain", "out": "products/media/<name>.png"}
// "shot" is a real product screenshot from tools/product-card/assets/ (copied from the S3DAT.com
// site repository, src/assets/products/, commit 7d2eda2). The headline is the only big text.
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const require = createRequire(join(root, 'tools/news-banner-v2/package.json'));
const {chromium} = require('playwright-core');

const PRODUCTS = {
  's3-browser': {name: 'S3 Browser', icon: 's3-browser-icon.png', accent: '#5cc8ff', line: 'Free for Mac · s3dat.com'},
  's3-brain': {name: 'S3 Brain', icon: 's3-brain-icon.png', accent: '#8ec9ff', line: 'Free for personal use · s3dat.com'},
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

function page(card) {
  const p = PRODUCTS[card.product];
  if (!p) throw Error(`Unknown product ${card.product}`);
  if (!card.headline || card.headline.length > 90) throw Error('headline is required, at most 90 characters');
  // Inlined as data URIs: a page set with setContent cannot load file:// URLs.
  const MIME = {png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', ttf: 'font/ttf'};
  const data = (file) => `data:${MIME[file.split('.').pop()]};base64,${readFileSync(file).toString('base64')}`;
  const asset = (f) => data(join(here, 'assets', f));
  const font = (f) => data(join(root, 'tools/news-banner-v2/fonts', f));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Archivo;src:url(${font('Archivo.ttf')});font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:Space;src:url(${font('SpaceGrotesk.ttf')});font-weight:300 700}
*{box-sizing:border-box;margin:0}
html,body{width:1080px;height:1350px;background:#000;overflow:hidden}
.card{position:relative;width:1080px;height:1350px;padding:84px 84px 62px;color:#fff;display:flex;flex-direction:column;
  background:radial-gradient(120% 70% at 50% 108%, ${p.accent}2e 0%, transparent 62%), #000}
.brand{display:flex;align-items:center;gap:22px;font:600 34px/1 Space;letter-spacing:.01em;color:rgba(255,255,255,.92)}
.brand img{width:68px;height:68px;border-radius:16px}
.kicker{margin-top:58px;font:700 26px/1 Space;letter-spacing:.16em;text-transform:uppercase;color:${p.accent}}
h1{margin-top:22px;font:800 84px/0.98 Archivo;font-stretch:78%;letter-spacing:-.01em;text-wrap:balance}
.shot{flex:1;min-height:0;margin:64px 0 44px;border-radius:22px;overflow:hidden;
  border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 80px rgba(0,0,0,.7);background:#0b0b0b;
  display:flex;align-items:center;justify-content:center}
.shot img{width:100%;height:100%;object-fit:cover;object-position:top center}
.shot.contain{background:#111;padding:28px}
.shot.contain img{object-fit:contain;object-position:center}
.foot{display:flex;justify-content:space-between;
  font:500 26px/1 Space;color:rgba(255,255,255,.7)}
.foot b{color:#fff;font-weight:600}
</style></head><body><div class="card">
<div class="brand"><img src="${asset(p.icon)}" alt="">${p.name}</div>
${card.kicker ? `<div class="kicker">${esc(card.kicker)}</div>` : ''}
<h1>${esc(card.headline)}</h1>
<div class="shot${card.fit === 'contain' ? ' contain' : ''}"><img src="${asset(card.shot)}" alt=""></div>
<div class="foot"><span>${p.line}</span><b>S3DAT</b></div>
</div></body></html>`;
}

const files = process.argv.slice(2);
if (!files.length) { console.error('Usage: node tools/product-card/render.mjs CARD.json [...]'); process.exit(2); }
const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? {executablePath} : {});
try {
  const ctx = await browser.newContext({viewport: {width: 1080, height: 1350}, deviceScaleFactor: 1});
  for (const f of files) {
    const card = JSON.parse(await readFile(f, 'utf8'));
    const pg = await ctx.newPage();
    await pg.setContent(page(card), {waitUntil: 'load'});
    await pg.evaluate(() => document.fonts.ready);
        const shotH = await pg.$eval('.shot', (n) => n.getBoundingClientRect().height);
    if (shotH < 480) throw Error(`${f}: the headline leaves the screenshot only ${Math.round(shotH)} px; shorten it`);
    const out = resolve(root, card.out);
    await pg.screenshot({path: out, type: 'png'});
    console.log('wrote', card.out);
    await pg.close();
  }
} finally {
  await browser.close();
}
