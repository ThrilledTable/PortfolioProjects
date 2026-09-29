// Renders every bee portrait (normal and sparkle) to one PNG for review.
// Usage: node tools/sprite-sheet.js out.png
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(process.execPath, '../../lib/node_modules/playwright'))); }
const root = path.join(__dirname, '..');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 400 } });
  await p.goto('file://' + path.join(root, 'index.html'));
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const S = 6, W = 16 * S + 12;
    const c = document.createElement('canvas');
    c.width = HC.data.SPECIES.length * W + 12;
    c.height = 2 * W + 12;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#fff3d4';
    g.fillRect(0, 0, c.width, c.height);
    HC.data.SPECIES.forEach((sp, i) => {
      g.drawImage(HC.spr.beePortrait(sp.id, false), 12 + i * W, 12, 16 * S, 16 * S);
      g.drawImage(HC.spr.beePortrait(sp.id, true), 12 + i * W, 12 + W, 16 * S, 16 * S);
    });
    document.body.innerHTML = '';
    document.body.style.background = '#fff';
    document.body.appendChild(c);
    c.id = 'sheet';
  });
  await p.locator('#sheet').screenshot({ path: process.argv[2] || 'sheet.png' });
  await b.close();
})();
