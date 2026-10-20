import cv2, numpy as np
# Rows (1500, 1680, 1700, 1716-1734 for the home indicator, x 240-560) are
# measured for the Tool Use recording (798 x 1740 screen); measure them again
# for a new recording before reusing this.
# Bottom of the Tool Use screen: content (to the end of the disclaimer, row
# 1680) moves up by P1+P2; under it, the screen's own colour, the home
# indicator lifted P2 off the bottom. Built from flat colour, not stretched,
# so the recording's rounded corners and the wallpaper behind them never show.
P1, P2 = 16, 10
def rebottom(im):
    H, W = im.shape[:2]
    bg = im[1700, 399].astype(np.float32)
    im = im.copy()
    # the recording's rounded bottom corners (black, wallpaper behind): screen colour
    g = im[1500:1680].mean(axis=2)
    for r in range(g.shape[0]):
        a = 0
        while a < 120 and (abs(g[r, a] - bg.mean()) > 6): a += 1
        b = W - 1
        while b > W - 121 and (abs(g[r, b] - bg.mean()) > 6): b -= 1
        if a: im[1500 + r, :a] = bg
        if b < W - 1: im[1500 + r, b + 1:] = bg
    top = cv2.resize(im[:1680], (W, 1680 - P1 - P2), interpolation=cv2.INTER_AREA).astype(np.float32)
    rest = np.empty((H - top.shape[0], W, 3), np.float32); rest[:] = bg
    # the strip 1680..1714 as recorded (fades of the disclaimer), centre only
    ind = im[1716:1734, 240:560].astype(np.float32)
    y = rest.shape[0] - P2 - 18 - 10
    rest[y:y + 18, 240:560] = ind
    return np.vstack([top, rest])
if __name__ == '__main__':
    import sys
    im = cv2.imread(sys.argv[1]).astype(np.float32)
    cv2.imwrite(sys.argv[2], np.clip(rebottom(im), 0, 255).astype(np.uint8)[1450:])
