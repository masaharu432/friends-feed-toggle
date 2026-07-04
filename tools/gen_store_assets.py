#!/usr/bin/env python3
"""ストア申請用の画像アセットを store/ に生成する。

- store/logo-300.png       : ストアロゴ 300x300(Edge Add-ons 必須)
- store/promo-440x280.png  : 小プロモーションタイル(Edge Add-ons 必須)

アイコンと同じ描画ロジックを使い、タイルには拡張名を載せる。
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from gen_icons import render  # noqa: E402

ACCENT = (27, 116, 228, 255)  # #1b74e4
BG_DARK = (24, 25, 26, 255)
WHITE = (255, 255, 255, 255)
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def gen_logo():
    render().resize((300, 300), Image.LANCZOS).save("store/logo-300.png")
    print("store/logo-300.png")


def gen_promo_tile():
    # 2 倍で描いて縮小(縁を滑らかに)
    w, h = 880, 560
    img = Image.new("RGBA", (w, h), BG_DARK)
    d = ImageDraw.Draw(img)

    icon = render().resize((280, 280), Image.LANCZOS)
    img.paste(icon, (60, (h - 280) // 2), icon)

    title_font = ImageFont.truetype(FONT_BOLD, 62)
    sub_font = ImageFont.truetype(FONT_REG, 40)
    tx = 390
    d.text((tx, 180), "Friends Feed", font=title_font, fill=WHITE)
    d.text((tx, 260), "Toggle", font=title_font, fill=WHITE)
    d.text((tx, 356), "for Facebook", font=sub_font, fill=(176, 179, 184, 255))

    img.resize((440, 280), Image.LANCZOS).convert("RGB").save(
        "store/promo-440x280.png"
    )
    print("store/promo-440x280.png")


def main():
    os.makedirs("store", exist_ok=True)
    gen_logo()
    gen_promo_tile()


if __name__ == "__main__":
    main()
