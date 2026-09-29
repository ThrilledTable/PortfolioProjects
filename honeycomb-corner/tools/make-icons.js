// Renders the app icons (a hive with a bee on honey-gold) with the game's own
// sprite code, via headless Chromium. Usage: node tools/make-icons.js
const path = require('path');
const fs = require('fs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.execPath, '../../lib/node_modules/playwright')));
}
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'icons');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(500);
  for (const [name, size, pad] of [['icon-192.png', 192, 0.12], ['icon-512.png', 512, 0.12], ['maskable-512.png', 512, 0.24], ['apple-touch-icon.png', 180, 0.1]]) {
    const data = await page.evaluate(({ size, pad }) => {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d');
      // honey-gold ground with a darker hexagon
      g.fillStyle = '#f2b230';
      g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#d9771f';
      const hex = [[16, 3], [28, 9], [28, 23], [16, 29], [4, 23], [4, 9]];
      g.beginPath();
      hex.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.fill();
      g.drawImage(HC.spr.hive(0), 5, 15);
      g.drawImage(HC.spr.beePortrait('meadow', false), 15, 2);
      // scale up with crisp pixels, with safe-area padding
      const out = document.createElement('canvas');
      out.width = out.height = size;
      const o = out.getContext('2d');
      o.imageSmoothingEnabled = false;
      o.fillStyle = '#f2b230';
      o.fillRect(0, 0, size, size);
      const inner = Math.round(size * (1 - pad * 2));
      const off = Math.round((size - inner) / 2);
      o.drawImage(c, off, off, inner, inner);
      return out.toDataURL('image/png').split(',')[1];
    }, { size, pad });
    fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'));
    console.log('wrote icons/' + name);
  }
  await browser.close();
})();
