"""把 Godot 截图里的角色自动裁出来并放大，便于逐张检查建模效果。"""
from PIL import Image
import numpy as np
import os
import sys

SHOT_DIR = r"D:\new games\godot-model\shots"
BG_LUMA = 52.0          # 背景亮度上限（背景 #0b0e17 / #12161f 都低于此值）


def content_bbox(im: Image.Image):
    a = np.array(im.convert("RGB")).astype(float)
    lum = a[:, :, 0] * 0.3 + a[:, :, 1] * 0.59 + a[:, :, 2] * 0.11
    mask = lum > BG_LUMA
    # 去掉 UI 区域（左上信息面板 + 底部按钮条 + 顶部标题）
    mask[:118, :] = False
    mask[690:, :] = False
    mask[130:320, :620] = False
    ys, xs = np.where(mask)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def main():
    names = sys.argv[1:] or sorted(f for f in os.listdir(SHOT_DIR) if f.endswith(".png") and not f.startswith("_"))
    for n in names:
        p = os.path.join(SHOT_DIR, n)
        im = Image.open(p)
        box = content_bbox(im)
        if not box:
            print(f"{n}: 未找到角色像素")
            continue
        x0, y0, x1, y1 = box
        pad = 26
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(im.width, x1 + pad), min(im.height, y1 + pad)
        c = im.crop((x0, y0, x1, y1))
        k = max(1, int(760 / max(1, c.height)))
        if k > 1:
            c = c.resize((c.width * k, c.height * k), Image.LANCZOS)
        out = os.path.join(SHOT_DIR, "_zoom-" + n)
        c.save(out)
        print(f"{n}: 角色区域 {x1-x0}×{y1-y0} → {out} ({c.width}×{c.height})")


if __name__ == "__main__":
    main()
