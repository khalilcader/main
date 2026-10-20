# Blurs the renders from blur-stills.mjs into the grid lightbox's stills:
# public/images/work/blur/<slug>-<light|dark>.webp, and their placement
# (src/data/blur-stills.json: the image's box as a share of the card's).
# A true Gaussian, blurred premultiplied so the cover's edges and shadow
# spread into transparency without a dark fringe. Sigma matches the old
# backdrop blur (--backdrop-blur, 14px on a grid card at 1440 wide).
import sys, json, os, cv2, numpy as np
from PIL import Image
SRC, ROOT = sys.argv[1], sys.argv[2]
SIGMA, SCALE = 14, 0.5   # stored at half size: it's a blur
meta = json.load(open(f'{SRC}/meta.json'))
os.makedirs(f'{ROOT}/public/images/work/blur', exist_ok=True)
place = {}
for slug, m in meta.items():
    for scheme in ('light', 'dark'):
        im = np.asarray(Image.open(f'{SRC}/{slug}-{scheme}.png').convert('RGBA'), np.float32) / 255
        a = im[..., 3:4]
        pm = np.concatenate([im[..., :3] * a, a], axis=2)
        b = cv2.GaussianBlur(pm, (0, 0), SIGMA, borderType=cv2.BORDER_CONSTANT)
        out = np.zeros_like(b); al = b[..., 3:4]
        out[..., :3] = np.where(al > 1e-4, b[..., :3] / np.maximum(al, 1e-4), 0); out[..., 3:4] = al
        img = Image.fromarray(np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')
        img = img.resize((round(img.width * SCALE), round(img.height * SCALE)), Image.LANCZOS)
        img.save(f'{ROOT}/public/images/work/blur/{slug}-{scheme}.webp', quality=82, method=6)
    w, h, p = m['w'], m['h'], m['pad']
    place[slug] = {'l': -p / w * 100, 't': -p / h * 100, 'w': (w + 2 * p) / w * 100, 'h': (h + 2 * p) / h * 100}
os.makedirs(f'{ROOT}/src/data', exist_ok=True)
json.dump({k: {kk: round(vv, 3) for kk, vv in v.items()} for k, v in place.items()}, open(f'{ROOT}/src/data/blur-stills.json', 'w'), indent=1)
print(len(place), 'covers')
