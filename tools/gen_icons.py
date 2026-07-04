#!/usr/bin/env python3
"""拡張アイコン(icons/icon{16,32,48,128}.png)を生成する。

512px で描画してから縮小することで小サイズでも輪郭を滑らかに保つ。
デザイン: Facebook ブルーの円形バッジに、白い「二人の人物」シルエット
(友達フィードの意)。
"""
from PIL import Image, ImageDraw

BASE = 512
ACCENT = (27, 116, 228, 255)  # #1b74e4
WHITE = (255, 255, 255, 255)


def draw_person(d: ImageDraw.ImageDraw, cx: float, cy: float, s: float, color):
    """中心 (cx, cy)・スケール s で頭+胴体の人物シルエットを描く。"""
    head_r = 0.32 * s
    d.ellipse(
        [cx - head_r, cy - 0.75 * s - head_r, cx + head_r, cy - 0.75 * s + head_r],
        fill=color,
    )
    # 胴体: 上が丸い台形風(角丸長方形+下をバッジ円で自然に切る)
    d.rounded_rectangle(
        [cx - 0.55 * s, cy - 0.30 * s, cx + 0.55 * s, cy + 0.85 * s],
        radius=0.45 * s,
        fill=color,
    )


def render() -> Image.Image:
    img = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([8, 8, BASE - 8, BASE - 8], fill=ACCENT)

    s = 105
    # 後ろの人物(少し薄い白)を先に、前の人物を上に重ねる
    draw_person(d, cx=320, cy=250, s=s * 0.92, color=(255, 255, 255, 170))
    draw_person(d, cx=205, cy=270, s=s, color=WHITE)

    # バッジ円からはみ出た部分を切り落とす
    mask = Image.new("L", (BASE, BASE), 0)
    ImageDraw.Draw(mask).ellipse([8, 8, BASE - 8, BASE - 8], fill=255)
    out = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    import os

    os.makedirs("icons", exist_ok=True)
    base = render()
    for size in (16, 32, 48, 128):
        base.resize((size, size), Image.LANCZOS).save(f"icons/icon{size}.png")
        print(f"icons/icon{size}.png")


if __name__ == "__main__":
    main()
