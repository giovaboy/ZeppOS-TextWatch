#!/usr/bin/env python3
"""
Generate color preview images for the watchface color selector.
Produces {hour,minute,date}_prev_<lang>_<id>.png under bg/color/<lang>/
for every color ID parsed out of ALL_COLORS in colorSelector.js.

Run from project root:
    python3 tools/gen_color_previews.py            # generates only LANGS_TO_RUN
    python3 tools/gen_color_previews.py it en es ru # or pick languages on the CLI
"""

import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
BASE = os.path.join(ROOT, 'assets', 'default-target.r')
FONTS = os.path.join(BASE, 'fonts')
OUT = os.path.join(BASE, 'bg', 'color')
COLOR_SELECTOR_JS = os.path.join(ROOT, 'watchface', 'colorSelector.js')

# ── Canvas sizes (must match the widget preview boxes) ────────────────────────
HOUR_W, HOUR_H = 400, 80
MINUTE_W, MINUTE_H = 400, 80
DATE_W, DATE_H = 280, 35

# ── Preview text per language, matching NumberToText's actual output ─────────
# hour   -> getHours(11)               minute -> getMinutes(20)      date -> getDate(monday, 1, january)
TEXTS = {
    'it': {'hour': 'undici',       'minute': 'e venti',    'date': 'lunedì 01 gennaio'},
    'en': {'hour': 'eleven',       'minute': 'and twenty', 'date': 'monday 01 january'},
    'es': {'hour': 'once',         'minute': 'y veinte',   'date': 'lunes, 01 de enero'},
    # hour usa "10" invece di "11": "одиннадцать" (11) è un outlier di lunghezza
    # tra le ore russe e sfora il riquadro 400px anche coi soli 64px reali.
    # date usa il giorno/mese russi più corti (среда/мая) — a 28px reali,
    # "понедельник, 1 января" tronca «п» e «я» nel riquadro 280px
    'ru': {'hour': 'десять',  'minute': 'и двадцать', 'date': 'среда, 5 мая'},
    'fr': {'hour': 'onze',         'minute': 'et vingt',   'date': 'lundi 1 janvier'},
}

# ── Per-language font + size profile ──────────────────────────────────────────
# Font sizes here MUST match the real on-device text_size in watchface/index.js
# (hourTextSize=64 always; minuteTextSize is 64, or 60 for fr, or 56 for ru;
# dateTextSize=28 always) so the preview looks like what the user actually sees.
# Barlow has no Cyrillic glyphs, so Russian previews use Inter instead. Russian
# hour/date at the real 64/28px overflow this preview box (400/280px, narrower
# than the real 540/480px widget) — kept at the real size anyway per request;
# revisit by widening the box or shortening the ru preview sample text if the
# rendered crop doesn't look right.
_BARLOW = {
    'hour':   (os.path.join(FONTS, 'Barlow-Medium.ttf'), 64),
    'minute': (os.path.join(FONTS, 'Barlow-Regular.ttf'), 64),
    'date':   (os.path.join(FONTS, 'Barlow-Regular.ttf'), 28),
}
_BARLOW_FR = {
    'hour':   (os.path.join(FONTS, 'Barlow-Medium.ttf'), 64),
    'minute': (os.path.join(FONTS, 'Barlow-Regular.ttf'), 60),
    'date':   (os.path.join(FONTS, 'Barlow-Regular.ttf'), 28),
}
_INTER_RU = {
    'hour':   (os.path.join(FONTS, 'Inter-Medium.ttf'), 64),
    'minute': (os.path.join(FONTS, 'Inter-Regular.ttf'), 56),
    'date':   (os.path.join(FONTS, 'Inter-Regular.ttf'), 28),
}
FONT_PROFILES = {'it': _BARLOW, 'en': _BARLOW, 'es': _BARLOW, 'ru': _INTER_RU, 'fr': _BARLOW_FR}

LANGS_TO_RUN = ['it', 'en', 'es', 'fr', 'ru']


def hex_to_rgb(h):
    return ((h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff)


def parse_all_colors():
    """Pull (id, rgb) pairs straight out of ALL_COLORS in colorSelector.js —
    the single source of truth for id -> color mapping."""
    src = open(COLOR_SELECTOR_JS, encoding='utf8').read()
    rows = re.findall(
        r'\{\s*id:\s*(\d+),\s*type:\s*COLOR\.\w+,\s*color:\s*0x([0-9a-fA-F]{6}),',
        src,
    )
    return [(int(cid), hex_to_rgb(int(hexcolor, 16))) for cid, hexcolor in rows]


def make_preview(text, color_rgb, font_path, font_size, w, h):
    """Render centered text on a transparent background."""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path, font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (w - tw) // 2 - bbox[0]
    y = (h - th) // 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=(*color_rgb, 255))
    return img


def main(langs):
    colors = parse_all_colors()
    print(f'{len(colors)} colori letti da ALL_COLORS')

    for lang in langs:
        texts = TEXTS[lang]
        fonts = FONT_PROFILES[lang]
        out_dir = os.path.join(OUT, lang)
        os.makedirs(out_dir, exist_ok=True)

        for cid, rgb in colors:
            for variant, w, h in (
                ('hour', HOUR_W, HOUR_H),
                ('minute', MINUTE_W, MINUTE_H),
                ('date', DATE_W, DATE_H),
            ):
                fp, fs = fonts[variant]
                img = make_preview(texts[variant], rgb, fp, fs, w, h)
                path = os.path.join(out_dir, f'{variant}_prev_{lang}_{cid}.png')
                img.save(path)

        print(f'  {lang}: {len(colors) * 3} file scritti in bg/color/{lang}/')

    print('Done.')


if __name__ == '__main__':
    langs = sys.argv[1:] or LANGS_TO_RUN
    unknown = [l for l in langs if l not in TEXTS]
    if unknown:
        sys.exit(f'Lingue non supportate: {unknown} (disponibili: {list(TEXTS)})')
    main(langs)
