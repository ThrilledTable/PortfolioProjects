// Copies the game (the folder above this one) into native/www, which is what
// Capacitor packs into the app. Run with: npm run copy-web
const fs = require('fs');
const path = require('path');

const game = path.join(__dirname, '..', '..');
const www = path.join(__dirname, '..', 'www');
// Everything the game needs to run. (The service worker is left out: an app
// already works offline.)
const parts = ['index.html', 'css', 'js', 'icons', 'manifest.webmanifest'];

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const p of parts) fs.cpSync(path.join(game, p), path.join(www, p), { recursive: true });
console.log('Copied the game into native/www');
