#!/usr/bin/env python3
"""
S3DAT News banner engine.

Renders one silent, looping 1080x608 H.264 banner (plus a WebP poster) from a JSON spec and one or
two AI-generated images. The look and the motion are fixed here so every story gets the same
quality; the spec only carries the words, the colours and the images.

Timeline (8 s at 30 fps):
  0.00-1.50  SLAM    background pushes in, the headline slams in large and centred
  1.50-2.10  DOCK    the headline shrinks into a lower-left lockup
  2.10-4.50  STORY   the hero object rises on the right, company chips pop in
  4.50-5.00  BURST   a light burst wipes from the hero
  5.00-7.30  PAYOFF  colour shifts, the stat counts up (or the companies face off)
  7.30-8.00  OUT     everything clears so the last frame matches the first (seamless loop)

Usage:
  python3 s3dat_banner.py spec.json --out banner.mp4 --poster banner.webp

Only numpy, Pillow and an ffmpeg binary with libx264 are required.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 608
FPS = 30
DURATION = 8.0
SS = 2  # supersampling for type layers
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_SANS = os.path.join(HERE, "fonts", "Geist.ttf")
FONT_MONO = os.path.join(HERE, "fonts", "GeistMono.ttf")
INK = (10, 11, 13)
MAX_BYTES = 1_600_000
POSTER_T = 1.45
TOP_SAFE = 0.15  # the site draws its own labels in the top band; keep it calm


# ---------------------------------------------------------------- helpers
def rgb(hex_value: str) -> tuple[int, int, int]:
    value = hex_value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def seg(t: float, a: float, b: float) -> float:
    return clamp01((t - a) / (b - a))


def ease_out_expo(x: float) -> float:
    return 1.0 if x >= 1 else 1 - 2 ** (-10 * x)


def ease_out_back(x: float, s: float = 1.6) -> float:
    x = clamp01(x) - 1
    return x * x * ((s + 1) * x + s) + 1


def ease_in_out(x: float) -> float:
    x = clamp01(x)
    return 4 * x**3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def lerp(a: float, b: float, x: float) -> float:
    return a + (b - a) * x


def mix(c1, c2, x):
    return tuple(int(round(lerp(a, b, x))) for a, b in zip(c1, c2))


def font(path: str, size: int, weight: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(path, size)
    try:
        f.set_variation_by_axes([weight])
    except (OSError, AttributeError):
        pass
    return f


def place(layer: Image.Image, cx: float, cy: float, scale: float, rot: float = 0.0, skew: float = 0.0,
          alpha: float = 1.0) -> Image.Image:
    """Return a canvas-sized RGBA image with `layer` centred at (cx, cy), scaled/rotated/skewed."""
    lw, lh = layer.size
    c, s = math.cos(rot), math.sin(rot)
    k = math.tan(skew)
    # forward M = R * Skew * scale
    m00, m01 = c * scale, (c * k - s) * scale
    m10, m11 = s * scale, (s * k + c) * scale
    det = m00 * m11 - m01 * m10
    if abs(det) < 1e-9:
        return Image.new("RGBA", (W, H))
    i00, i01, i10, i11 = m11 / det, -m01 / det, -m10 / det, m00 / det
    a, b, d, e = i00, i01, i10, i11
    cx0, cy0 = lw / 2, lh / 2
    cc = cx0 - (a * cx + b * cy)
    ff = cy0 - (d * cx + e * cy)
    out = layer.transform((W, H), Image.Transform.AFFINE, (a, b, cc, d, e, ff), resample=Image.Resampling.BICUBIC)
    if alpha < 1:
        r, g, bl, al = out.split()
        al = al.point(lambda v: int(v * alpha))
        out = Image.merge("RGBA", (r, g, bl, al))
    return out


# ---------------------------------------------------------------- spec
@dataclass
class Spec:
    title: list[str]
    accent_line: int
    kicker: str
    entities: list[str]
    versus: bool
    stat_value: str | None
    stat_label: str | None
    payoff: str | None
    deep: tuple[int, int, int]
    mid: tuple[int, int, int]
    light: tuple[int, int, int]
    background: str
    hero: str | None


def load_spec(path: str) -> Spec:
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    base = os.path.dirname(os.path.abspath(path))
    title = [str(line).upper().strip() for line in raw["title"] if str(line).strip()]
    if not 1 <= len(title) <= 3:
        sys.exit("title must have 1 to 3 lines")
    for line in title:
        if len(line) > 16:
            print(f"warning: title line '{line}' is longer than 16 characters", file=sys.stderr)
    palette = raw.get("palette", {})
    stat = raw.get("stat") or {}
    assets = raw.get("assets", {})
    hero = assets.get("hero")
    return Spec(
        title=title,
        accent_line=int(raw.get("accent_line", len(title) - 1)),
        kicker=str(raw.get("kicker", "")).upper()[:40],
        entities=[str(e).upper()[:18] for e in raw.get("entities", [])][:3],
        versus=bool(raw.get("versus", False)),
        stat_value=stat.get("value"),
        stat_label=(stat.get("label") or "").upper()[:28] or None,
        payoff=(str(raw.get("payoff") or "").upper().strip()[:14] or None),
        deep=rgb(palette.get("deep", "#06122e")),
        mid=rgb(palette.get("mid", "#2f6bff")),
        light=rgb(palette.get("light", "#9fd8ff")),
        background=os.path.join(base, assets["background"]),
        hero=os.path.join(base, hero) if hero else None,
    )


# ---------------------------------------------------------------- type layers
def sticker_line(text: str, size: int, face_top, face_bottom, side, outline=INK) -> Image.Image:
    """Heavy uppercase line with an outline and a solid extruded side, rendered at SS scale."""
    f = font(FONT_SANS, size * SS, 900)
    stroke = max(2, int(size * SS * 0.045))
    depth = max(3, int(size * SS * 0.07))
    l, t, r, b = f.getbbox(text, stroke_width=stroke)
    pad = stroke + depth + 8
    w, h = r - l + pad * 2, b - t + pad * 2
    ox, oy = pad - l, pad - t
    layer = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(layer)
    for i in range(depth, 0, -1):
        shade = mix(side, INK, 0.25 + 0.5 * (i / depth))
        draw.text((ox + i, oy + i), text, font=f, fill=shade + (255,), stroke_width=stroke, stroke_fill=shade + (255,))
    draw.text((ox, oy), text, font=f, fill=outline + (255,), stroke_width=stroke, stroke_fill=outline + (255,))
    mask = Image.new("L", (w, h))
    ImageDraw.Draw(mask).text((ox, oy), text, font=f, fill=255)
    grad = np.zeros((h, w, 4), np.uint8)
    ys = np.clip((np.arange(h) - oy) / max(1, (b - t)), 0, 1)[:, None]
    for ch in range(3):
        grad[..., ch] = (face_top[ch] * (1 - ys) + face_bottom[ch] * ys).astype(np.uint8)
    grad[..., 3] = 255
    face = Image.fromarray(grad)
    layer.paste(face, (0, 0), mask)
    return layer


def text_layer(text: str, size: int, weight: int, color, mono: bool = True, tracking: float = 0.12) -> Image.Image:
    f = font(FONT_MONO if mono else FONT_SANS, size * SS, weight)
    spacing = size * SS * tracking
    widths = [f.getlength(ch) for ch in text]
    total = int(sum(widths) + spacing * max(0, len(text) - 1)) + 8
    asc, desc = f.getmetrics()
    layer = Image.new("RGBA", (total, asc + desc + 8))
    draw = ImageDraw.Draw(layer)
    x = 4.0
    for ch, cw in zip(text, widths):
        draw.text((x, 4), ch, font=f, fill=color + (255,))
        x += cw + spacing
    return layer


def chip_layer(text: str, dot, size: int = 20) -> Image.Image:
    label = text_layer(text, size, 650, (255, 255, 255), tracking=0.1)
    pad_x, pad_y = int(size * SS * 0.9), int(size * SS * 0.55)
    dot_r = int(size * SS * 0.28)
    w = label.width + pad_x * 2 + dot_r * 3
    h = label.height + pad_y * 2
    chip = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(chip)
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=h // 2, fill=INK + (215,), outline=dot + (255,), width=SS * 2)
    cy = h // 2
    draw.ellipse((pad_x - dot_r, cy - dot_r, pad_x + dot_r, cy + dot_r), fill=dot + (255,))
    chip.alpha_composite(label, (pad_x + dot_r * 2, pad_y))
    return chip


def fit_title(lines: list[str], max_w: float, max_h: float) -> int:
    probe = 100
    f = font(FONT_SANS, probe, 900)
    widest = max(f.getlength(line) for line in lines)
    by_w = max_w / widest * probe
    by_h = max_h / (len(lines) * 0.92) / 1.0
    return int(min(by_w, by_h, 200))


# ---------------------------------------------------------------- background
def cover(img: Image.Image, w: int, h: int) -> Image.Image:
    scale = max(w / img.width, h / img.height)
    img = img.resize((max(w, int(img.width * scale)), max(h, int(img.height * scale))), Image.Resampling.LANCZOS)
    x = (img.width - w) // 2
    y = (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def grade(img: Image.Image, spec: Spec, amount: float = 0.5) -> Image.Image:
    """Duotone-map the AI plate into the topic palette so every banner sits in the S3DAT world."""
    a = np.asarray(img.convert("RGB"), np.float32) / 255
    lum = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])[..., None]
    deep, mid, light = (np.array(c, np.float32) / 255 for c in (spec.deep, spec.mid, spec.light))
    lo = np.clip(lum * 2, 0, 1)
    hi = np.clip(lum * 2 - 1, 0, 1)
    duo = np.where(lum < 0.5, deep * (1 - lo) + mid * lo, mid * (1 - hi) + light * hi)
    out = a * (1 - amount) + duo * amount
    out = out * 0.82  # leave headroom for type
    return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8))


def vignette() -> np.ndarray:
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    nx, ny = (x - W / 2) / (W / 2), (y - H / 2) / (H / 2)
    d = np.sqrt(nx**2 * 0.8 + ny**2)
    return np.clip(1 - 0.55 * np.clip(d - 0.35, 0, 1) ** 1.4, 0, 1)[..., None]


# ---------------------------------------------------------------- renderer
class Banner:
    def __init__(self, spec: Spec):
        self.spec = spec
        plate = Image.open(spec.background).convert("RGB")
        self.plate = grade(cover(plate, int(W * 1.3), int(H * 1.3)), spec)
        self.vig = vignette()
        self.hero = None
        if spec.hero:
            hero = Image.open(spec.hero).convert("RGBA")
            bbox = hero.getbbox()
            if bbox:
                hero = hero.crop(bbox)
            target_h = int(H * 0.74 * SS)
            hero = hero.resize((int(hero.width * target_h / hero.height), target_h), Image.Resampling.LANCZOS)
            shadow = Image.new("RGBA", hero.size, INK + (0,))
            shadow.putalpha(hero.getchannel("A").point(lambda v: int(v * 0.55)))
            shadow = shadow.filter(ImageFilter.GaussianBlur(18 * SS))
            self.hero = hero
            self.hero_shadow = shadow
        # headline
        size = fit_title(spec.title, W * 0.84, H * 0.5)
        self.title_size = size
        self.lines = []
        for i, line in enumerate(spec.title):
            accent = i == spec.accent_line
            top = spec.light if accent else (255, 255, 255)
            bottom = mix(spec.light, spec.mid, 0.45) if accent else (226, 230, 238)
            side = spec.mid if accent else mix(spec.mid, INK, 0.45)
            self.lines.append(sticker_line(line, size, top, bottom, side))
        self.brand = text_layer("S3DAT NEWS", 20, 700, (255, 255, 255), tracking=0.28)
        self.kicker = text_layer(spec.kicker, 22, 650, spec.light, tracking=0.14) if spec.kicker else None
        self.chips = [chip_layer(e, spec.light, 24) for e in spec.entities]
        self.stat_label = text_layer(spec.stat_label, 18, 600, (255, 255, 255), tracking=0.16) if spec.stat_label else None
        self.stat_cache: dict[str, Image.Image] = {}
        self.payoff = None
        if spec.payoff and not spec.stat_value:
            self.payoff = sticker_line(spec.payoff, 104, (255, 255, 255), spec.light, spec.mid)
        self.vs = text_layer("VS", 24, 800, spec.light, tracking=0.2) if spec.versus and len(self.chips) == 2 else None

    # -- layout of the headline block in canvas px (unscaled heights)
    def title_block(self):
        hs = [l.height / SS for l in self.lines]
        gap = -self.title_size * 0.06
        total = sum(hs) + gap * (len(hs) - 1)
        return hs, gap, total

    def stat_layer(self, text: str) -> Image.Image:
        if text not in self.stat_cache:
            self.stat_cache[text] = sticker_line(text, 180, (255, 255, 255), self.spec.light, self.spec.mid)
        return self.stat_cache[text]

    def stat_text(self, x: float) -> str:
        value = self.spec.stat_value or ""
        m = re.match(r"^(\D*)(\d+(?:[.,]\d+)?)(.*)$", value)
        if not m:
            return value
        prefix, num, suffix = m.groups()
        decimals = len(num.split(".")[1]) if "." in num else len(num.split(",")[1]) if "," in num else 0
        target = float(num.replace(",", "."))
        shown = target * ease_out_expo(x)
        body = f"{shown:.{decimals}f}"
        if "," in num:
            body = body.replace(".", ",")
        return f"{prefix}{body}{suffix}"

    def frame(self, t: float) -> Image.Image:
        s = self.spec
        # background: push in, return at the end for a seamless loop
        push = ease_out_expo(seg(t, 0, 1.4)) * 0.6 + seg(t, 1.4, 7.3) * 0.4
        back = ease_in_out(seg(t, 7.3, 8.0))
        z = lerp(1.0, 1.12, push * (1 - back))
        pw, ph = self.plate.size
        cw, ch = pw / (1.3 * z) * 1.0, ph / (1.3 * z)
        drift = math.sin(t / DURATION * 2 * math.pi) * 14
        cx, cy = pw / 2 + drift, ph / 2
        bg = self.plate.resize((W, H), box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2), resample=Image.Resampling.BICUBIC)
        arr = np.asarray(bg, np.float32)
        # payoff colour shift
        shift = ease_in_out(seg(t, 4.6, 5.4)) * (1 - ease_in_out(seg(t, 7.2, 7.9)))
        if shift > 0:
            y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
            tint = np.array(s.deep, np.float32) * (1 - y) + np.array(s.mid, np.float32) * y
            arr = arr * (1 - 0.45 * shift) + tint * 0.45 * shift
        # darken at the very start and end so the loop seam is invisible
        fade = min(ease_out_expo(seg(t, 0, 0.35)), 1 - ease_in_out(seg(t, 7.65, 8.0)) * 0.6)
        arr = arr * (0.55 + 0.45 * fade)
        arr = arr * self.vig
        frame = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")

        out_k = ease_in_out(seg(t, 7.3, 7.75))  # everything leaves
        alive = 1 - out_k

        # hero object (STORY + PAYOFF)
        if self.hero is not None:
            rise = ease_out_back(seg(t, 1.9, 2.8), 1.2)
            if rise > 0 and alive > 0:
                float_y = math.sin(t * 1.7) * 6
                rot = math.radians(math.sin(t * 1.1) * 1.6)
                hx = W * 0.74 + (1 - rise) * 40
                hy = H * 0.56 + (1 - rise) * H * 0.55 + float_y
                scale = (1 / SS) * lerp(0.92, 1.0, rise) * (1 + 0.05 * seg(t, 5.0, 7.3))
                if s.stat_value or self.payoff is not None:  # make room for the payoff line
                    move = ease_in_out(seg(t, 4.7, 5.3))
                    hx = lerp(hx, W * 0.88, move)
                    hy = lerp(hy, H * 0.74 + float_y, move)
                    scale *= lerp(1, 0.52, move)
                frame.alpha_composite(place(self.hero_shadow, hx + 10, hy + 26, scale, rot, alpha=alive))
                frame.alpha_composite(place(self.hero, hx, hy, scale, rot, alpha=alive))

        # burst
        burst = seg(t, 4.5, 5.05)
        if 0 < burst < 1:
            radius = ease_out_expo(burst) * W * 1.1
            strength = (1 - burst) ** 1.5
            ov = Image.new("RGBA", (W, H))
            d = ImageDraw.Draw(ov)
            bx, by = (W * 0.74, H * 0.5)
            d.ellipse((bx - radius, by - radius, bx + radius, by + radius), outline=s.light + (int(255 * strength),),
                      width=int(26 + 60 * strength))
            ov = ov.filter(ImageFilter.GaussianBlur(6))
            frame.alpha_composite(ov)
            flash = Image.new("RGBA", (W, H), (255, 255, 255, int(70 * strength)))
            frame.alpha_composite(flash)

        # headline: slam (centred) -> dock (lower-left lockup)
        hs, gap, total = self.title_block()
        slam = seg(t, 0.12, 0.85)
        dock = ease_in_out(seg(t, 1.5, 2.1))
        dock_scale = min(0.7, (W * 0.6) / max(l.width / SS for l in self.lines))
        y_cursor_full = H * 0.5 - total / 2 + H * 0.04
        y_cursor_dock = H * 0.9 - total * dock_scale
        sweep_t = (seg(t, 3.0, 3.9), seg(t, 6.0, 6.9))
        for i, layer in enumerate(self.lines):
            delay = i * 0.09
            x = ease_out_expo(seg(t, 0.12 + delay, 0.85 + delay))
            if x <= 0 or alive <= 0:
                continue
            lh = hs[i]
            cy_full = y_cursor_full + sum(hs[:i]) + gap * i + lh / 2
            cy_dock = y_cursor_dock + (sum(hs[:i]) + gap * i + lh / 2) * dock_scale
            lw = layer.width / SS
            cx_full = W / 2
            cx_dock = W * 0.065 + lw * dock_scale / 2
            scale_full = lerp(1.4, 1.0, x)
            skew = math.radians(lerp(-14, 0, x))
            cxp = lerp(cx_full, cx_dock, dock)
            cyp = lerp(cy_full, cy_dock, dock) + (1 - x) * 30
            sc = lerp(scale_full, dock_scale, dock) / SS
            # motion trail while flying in
            if x < 0.98:
                for k in range(1, 4):
                    xk = ease_out_expo(seg(t - k / FPS * 1.2, 0.12 + delay, 0.85 + delay))
                    if xk <= 0:
                        continue
                    ghost = place(layer, cxp, cy_full + (1 - xk) * 30, lerp(1.4, 1.0, xk) / SS,
                                  skew=math.radians(lerp(-14, 0, xk)), alpha=0.16 * alive)
                    frame.alpha_composite(ghost)
            placed = place(layer, cxp, cyp, sc, skew=skew, alpha=min(1.0, x * 1.4) * alive)
            for st in sweep_t:
                if 0 < st < 1:
                    placed = self.sweep(placed, st)
            frame.alpha_composite(placed)
        # impact flash
        impact = seg(t, 0.62, 0.8)
        if 0 < impact < 1:
            frame.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, int(55 * (1 - impact)))))

        # brand + kicker: above the headline, follow it into the lockup
        meta_in = ease_out_expo(seg(t, 0.5, 1.0)) * alive
        if meta_in > 0:
            top_full = y_cursor_full - 34
            top_dock = y_cursor_dock - 26
            ty = lerp(top_full, top_dock, dock)
            bx = lerp(W / 2, W * 0.065 + self.brand.width / SS * 0.5, dock)
            frame.alpha_composite(place(self.brand, bx, max(ty, H * TOP_SAFE + 8), 1 / SS, alpha=meta_in * 0.9))
            if self.kicker is not None:
                kx_full = W / 2
                ky_full = y_cursor_full + total + 34
                kx_dock = W * 0.065 + self.brand.width / SS + 36 + self.kicker.width / SS / 2
                kx = lerp(kx_full, kx_dock, dock)
                ky = lerp(ky_full, max(ty, H * TOP_SAFE + 8), dock)
                frame.alpha_composite(place(self.kicker, kx, ky, 1 / SS, alpha=meta_in))

        # company chips (STORY), stacked above the lockup
        for i, chip in enumerate(self.chips):
            pop = ease_out_back(seg(t, 2.4 + i * 0.14, 2.85 + i * 0.14))
            if pop <= 0 or alive <= 0:
                continue
            cwid = chip.width / SS
            x0 = W * 0.065 + sum(c.width / SS + 12 for c in self.chips[:i]) + cwid / 2
            if self.vs is not None and i >= 1:
                x0 += self.vs.width / SS + 12
            y0 = y_cursor_dock - 82
            frame.alpha_composite(place(chip, x0, y0, (1 / SS) * lerp(0.6, 1, pop), alpha=clamp01(pop) * alive))
            if self.vs is not None and i == 0:
                vx = x0 + cwid / 2 + 12 + self.vs.width / SS / 2
                frame.alpha_composite(place(self.vs, vx, y0, 1 / SS, alpha=clamp01(pop) * alive))

        # payoff stat
        if s.stat_value:
            sx = seg(t, 5.0, 5.9)
            if sx > 0 and alive > 0:
                layer = self.stat_layer(self.stat_text(sx))
                pop = ease_out_back(seg(t, 5.0, 5.45))
                lx, ly = W * 0.68, H * 0.38
                frame.alpha_composite(place(layer, lx, ly, (1 / SS) * lerp(0.7, 1, pop), alpha=clamp01(pop * 1.3) * alive))
                if self.stat_label is not None:
                    frame.alpha_composite(place(self.stat_label, lx, ly + layer.height / SS / 2 + 14, 1 / SS,
                                                alpha=ease_out_expo(seg(t, 5.3, 5.8)) * alive))
        if self.payoff is not None:
            pop = ease_out_back(seg(t, 5.0, 5.45))
            if pop > 0 and alive > 0:
                pw = self.payoff.width / SS
                px = W - pw / 2 - W * 0.05
                frame.alpha_composite(place(self.payoff, px, H * 0.28, (1 / SS) * lerp(0.7, 1, pop),
                                            skew=math.radians(lerp(-10, 0, clamp01(pop))), alpha=clamp01(pop * 1.3) * alive))
        return frame.convert("RGB")

    @staticmethod
    def sweep(img: Image.Image, x: float) -> Image.Image:
        """A diagonal light band that travels across the headline only."""
        a = np.asarray(img).astype(np.float32)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        pos = lerp(-0.3, 1.3, x) * (W + H)
        d = (xx + yy * 0.6) - pos
        band = np.exp(-(d / 70) ** 2) * 0.32
        alpha = a[..., 3:4] / 255
        a[..., :3] = a[..., :3] + (255 - a[..., :3]) * band[..., None] * alpha
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- encode
def encode(banner: Banner, out: str, crf: int) -> None:
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", str(crf),
        "-maxrate", "1700k", "-bufsize", "3400k", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-g", str(FPS * 2), out,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    frames = int(DURATION * FPS)
    for n in range(frames):
        proc.stdin.write(banner.frame(n / FPS).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit("ffmpeg failed")


def main() -> None:
    parser = argparse.ArgumentParser(description="Render an S3DAT News banner.")
    parser.add_argument("spec")
    parser.add_argument("--out", required=True)
    parser.add_argument("--poster", required=True)
    parser.add_argument("--frame", type=float, help="only render one frame at this time (seconds) to --poster")
    parser.add_argument("--sheet", help="also write a 4x4 contact sheet (JPEG) of the finished video for review")
    args = parser.parse_args()
    banner = Banner(load_spec(args.spec))
    if args.frame is not None:
        banner.frame(args.frame).save(args.poster, quality=85)
        return
    banner.frame(POSTER_T).save(args.poster, "WEBP", quality=82, method=6)
    crf = 23
    while True:
        encode(banner, args.out, crf)
        size = os.path.getsize(args.out)
        if size <= MAX_BYTES or crf >= 32:
            break
        crf += 2
    if args.sheet:
        times = [i * DURATION / 16 + 0.25 for i in range(16)]
        tiles = [banner.frame(min(tt, DURATION - 1 / FPS)).resize((360, 203), Image.Resampling.LANCZOS) for tt in times]
        sheet = Image.new("RGB", (360 * 4, 203 * 4))
        for i, tile in enumerate(tiles):
            sheet.paste(tile, ((i % 4) * 360, (i // 4) * 203))
        sheet.save(args.sheet, quality=85)
    report = {
        "out": args.out,
        "poster": args.poster,
        "bytes": size,
        "crf": crf,
        "width": W,
        "height": H,
        "fps": FPS,
        "seconds": DURATION,
        "poster_bytes": os.path.getsize(args.poster),
    }
    print(json.dumps(report))


if __name__ == "__main__":
    main()
