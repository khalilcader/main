// Renders every cover at rest, as it sits in the grid, in light and dark, on a
// transparent page with room around it for its shadow and the blur's spill.
// blur-stills.py then blurs them into public/images/work/blur/. Run against
// the preview server (npm run preview):  PW=<playwright> node blur-stills.mjs <out dir>
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const OUT = process.argv[2], URL = process.argv[3] || 'http://localhost:4321/';
const PAD = 48;   // px around each card: its shadow, and room for the blur to spread
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const meta = {};
for (const scheme of ['light', 'dark']) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: scheme });
  await p.goto(URL); await p.waitForTimeout(2500);
  await p.click('#grid-button'); await p.waitForTimeout(2000);
  await p.mouse.move(1439, 899);
  await p.addStyleTag({ content: 'html, body { background: transparent !important; } .site-header, .top-scrim, .backdrop, .backdrop-grain, #cursor, .label, .veil, .still { display: none !important; }' });
  const n = await p.locator('.card').count();
  for (let i = 0; i < n; i++) {
    const card = p.locator('.card').nth(i);
    const slug = await card.getAttribute('data-slug');
    // Scroll it into view, alone on the page.
    await p.evaluate((i) => { document.querySelectorAll('.card').forEach((c, j) => { c.style.visibility = j === i ? '' : 'hidden'; }); }, i);
    let bb = await card.boundingBox();
    if (bb.y < PAD || bb.y + bb.height > 900 - PAD) { await p.mouse.wheel(0, bb.y - 300); await p.waitForTimeout(1500); bb = await card.boundingBox(); }
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${slug}-${scheme}.png`, omitBackground: true, clip: { x: bb.x - PAD, y: bb.y - PAD, width: bb.width + 2 * PAD, height: bb.height + 2 * PAD } });
    meta[slug] = { w: bb.width, h: bb.height, pad: PAD };
  }
  await p.close();
}
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));
await b.close();
