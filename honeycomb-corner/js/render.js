// =============================================================================
// render.js: DRAWING THE GAME PICTURE
// -----------------------------------------------------------------------------
// About 60 times a second, `draw(s, t)` paints the whole scene onto a
// 240×160 canvas, and the web page stretches it up with crisp square pixels.
// `t` is a running clock in seconds, used for animation (bees flapping,
// flowers swaying...).
//
// Drawing happens in layers, back to front:
//   1. the background (grass, walls, floor, street), drawn once and reused
//   2. flower beds, flowers, garden decorations, hives
//   3. shelves, crates, the Candle Machine, the request board
//   4. people and furniture, sorted so whoever is lower on screen is drawn
//      on top ("y-sorting"), which makes people walk behind the counter
//      and in front of the shelves naturally
//   5. flying bees, weather, night-time darkness and lamp glow
//   6. golden drips and floating "+45" numbers (kept bright at night)
//
// At the bottom, `hitTest` works out what you tapped on the picture.
// =============================================================================
(function () {
  const HC = window.HC;
  const { util, data: D, spr, layout: L } = HC;
  const INK = spr.INK;
  const f = () => HC.sim.f;

  let ctx, flowers;
  const staticLayers = {}; // background pictures, one per season/wallpaper/floor combo
  const MERCHANT_LOOK = { hair: ['#d8d0c8', '#a8a098'], skin: ['#e0a878', '#b87c50'], shirt: ['#6a4a9a', '#4a3070'], hat: 'tophat' };
  const FLOWER_COLS = ['#f07898', '#ffffff', '#b890e8', '#f8d030', '#f06a4a', '#80c8f0'];
  const AUTUMN_COLS = ['#e8702a', '#d84a2a', '#f0a830', '#b85a2a'];

  // Flower Beds: each upgrade level plants one more bed at these spots
  // (x, y of the bed's top-left corner). They avoid the hives and the path.
  const BED_SPOTS = [[20, 44], [58, 44], [20, 92], [58, 92], [1, 4], [1, 52], [1, 100], [84, 124]];

  function init(canvasEl) {
    ctx = canvasEl.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    flowers = buildFlowers();
  }

  // A tiny helper: fill a rectangle with a colour.
  const rect = (g, x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };

  // ---------------------------------------------------------------------------
  // 1. BACKGROUND (rebuilt only when the season, wallpaper or floor changes)
  // ---------------------------------------------------------------------------
  function staticFor(s) {
    const season = f().season(s);
    const wall = s.cos.equip.wall || 'wall-planks';
    const floor = s.cos.equip.floor || 'floor-checker';
    const key = season.id + '|' + wall + '|' + floor;
    if (!staticLayers[key]) staticLayers[key] = buildStatic(season, wall, floor);
    return staticLayers[key];
  }

  function buildStatic(season, wall, floor) {
    const [grass, grassDark, grassLight, tuft] = season.grass;
    const winter = season.id === 'winter';
    const c = spr.canvas(L.W, L.H);
    const g = c.getContext('2d');
    const rnd = util.seeded(7); // same speckles every time
    const r = (x, y, w, h, col) => rect(g, x, y, w, h, col);

    // Garden grass with speckles and tufts
    r(0, 0, 112, 144, grass);
    for (let i = 0; i < 520; i++) r(Math.floor(rnd() * 112), Math.floor(rnd() * 144), 1, 1, rnd() < 0.5 ? grassDark : grassLight);
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(rnd() * 104) + 2, y = Math.floor(rnd() * 136) + 4;
      r(x, y, 1, 2, tuft); r(x + 2, y, 1, 2, tuft); r(x + 1, y + 1, 1, 1, tuft);
    }
    if (season.id === 'autumn') {
      for (let i = 0; i < 90; i++) r(Math.floor(rnd() * 100), Math.floor(rnd() * 140), 2, 1, ['#d8702a', '#c84a2a', '#e8a030'][i % 3]);
    }
    // The garden path the shopkeeper walks to reach the hives
    const path = winter ? '#dfe4ec' : '#c8b07a';
    r(45, 34, 7, 118, path);
    for (const y of [34, 82, 130]) r(20, y, 56, 5, path);
    // Worn patches under each hive
    for (const [cx, cy] of L.hiveSlots) r(cx * 16 - 1, cy * 16 + 11, 18, 6, season.pad);
    // Picket fence between garden and shop
    for (let y = 2; y < 140; y += 4) {
      r(102, y, 3, 3, '#f4ecd8');
      r(102, y + 3, 3, 1, '#c8b898');
    }
    r(101, 4, 1, 136, '#b8a888');
    if (winter) for (let y = 2; y < 140; y += 4) r(102, y - 1, 3, 1, '#ffffff');
    // Street lamp
    r(106, 116, 2, 26, '#3a3040');
    r(104, 112, 6, 5, '#3a3040');
    r(105, 113, 4, 3, '#ffe08a');
    // Street
    r(0, 144, 240, 16, '#d8b878');
    r(0, 144, 240, 1, '#b89858');
    for (let i = 0; i < 90; i++) r(Math.floor(rnd() * 240), 146 + Math.floor(rnd() * 13), 2, 1, rnd() < 0.5 ? '#c4a466' : '#e6caa0');
    if (winter) for (let i = 0; i < 26; i++) r(Math.floor(rnd() * 236), rnd() < 0.5 ? 145 : 157, 4 + Math.floor(rnd() * 6), 2, '#f4f8fc');

    // Shop floor (style from the Store)
    for (let y = 16; y < 128; y += 8) {
      for (let x = 112; x < 240; x += 8) {
        const odd = ((x + y) / 8) % 2;
        if (floor === 'floor-wood') {
          r(x, y, 8, 8, (y / 8) % 2 ? '#c8945a' : '#bc8850');
          r(x, y + 7, 8, 1, '#a0703e');
          if ((x / 8 + (y / 8) * 3) % 5 === 0) r(x + 3, y, 1, 7, '#a0703e');
        } else if (floor === 'floor-tiles') {
          r(x, y, 8, 8, odd ? '#cfe4f0' : '#f4f8fb');
          r(x, y, 8, 1, '#b0c8d8'); r(x, y, 1, 8, '#b0c8d8');
        } else r(x, y, 8, 8, odd ? '#f2dfb4' : '#e6cc98');
      }
    }
    // Back wall (style from the Store)
    if (wall === 'wall-honeycomb') {
      r(112, 0, 128, 16, '#f2c050');
      for (let y = 2; y < 16; y += 4) for (let x = 112 + ((y / 4) % 2) * 3; x < 240; x += 6) r(x, y, 3, 2, '#e0a838');
    } else if (wall === 'wall-stripes') {
      r(112, 0, 128, 16, '#e4f4e8');
      for (let x = 112; x < 240; x += 6) r(x, 0, 3, 16, '#a8dcc0');
    } else if (wall === 'wall-rose') {
      r(112, 0, 128, 16, '#f4d4dc');
      for (let y = 3; y < 16; y += 5) for (let x = 114 + (y % 2) * 4; x < 240; x += 8) { r(x, y, 2, 2, '#d890a4'); r(x + 1, y - 1, 1, 1, '#d890a4'); }
    } else {
      r(112, 0, 128, 16, '#b86a32');
      for (let x = 112; x < 240; x += 6) r(x, 2, 1, 14, '#9a5626');
    }
    r(112, 0, 128, 2, '#6a3418');
    r(112, 15, 128, 1, '#7a3e1a');
    // Side walls
    r(112, 0, 3, 144, '#7a3e1a');
    r(237, 0, 3, 144, '#7a3e1a');
    // Front wall with the doorway
    r(112, 128, 128, 16, '#a85a2a');
    for (let x = 112; x < 240; x += 8) r(x, 128, 1, 16, '#8a4420');
    r(112, 128, 128, 2, winter ? '#f4f8fc' : '#6a3418');
    r(144, 128, 16, 16, '#6a3418');
    r(145, 130, 14, 14, '#d84a3a'); // doormat seen through the door
    r(147, 132, 10, 10, '#e8704a');
    for (const wx of [120, 212]) { // windows
      r(wx, 131, 16, 9, '#4a2a18');
      r(wx + 1, 132, 14, 7, '#a8d8e8');
      r(wx + 2, 133, 4, 2, '#e0f4fa');
      r(wx + 7, 132, 1, 7, '#4a2a18');
    }
    // The counter (its front edge is redrawn later over anyone behind it)
    drawCounter(g);
    // Wall clock
    r(226, 4, 7, 7, INK);
    r(227, 5, 5, 5, '#fff4d8');
    r(229, 6, 1, 2, INK);
    r(229, 7, 2, 1, INK);
    return c;
  }

  function drawCounter(g) {
    const c = L.counter;
    rect(g, c.x, c.y + 2, c.w, 14, '#8a5a2a');
    rect(g, c.x, c.y, c.w, 5, '#c88a4a');
    rect(g, c.x, c.y, c.w, 1, '#e8b070');
    rect(g, c.x, c.y + 15, c.w, 1, INK);
    for (let x = c.x + 4; x < c.x + c.w; x += 10) rect(g, x, c.y + 6, 6, 7, '#7a4a22');
  }

  // Scattered wild flowers (positions fixed forever; more appear with upgrades).
  function buildFlowers() {
    const rnd = util.seeded(42);
    const out = [];
    const blocked = (x, y) => {
      if (x > 96) return true;
      if (x > 42 && x < 54) return true; // the path
      for (const [cx, cy] of L.hiveSlots) {
        if (x > cx * 16 - 4 && x < cx * 16 + 20 && y > cy * 16 - 14 && y < cy * 16 + 24) return true;
      }
      return false;
    };
    let tries = 0;
    while (out.length < 110 && tries < 6000) {
      tries++;
      const x = 3 + Math.floor(rnd() * 92), y = 4 + Math.floor(rnd() * 134);
      if (blocked(x, y)) continue;
      if (out.some((fl) => Math.abs(fl.x - x) < 5 && Math.abs(fl.y - y) < 5)) continue;
      out.push({ x, y, col: FLOWER_COLS[Math.floor(rnd() * FLOWER_COLS.length)], ph: rnd() * 6 });
    }
    return out;
  }
  function visibleFlowers(s) {
    const se = f().season(s);
    let n = 14 + 3 * s.up.flowers + (se.id === 'spring' ? 10 : 0);
    if (se.id === 'winter') n = Math.min(n, 6 + s.up.flowers); // a few hardy winter blooms
    return flowers.slice(0, Math.min(flowers.length, n));
  }

  // ---------------------------------------------------------------------------
  // 2. GARDEN
  // ---------------------------------------------------------------------------
  function drawFlowerBeds(s, t) {
    const beds = Math.min(BED_SPOTS.length, s.up.flowers);
    const se = f().season(s).id;
    for (let i = 0; i < beds; i++) {
      const [x, y] = BED_SPOTS[i];
      rect(ctx, x, y, 14, 7, INK); // wooden edging
      rect(ctx, x + 1, y + 1, 12, 5, se === 'winter' ? '#e8eef4' : '#7a5230'); // soil
      if (se === 'winter') continue;
      for (let k = 0; k < 4; k++) {
        const col = se === 'autumn' ? AUTUMN_COLS[(i + k) % 4] : FLOWER_COLS[(i * 3 + k) % FLOWER_COLS.length];
        const fx = x + 2 + k * 3, sway = Math.sin(t * 1.5 + i + k) > 0.7 ? 1 : 0;
        rect(ctx, fx + 1, y + 1, 1, 3, '#3e8a34');
        rect(ctx, fx + sway, y, 3, 1, col);
        rect(ctx, fx + 1 + sway, y - 1, 1, 3, col);
        rect(ctx, fx + 1 + sway, y, 1, 1, '#f8d030');
      }
    }
  }

  function drawFlowers(s, t) {
    const autumn = f().season(s).id === 'autumn';
    for (const fl of visibleFlowers(s)) {
      const sway = Math.sin(t * 1.6 + fl.ph) > 0.6 ? 1 : 0;
      rect(ctx, fl.x, fl.y + 1, 1, 3, '#3e8a34');
      const x = fl.x + sway, y = fl.y;
      ctx.fillStyle = autumn ? AUTUMN_COLS[Math.floor(fl.ph * 10) % 4] : fl.col;
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
      rect(ctx, x, y, 1, 1, fl.col === '#f8d030' ? '#e86a20' : '#f8d030');
    }
  }

  // Garden decorations that sit flat (the pond); the upright ones (gnome,
  // fountain, bench, lanterns) are added as y-sorted props so people walk
  // in front of / behind them correctly.
  function drawGardenFlat(s, t) {
    if (s.cos.placed['deco-pond']) {
      rect(ctx, 82, 48, 18, 12, INK);
      rect(ctx, 83, 49, 16, 10, '#4aa0c8');
      rect(ctx, 85, 50, 6, 2, '#8ad0f0');
      rect(ctx, 91, 54, 4, 3, '#4a9a3c'); // lily pad
      rect(ctx, 92, 54, 1, 1, '#f8b8d0');
      if (Math.floor(t * 1.5) % 3 === 0) rect(ctx, 87, 56, 1, 1, '#c8ecf8'); // ripple
    }
  }

  // Flat shop decorations people walk over (the rug by the door).
  function drawShopFlat(s) {
    if (s.cos.placed['deco-rug']) drawRug();
  }
  function drawRug() {
    rect(ctx, 140, 118, 24, 9, '#b8483a');
    rect(ctx, 142, 119, 20, 7, '#d86a4a');
    rect(ctx, 144, 121, 16, 3, '#f2b230');
  }

  function drawHives(s, t) {
    const winterNow = f().season(s).id === 'winter';
    const shopStyle = s.cos.equip.hiveStyle || 'hive-classic';
    L.hiveSlots.forEach(([cx, cy], i) => {
      const x = cx * 16, y = cy * 16;
      const h = s.hives[i];
      const style = (h && h.style) || shopStyle; // a hive can have its own style
      const build = HC.builds.find(s, 'hive', i);
      if (h) {
        const img = spr.hive(h.level, style);
        const top = y + 17 - spr.HIVE_H;
        ctx.drawImage(img, x - 1, top);
        if (winterNow) rect(ctx, x + 1, top + findRoofTop(h.level, style), 14, 1, '#f8fbff'); // snow on the roof
        // Honey meter under the hive: how full it is.
        const fill = f().honeyIn(h) / f().honeyCap(h);
        rect(ctx, x + 1, y + 18, 14, 3, INK);
        rect(ctx, x + 2, y + 19, Math.round(12 * fill), 1, fill >= 1 ? '#ff9a2a' : '#f8c838');
        if (fill >= 1 && Math.floor(t * 2) % 2 === 0) spr.drawText(ctx, '!', x + 8, top - 6, '#ff9a2a');
        // Upgrade under way: hammer + progress bar
        const up = HC.builds.find(s, 'hiveUp', i);
        if (up) drawBuildBar(s, up, x + 1, top - 4, 14);
      } else if (build) {
        drawScaffold(s, build, x, y, t);
      } else if (i === s.hives.length) {
        // Next free spot: a dashed outline that pulses when you can afford it.
        const can = s.coins >= f().hiveCost(s) && HC.builds.freeBuilder(s);
        const on = !can || Math.floor(t * 2) % 2 === 0;
        ctx.fillStyle = can ? '#fff4c0' : 'rgba(43,29,20,0.45)';
        if (on) {
          for (let k = 0; k < 16; k += 3) {
            ctx.fillRect(x + k, y + 2, 2, 1);
            ctx.fillRect(x + k, y + 15, 2, 1);
            ctx.fillRect(x, y + 2 + k * 0.8, 1, 2);
            ctx.fillRect(x + 15, y + 2 + k * 0.8, 1, 2);
          }
          ctx.fillRect(x + 7, y + 6, 2, 6);
          ctx.fillRect(x + 5, y + 8, 6, 2);
        }
      }
    });
  }
  // Roughly where the top of the roof is in a hive picture (for snow).
  function findRoofTop(level, style) {
    if (style === 'hive-skep') return spr.HIVE_H - 3 - (3 + level) * 3 - 1;
    const boxes = [1, 2, 2, 3, 3, 3][level] || 1;
    return spr.HIVE_H - 3 - 6 * boxes - (level < 2 ? 2 : 5);
  }

  // A thin progress bar with a hammer, for anything under construction.
  function drawBuildBar(s, b, x, y, w) {
    const k = 1 - HC.builds.left(s, b) / b.dur;
    rect(ctx, x, y, w, 3, INK);
    rect(ctx, x + 1, y + 1, Math.round((w - 2) * k), 1, '#8cd06a');
    ctx.drawImage(spr.misc('hammer'), x + w - 3, y - 8);
  }
  // Wooden scaffolding where a new hive is being built.
  function drawScaffold(s, b, x, y, t) {
    rect(ctx, x + 1, y + 2, 1, 15, '#8a5a2a');
    rect(ctx, x + 14, y + 2, 1, 15, '#8a5a2a');
    rect(ctx, x, y + 4, 16, 1, '#a86a32');
    rect(ctx, x, y + 11, 16, 1, '#a86a32');
    rect(ctx, x + 3, y + 12, 10, 5, '#e8c888'); // the first box, half built
    rect(ctx, x + 3, y + 12, 10, 1, INK);
    drawBuildBar(s, b, x + 1, y - 4, 14);
  }

  // Bees flying between their hive and the flowers. Each bee follows its own
  // steady loop worked out from its id, so no position needs saving.
  function drawBees(s, t) {
    const fl = visibleFlowers(s);
    if (!fl.length) return;
    const busy = f().busyBees(s);
    s.hives.forEach((h, hi) => {
      const [cx, cy] = L.hiveSlots[hi];
      const hx = cx * 16 + 8, hy = cy * 16 + 11;
      const full = f().hiveFull(h);
      // At night, sleeping bees stay inside: show a drifting "z" instead.
      if (f().isNight(s) && h.bees.some((id) => s.bees[id] && !f().nightWorker(s.bees[id]) && !busy.has(id))) {
        const k = (t * 0.6 + hi * 0.37) % 1;
        ctx.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
        spr.drawText(ctx, k < 0.5 ? 'z' : 'Z', hx + 4 + Math.round(k * 4), hy - 18 - Math.round(k * 8), '#d8d8ff');
        ctx.globalAlpha = 1;
      }
      h.bees.slice(0, 8).forEach((id) => {
        const bee = s.bees[id];
        if (!bee || busy.has(id)) return; // resting in the nursery
        if (f().asleep(s, bee)) return; // asleep inside the hive
        const seed = util.hash(id);
        let x, y;
        if (full) {
          // Full hive: bees idle in a lazy circle around it.
          x = hx + Math.cos(t * 1.2 + seed) * 9;
          y = hy - 6 + Math.sin(t * 1.7 + seed) * 4;
        } else {
          const period = 5 + (seed % 300) / 100;
          const off = (seed % 1000) / 100;
          const trip = Math.floor((t + off) / period);
          const u = ((t + off) % period) / period;
          const fw = fl[util.hash(id + trip) % fl.length];
          if (u < 0.4) {
            const k = u / 0.4;
            x = util.lerp(hx, fw.x, k);
            y = util.lerp(hy, fw.y - 2, k) - Math.sin(Math.PI * k) * 10;
          } else if (u < 0.6) {
            x = fw.x + Math.sin(t * 9 + seed) * 1.5;
            y = fw.y - 3 + Math.cos(t * 7 + seed) * 1;
          } else {
            const k = (u - 0.6) / 0.4;
            x = util.lerp(fw.x, hx, k);
            y = util.lerp(fw.y - 2, hy, k) - Math.sin(Math.PI * k) * 8;
          }
        }
        x = Math.round(x);
        y = Math.round(y);
        const sp = D.species[bee.sp];
        const col = bee.sparkle ? spr.sparklePalette(sp) : sp;
        const flap = Math.floor(t * 14 + seed) % 2;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x - 1, y - 2 + flap, 1, 1);
        ctx.fillRect(x + 1, y - 2 + flap, 1, 1);
        rect(ctx, x - 1, y - 1, 4, 2, col.body);
        rect(ctx, x + 1, y - 1, 1, 2, col.stripe);
        rect(ctx, x - 2, y - 1, 1, 2, INK);
        if (bee.sparkle && Math.floor(t * 4 + seed) % 3 === 0) rect(ctx, x + 2, y - 3, 1, 1, '#fff6b0');
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 3. SHOP FIXTURES
  // ---------------------------------------------------------------------------
  function drawShelves(s, t) {
    const cap = f().shelfCap(s);
    for (let i = 0; i < 8; i++) {
      const x = 112 + i * 16, y = 8;
      const sh = s.shelves[i];
      if (!sh) {
        // Not bought yet: a framed honeycomb picture hangs there instead.
        if (i % 2 === 0) {
          rect(ctx, x + 4, 4, 8, 8, '#6a3418');
          rect(ctx, x + 5, 5, 6, 6, '#f2c050');
          rect(ctx, x + 6, 6, 2, 2, '#d8962a');
          rect(ctx, x + 9, 8, 1, 2, '#d8962a');
        }
        continue;
      }
      rect(ctx, x + 1, y, 14, 23, INK);
      rect(ctx, x + 2, y + 1, 12, 21, '#9a5a2a');
      rect(ctx, x + 3, y + 2, 10, 8, '#6a3a1a');
      rect(ctx, x + 3, y + 12, 10, 8, '#6a3a1a');
      rect(ctx, x + 2, y + 10, 12, 2, '#c88a4a');
      rect(ctx, x + 2, y + 20, 12, 2, '#c88a4a');
      if (sh.good) {
        const g = D.good[sh.good];
        const n = Math.ceil((sh.qty / cap) * 6); // jars shown = how full it is
        for (let k = 0; k < n; k++) {
          const row = k < 3 ? 1 : 0;
          const jx = x + 3 + (k % 3) * 3 + (row ? 0 : 1);
          const jy = y + (row ? 14 : 4);
          rect(ctx, jx, jy, 3, 6, INK);
          rect(ctx, jx, jy + 2, 3, 4, g.fill);
          rect(ctx, jx, jy + 1, 3, 1, g.lid);
        }
        rect(ctx, x + 6, y + 21, 4, 2, g.fill); // price tag
        // Empty shelf: a flashing "!" (red if the storehouse is out too).
        if (sh.qty === 0 && Math.floor(t * 2) % 2 === 0) spr.drawText(ctx, '!', x + 8, y - 6, s.store[sh.good] > 0 ? '#fff08a' : '#ff6a4a');
      }
    }
    // String Lights along the top of the wall
    if (s.cos.placed['deco-lights']) {
      const night = lightLevels(s).night;
      for (let x = 114; x < 238; x += 6) {
        const sag = Math.round(Math.sin(((x - 114) / 124) * Math.PI * 4) * 1.5) + 3;
        rect(ctx, x, sag, 6, 1, '#4a3a2a');
        const on = night > 0.3 || Math.floor(t * 2 + x) % 5 !== 0;
        rect(ctx, x + 2, sag + 1, 2, 2, on ? ['#ffd23a', '#f07898', '#8ad0f0', '#8cd06a'][(x / 6) % 4 | 0] : '#8a7a6a');
      }
    }
  }

  // The storeroom crates. Jars peek out the top the fuller the storehouse is.
  function drawCrates(s) {
    const c = L.crates;
    const cap = f().storageCap(s);
    let fill = 0, kinds = 0;
    for (const g in s.store) if (s.store[g] > 0) { fill += s.store[g] / cap; kinds++; }
    fill = kinds ? fill / Math.max(kinds, 1) : 0;
    const crate = (x, y) => {
      rect(ctx, x, y, 12, 10, INK);
      rect(ctx, x + 1, y + 1, 10, 8, '#c8904a');
      rect(ctx, x + 1, y + 4, 10, 1, '#9a6a32');
      rect(ctx, x + 5, y + 1, 1, 8, '#9a6a32');
    };
    crate(c.x, c.y + 12);
    crate(c.x + 13, c.y + 12);
    crate(c.x + 6, c.y + 3);
    // Jars in the top crate, more when fuller
    const goods = Object.keys(s.store).filter((g) => s.store[g] > 0);
    const jars = Math.min(4, Math.ceil(fill * 4));
    for (let k = 0; k < jars; k++) {
      const g = D.good[goods[k % goods.length]];
      rect(ctx, c.x + 7 + k * 2.5, c.y, 2, 4, INK);
      rect(ctx, c.x + 7 + k * 2.5, c.y + 1, 2, 3, g.fill);
    }
  }

  // The Candle Machine (or its scaffolding while being built).
  function drawMachine(s, t) {
    const m = L.machine;
    const b = HC.builds.find(s, 'machine', 0);
    if (!s.machine) {
      if (b) {
        rect(ctx, m.x + 2, m.y + 4, 1, 16, '#8a5a2a');
        rect(ctx, m.x + 26, m.y + 4, 1, 16, '#8a5a2a');
        rect(ctx, m.x, m.y + 8, 30, 1, '#a86a32');
        rect(ctx, m.x + 6, m.y + 12, 18, 8, '#8a8a9a');
        drawBuildBar(s, b, m.x + 4, m.y, 22);
      }
      return;
    }
    const mc = s.machine;
    const working = mc.wax > 0 && mc.candles < f().machineCap(s);
    // body
    rect(ctx, m.x, m.y + 4, m.w, 16, INK);
    rect(ctx, m.x + 1, m.y + 5, m.w - 2, 14, '#9a8a7a');
    rect(ctx, m.x + 1, m.y + 5, m.w - 2, 2, '#b8a898');
    // wax hopper on the left
    rect(ctx, m.x + 2, m.y, 9, 6, INK);
    rect(ctx, m.x + 3, m.y + 1, 7, 4, '#6a5a4a');
    const waxH = Math.round(4 * Math.min(1, mc.wax / f().machineCap(s)));
    if (waxH) rect(ctx, m.x + 3, m.y + 5 - waxH, 7, waxH, D.good.wax.fill);
    // smoke puffs while working
    if (working) {
      const k = (t * 1.5) % 1;
      ctx.globalAlpha = 1 - k;
      rect(ctx, m.x + 22, m.y - 2 - Math.round(k * 6), 3, 2, '#e8e0d8');
      ctx.globalAlpha = 1;
    }
    // output tray: candles lined up
    rect(ctx, m.x + 13, m.y + 9, 15, 7, '#4a3a2a');
    const n = Math.min(6, Math.ceil((mc.candles / f().machineCap(s)) * 6));
    for (let k = 0; k < n; k++) {
      rect(ctx, m.x + 14 + k * 2, m.y + 11, 1, 5, '#f6e6b2');
      rect(ctx, m.x + 14 + k * 2, m.y + 10, 1, 1, '#f06a20');
    }
    // light: green = working, amber = needs wax, flashing = full of candles
    const full = mc.candles >= f().machineCap(s);
    rect(ctx, m.x + 4, m.y + 12, 3, 3, full ? (Math.floor(t * 3) % 2 ? '#ff6a4a' : '#6a2a2a') : working ? '#8cf06a' : '#f0b030');
    const up = HC.builds.find(s, 'machineUp', 0);
    if (up) drawBuildBar(s, up, m.x + 4, m.y - 4, 22);
  }

  // The request board outside, with a note for each pinned request.
  function drawBoard(s) {
    const b = L.board;
    rect(ctx, b.x - 9, b.y - 12, 18, 11, INK);
    rect(ctx, b.x - 8, b.y - 11, 16, 9, '#c8904a');
    rect(ctx, b.x - 7, b.y - 1, 1, 5, INK);
    rect(ctx, b.x + 6, b.y - 1, 1, 5, INK);
    s.orders.slice(0, 3).forEach((o, k) => {
      rect(ctx, b.x - 7 + k * 5, b.y - 10, 4, 5, '#fff8e0');
      rect(ctx, b.x - 6 + k * 5, b.y - 9, 2, 1, INK);
      rect(ctx, b.x - 6 + k * 5, b.y - 7, 2, 1, D.good[o.good].fill);
    });
  }

  // "CLOSED" sign hanging in the door at night, or the painted bee sign.
  function drawShopSigns(s) {
    const mural = s.cos.placed['deco-mural'];
    rect(ctx, 164, 130, 30, 11, '#4a2a18');
    rect(ctx, 165, 131, 28, 9, mural ? '#8ac8f0' : '#f2b230');
    if (mural) ctx.drawImage(spr.beePortrait('meadow', false), 171, 128, 16, 13);
    else ctx.drawImage(spr.goodIcon('wildflower'), 175, 131);
    if (!f().isOpen(s)) {
      rect(ctx, 146, 131, 12, 6, INK);
      rect(ctx, 147, 132, 10, 4, '#c84a4a');
      rect(ctx, 148, 133, 8, 1, '#fff8e0');
      rect(ctx, 151, 129, 2, 2, INK);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. PEOPLE AND FURNITURE (y-sorted)
  // Each entry is { y, draw }: the lower something stands on screen (bigger y),
  // the later it's drawn, so it appears in front.
  // ---------------------------------------------------------------------------
  function drawActors(s, t) {
    const rt = HC.sim.rt;
    const actors = rt.customers.map((c) => ({ y: c.y, draw: () => drawPerson(c, c.look, t) }));
    for (const w of rt.workers) actors.push({ y: w.y, draw: () => drawWorker(s, w, t) });
    // The counter's front edge: anyone behind it (smaller y) has their legs hidden.
    actors.push({ y: L.counter.y + 4, draw: () => { drawCounter(ctx); drawRegister(s, t); } });
    if (s.merchant) actors.push({ y: L.wagon.y - 1, draw: () => drawWagon(s, t) });
    // Furniture and decorations
    const P = s.cos.placed;
    if (P['deco-table']) actors.push({ y: 86, draw: drawTable });
    if (P['deco-plant']) actors.push({ y: 124, draw: drawPlant });
    if (P['deco-chalk']) actors.push({ y: 152, draw: drawChalkboard });
    if (P['deco-bench']) actors.push({ y: 143, draw: drawBench });
    if (P['deco-gnome']) actors.push({ y: 40, draw: () => drawGnome(t) });
    if (P['deco-fountain']) actors.push({ y: 106, draw: () => drawFountain(t) });
    if (P['deco-lanterns']) actors.push({ y: 70, draw: () => drawLanterns(s, t) });
    // Seasonal specials (playtest 4). The number is where they "stand", so
    // people walking in front of or behind them overlap correctly.
    if (P['deco-blossom']) actors.push({ y: 150, draw: () => drawBlossom(t) });
    if (P['deco-lemonade']) actors.push({ y: 156, draw: drawLemonade });
    if (P['deco-pumpkins']) actors.push({ y: 144, draw: drawPumpkins });
    if (P['deco-tree']) actors.push({ y: 84, draw: () => drawHolidayTree(t) });
    if (P['deco-birdhouse']) actors.push({ y: 80, draw: () => drawBirdhouse(t) });
    if (P['deco-icecream']) actors.push({ y: 158, draw: drawIceCream });
    if (P['deco-scarecrow']) actors.push({ y: 30, draw: () => drawScarecrow(t) });
    if (P['deco-snowman']) actors.push({ y: 157, draw: drawSnowman });
    actors.push({ y: L.board.y + 3, draw: () => drawBoard(s) });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();
  }

  function frameFor(c) {
    return c.path && c.path.length ? Math.floor(c.walk * 8) % 4 : 0;
  }

  function drawPerson(c, look, t) {
    const img = spr.character(look, c.dir, frameFor(c));
    const x = Math.round(c.x - 8), y = Math.round(c.y - 19);
    rect(ctx, x + 4, y + 18, 8, 2, 'rgba(43,29,20,0.25)'); // shadow
    ctx.drawImage(img, x, y);
    if (c.bubble) drawBubble(c.x, c.y - 33, c.bubble, t);
  }

  function drawWorker(s, w, t) {
    const look = w.role === 'keeper' ? spr.keeperLook(s) : D.staff[w.role].look;
    // Behind the register and ringing someone up: a little typing bounce.
    const paying = w.node === 'DESK' && !w.path.length && HC.sim.rt.queue[0] && HC.sim.rt.queue[0].state === 'pay';
    const fake = paying ? { x: w.x, y: w.y, dir: 'down', walk: t, path: Math.floor(t * 6) % 2 ? [1] : [] } : w;
    drawPerson(fake, look, t);
    // Carrying something: a crate held over their head with the product colour.
    const n = Object.keys(w.carry).length;
    if (n) {
      const g = D.good[Object.keys(w.carry)[0]];
      const x = Math.round(w.x - 4), y = Math.round(w.y - 25);
      rect(ctx, x, y, 9, 6, INK);
      rect(ctx, x + 1, y + 1, 7, 4, '#c8904a');
      rect(ctx, x + 2, y - 1, 2, 3, g.fill);
      rect(ctx, x + 5, y - 1, 2, 3, g.fill);
    }
    // A little name tag colour dot so staff are easy to tell apart.
    if (w.role !== 'keeper') rect(ctx, Math.round(w.x) - 1, Math.round(w.y) - 22, 2, 2, '#fff8e0');
  }

  function drawRegister(s, t) {
    const paying = HC.sim.rt.queue[0] && HC.sim.rt.queue[0].state === 'pay';
    rect(ctx, 222, 90, 12, 8, '#8a8a9a');
    rect(ctx, 223, 91, 10, 3, '#3a3a4a');
    rect(ctx, 224, 92, 3, 1, paying && Math.floor(t * 8) % 2 ? '#fff08a' : '#9af09a');
    rect(ctx, 222, 94, 12, 1, '#f2b230');
  }

  function drawBubble(x, y, bubble, t) {
    const bx = Math.round(x - 6), by = Math.round(y);
    const angry = bubble.kind === 'angry';
    rect(ctx, bx, by, 12, 11, INK);
    rect(ctx, bx + 5, by + 11, 2, 2, INK);
    rect(ctx, bx + 1, by + 1, 10, 9, angry ? '#f8c0b0' : '#fffaf0');
    rect(ctx, bx + 5, by + 10, 2, 1, angry ? '#f8c0b0' : '#fffaf0');
    if (bubble.kind === 'good') ctx.drawImage(spr.goodIcon(bubble.good), bx + 2, by + 1);
    else if (bubble.kind === 'heart') ctx.drawImage(spr.misc('heart'), bx + 2, by + 2);
    else if (bubble.kind === 'note') ctx.drawImage(spr.misc('note'), bx + 3, by + 2);
    else if (bubble.kind === 'impatient' || angry) {
      spr.drawText(ctx, '!', bx + 6, by + 3, angry ? '#c83a2a' : '#e8962a', null);
      if (angry) spr.drawText(ctx, '!', bx + 3, by + 3, '#c83a2a', null);
    } else if (bubble.kind === 'dots') {
      ctx.fillStyle = INK;
      const n = 1 + (Math.floor(t * 4) % 3);
      for (let i = 0; i < n; i++) ctx.fillRect(bx + 3 + i * 2, by + 6, 1, 1);
    }
  }

  function drawWagon(s, t) {
    const x = L.wagon.x - 20, y = L.wagon.y - 22;
    rect(ctx, x + 4, y + 16, 7, 7, INK);
    rect(ctx, x + 27, y + 16, 7, 7, INK);
    rect(ctx, x + 5, y + 17, 5, 5, '#c8a060');
    rect(ctx, x + 28, y + 17, 5, 5, '#c8a060');
    rect(ctx, x, y + 6, 38, 12, INK);
    rect(ctx, x + 1, y + 7, 36, 10, '#4a7a9a');
    rect(ctx, x + 1, y + 7, 36, 2, '#6a9aba');
    for (let i = 0; i < 38; i += 4) rect(ctx, x + i, y, 4, 5, (i / 4) % 2 ? '#fff4d8' : '#d84a4a');
    rect(ctx, x, y + 5, 38, 1, INK);
    ctx.drawImage(spr.beePortrait(s.merchant.offer.sp, s.merchant.offer.sparkle), x + 11, y + 4);
    ctx.drawImage(spr.character(MERCHANT_LOOK, 'down', 0), x + 38, y + 3);
    if (Math.floor(t * 2) % 2 === 0) spr.drawText(ctx, '!', x + 46, y - 4, '#fff08a');
  }

  // --- Decorations ---------------------------------------------------------------
  function drawTable() {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(118, 84, 26, 3, 'rgba(43,29,20,0.25)');
    r(117, 70, 28, 13, INK);
    r(118, 71, 26, 9, '#c88a4a');
    r(118, 71, 26, 1, '#e8b070');
    r(118, 80, 26, 2, '#8a5a2a');
    r(119, 82, 2, 4, '#6a3a1a');
    r(141, 82, 2, 4, '#6a3a1a');
    const jar = (x, y) => { r(x, y, 5, 6, INK); r(x + 1, y + 2, 3, 3, '#f8c838'); r(x + 1, y + 1, 3, 1, '#c8642a'); r(x + 1, y + 2, 1, 1, '#fde8a0'); };
    jar(121, 70); jar(126, 70); jar(131, 70); jar(136, 70);
    jar(123, 65); jar(128, 65); jar(133, 65);
    jar(126, 60); jar(131, 60);
    r(138, 76, 5, 2, '#fff4d8');
    r(139, 75, 3, 1, '#f8c838');
  }
  function drawPlant() {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(228, 116, 8, 8, INK); r(229, 117, 6, 6, '#b86a32');
    r(226, 108, 4, 4, '#4a9a3c'); r(231, 104, 4, 7, '#5aae48'); r(228, 102, 3, 5, '#6cc054'); r(233, 110, 3, 3, '#4a9a3c');
  }
  // ---- Seasonal specials ------------------------------------------------
  // Spring: a flowering tree in a planter, outside right of the shop.
  function drawBlossom(t) {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(224, 144, 14, 6, INK); r(225, 145, 12, 4, '#a86a32'); r(225, 145, 12, 1, '#c8884a'); // planter
    r(230, 132, 2, 12, '#6a4a2a'); // trunk
    for (const [x, y, w, h] of [[223, 124, 16, 9], [225, 121, 12, 3], [221, 127, 3, 4], [238, 127, 2, 4]]) r(x, y, w, h, '#f4a8c4');
    for (const [x, y] of [[225, 125], [229, 123], [234, 126], [227, 129], [236, 130], [231, 128]]) r(x, y, 2, 2, '#fff0f6');
    // a petal drifting down
    const k = (t * 0.4) % 1;
    r(Math.round(236 - k * 10), Math.round(130 + k * 18), 1, 1, '#f4a8c4');
  }
  // Summer: a striped lemonade stand on the street, left of the door.
  function drawLemonade() {
    // Drawn relative to (ox, oy) = its top-left corner, on the street at the
    // bottom-left of the picture.
    const ox = 2, oy = 134;
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    r(3, 3, 1, 10, INK); r(25, 3, 1, 10, INK); // awning poles
    r(0, 0, 29, 5, INK);
    for (let k = 0; k < 7; k++) r(1 + k * 4, 1, 4, 3, k % 2 ? '#fff8e0' : '#f8d030'); // striped awning
    r(1, 12, 27, 10, INK); r(2, 13, 25, 8, '#f8e8a0'); r(2, 16, 25, 1, '#e8c860'); // counter
    r(12, 8, 5, 5, INK); r(13, 9, 3, 3, '#fff070'); // pitcher of lemonade
    r(19, 10, 2, 3, '#e8f4ff'); r(6, 10, 2, 3, '#e8f4ff'); // cups
  }
  // Autumn: three pumpkins beside the garden path, near the street.
  function drawPumpkins() {
    const r = (x, y, w, h, c) => rect(ctx, x + 31, y, w, h, c); // shifted 31px right
    for (const [x, y, w] of [[2, 137, 7], [9, 138, 6], [5, 132, 6]]) {
      r(x, y, w, 5, INK); r(x + 1, y + 1, w - 2, 3, '#e8762a'); r(x + Math.floor(w / 2), y + 1, 1, 3, '#c85a1a');
      r(x + Math.floor(w / 2), y - 1, 1, 2, '#4a7a2a'); // stem
    }
    r(13, 135, 3, 2, '#5aae48'); // a leaf
  }
  // Winter: a decorated tree inside the shop, beside the Candle Machine.
  function drawHolidayTree(t) {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(190, 79, 6, 5, INK); r(191, 80, 4, 3, '#b8483a'); // pot
    for (let k = 0; k < 18; k++) {
      const w = 2 + Math.floor((k % 6) * 1.6) + Math.floor(k / 6) * 2; // three tiers, wider going down
      r(193 - Math.floor(w / 2), 61 + k, w, 1, k % 6 === 5 ? '#2e6e2e' : '#3e8e3e');
    }
    r(192, 57, 3, 3, '#ffd23a'); // star on top
    const on = Math.floor(t * 2) % 2;
    for (const [x, y, c] of [[190, 66, '#f07898'], [195, 70, '#8ad0f0'], [189, 74, '#ffd23a'], [197, 76, '#f07898'], [193, 72, '#fff8e0']]) r(x, y, 1, 1, on ? c : '#fff8e0');
  }

  // ---- Seasonal specials, second set (alternate years) --------------------
  // Spring: a birdhouse on a post between the pond and the fountain.
  function drawBirdhouse(t) {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(92, 70, 2, 10, INK); r(92, 70, 1, 10, '#8a5a2a'); // post
    r(88, 62, 10, 8, INK); r(89, 63, 8, 6, '#6ab0d8'); // box
    r(87, 60, 12, 3, INK); r(88, 60, 10, 2, '#c84a4a'); // roof
    r(92, 65, 2, 2, INK); // hole
    if (Math.floor(t * 0.7) % 3 === 0) { r(95, 58, 2, 2, '#8a5a2a'); r(97, 58, 1, 1, '#f2b230'); } // a little bird on the roof
  }
  // Summer: an ice cream cart on the street, below the bench (with a flag
  // on a pole rather than an umbrella, so it doesn't cover the bench).
  function drawIceCream() {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(78, 136, 1, 11, INK); // flag pole beside the bench
    r(79, 136, 6, 4, INK); r(79, 137, 5, 2, '#f07898');
    r(58, 147, 22, 8, INK); r(59, 148, 20, 6, '#f4f0e8'); r(59, 150, 20, 1, '#8ad0f0'); // cart
    r(61, 155, 4, 4, INK); r(73, 155, 4, 4, INK); // wheels
    r(64, 144, 3, 4, '#c88a4a'); r(64, 142, 3, 2, '#f8b8d0'); // cones on top
    r(70, 144, 3, 4, '#c88a4a'); r(70, 142, 3, 2, '#fff0a0');
  }
  // Autumn: a scarecrow at the top of the garden, between the first hives.
  function drawScarecrow(t) {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    const sway = Math.round(Math.sin(t * 1.5));
    r(39, 12, 2, 18, '#8a5a2a'); // pole
    r(33 + sway, 13, 14, 2, '#8a5a2a'); // arms
    r(36, 14, 8, 8, INK); r(37, 15, 6, 6, '#c86a3a'); // patched shirt
    r(38, 7, 5, 6, INK); r(39, 8, 3, 4, '#f2dfb4'); // head
    r(36, 5, 9, 3, INK); r(37, 5, 7, 2, '#d8b060'); // straw hat
    r(33 + sway, 15, 2, 2, '#f2d060'); r(45 + sway, 15, 2, 2, '#f2d060'); // straw hands
  }
  // Winter: a snowman at the street edge by the lamp post.
  function drawSnowman() {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(86, 147, 12, 10, INK); r(87, 148, 10, 8, '#f8fbff'); // bottom
    r(88, 140, 8, 8, INK); r(89, 141, 6, 6, '#f8fbff'); // head
    r(90, 143, 1, 1, INK); r(93, 143, 1, 1, INK); r(91, 145, 2, 1, '#f08a3a'); // face and carrot
    r(88, 147, 8, 2, '#c84a4a'); // scarf
    r(88, 136, 8, 2, INK); r(89, 133, 6, 3, INK); // top hat
  }

  function drawChalkboard() {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(125, 139, 14, 12, INK); r(126, 140, 12, 9, '#2e4a3a');
    r(128, 142, 8, 1, '#f4f4ec'); r(128, 145, 5, 1, '#f8c838'); r(128, 147, 6, 1, '#f4f4ec');
    r(126, 150, 1, 3, INK); r(137, 150, 1, 3, INK);
  }
  function drawBench() {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(58, 135, 16, 3, INK); r(59, 136, 14, 1, '#b8783a');
    r(58, 139, 16, 3, INK); r(59, 140, 14, 1, '#c8884a');
    r(59, 142, 2, 2, INK); r(71, 142, 2, 2, INK);
  }
  function drawGnome(t) {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(88, 28, 5, 1, INK); r(87, 29, 7, 4, '#c84a4a'); r(89, 25, 3, 4, '#c84a4a'); r(90, 23, 1, 2, '#c84a4a'); // hat
    r(88, 33, 5, 3, '#f8c898'); r(88, 35, 5, 3, '#f4f4f0'); // face + beard
    r(87, 38, 7, 3, '#4a6a9a'); r(88, 41, 2, 1, INK); r(91, 41, 2, 1, INK);
    // a tiny bee buzzing around it
    rect(ctx, Math.round(90 + Math.cos(t * 3) * 5), Math.round(30 + Math.sin(t * 4) * 3), 2, 1, '#f8c838');
  }
  function drawFountain(t) {
    const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
    r(83, 96, 16, 9, INK); r(84, 97, 14, 7, '#b8b8c0'); r(85, 98, 12, 3, '#6ab8e0');
    r(90, 90, 2, 8, '#a8a8b0'); r(88, 89, 6, 2, '#a8a8b0');
    const k = (t * 2) % 1;
    r(89, 86 - Math.round(k * 2), 1, 2, '#c8ecf8'); r(92, 86 - Math.round((1 - k) * 2), 1, 2, '#c8ecf8');
  }
  function drawLanterns(s, t) {
    const night = lightLevels(s).night;
    for (const [x, y] of [[40, 60], [56, 60], [40, 108], [56, 108]]) {
      rect(ctx, x, y - 8, 1, 10, INK);
      rect(ctx, x - 1, y - 11, 3, 4, INK);
      rect(ctx, x, y - 10, 1, 2, night > 0.3 ? '#ffe08a' : '#c8b070');
    }
  }

  // ---------------------------------------------------------------------------
  // 5. WEATHER AND LIGHT
  // ---------------------------------------------------------------------------
  function drawWeather(s, t) {
    const id = f().season(s).id;
    const insideShop = (x, y) => x >= 112 && y < 128;
    if (id === 'winter') {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 46; i++) {
        const sp = 10 + (i % 5) * 3;
        const x = Math.floor((i * 53 + Math.sin(t * 0.8 + i) * 6 + 400) % 240);
        const y = Math.floor((i * 37 + t * sp) % 160);
        if (!insideShop(x, y)) ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, 1);
      }
    } else if (id === 'autumn') {
      for (let i = 0; i < 9; i++) {
        const x = Math.floor((i * 29 + Math.sin(t * 1.3 + i) * 10 + 200) % 104);
        const y = Math.floor((i * 41 + t * (8 + i)) % 150);
        rect(ctx, x, y, 2, 1, AUTUMN_COLS[i % 4]);
      }
    } else if (id === 'spring') {
      ctx.fillStyle = '#f8b8d0';
      for (let i = 0; i < 6; i++) {
        const x = Math.floor((i * 37 + t * 9 + Math.sin(t + i) * 8) % 104);
        const y = Math.floor((i * 23 + Math.cos(t * 0.7 + i) * 20 + t * 4) % 144);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // How dark it is: night 0 (day) to 1 (night), dusk = warm sunset glow.
  function lightLevels(s) {
    const p = f().dayPhase(s);
    let night = 0, dusk = 0;
    if (p >= 0.6 && p < 0.7) {
      const k = (p - 0.6) / 0.1;
      dusk = Math.sin(Math.PI * k);
      night = k;
    } else if (p >= 0.7 && p < 0.95) night = 1;
    else if (p >= 0.95) night = 1 - (p - 0.95) / 0.05;
    return { night, dusk };
  }

  function mixRGB(a, b, k) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * k));
  }

  // Tint everything blue at night (or orange at dusk), then add glowing
  // circles for lamps and the lit shop.
  function drawLighting(s, t) {
    const { night, dusk } = lightLevels(s);
    if (night <= 0.01 && dusk <= 0.01) return;
    let outside = [255, 255, 255];
    outside = mixRGB(outside, [255, 190, 140], dusk * 0.8);
    outside = mixRGB(outside, [78, 88, 160], night * 0.9);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${outside})`;
    ctx.fillRect(0, 0, L.W, L.H);
    ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, a) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,190,90,${a})`);
      gr.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const flicker = 0.02 * Math.sin(t * 13) + 0.02 * Math.sin(t * 7.3);
    glow(176, 70, 90, (0.28 + flicker) * night);
    glow(107, 114, 22, (0.5 + flicker) * night);
    glow(128, 136, 16, 0.35 * night);
    glow(220, 136, 16, 0.35 * night);
    if (s.cos.placed['deco-lanterns']) for (const [x, y] of [[40, 50], [56, 50], [40, 98], [56, 98]]) glow(x, y, 12, 0.45 * night);
    if (s.cos.placed['deco-lights']) glow(176, 6, 60, 0.2 * night);
    ctx.globalCompositeOperation = 'source-over';
    if (night > 0.5) {
      ctx.fillStyle = `rgba(255,250,220,${(night - 0.5) * 1.4})`;
      const rnd = util.seeded(99);
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(rnd() * 96), y = Math.floor(rnd() * 30);
        if (Math.sin(t * 2 + i) > -0.3) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. OVERLAYS
  // ---------------------------------------------------------------------------
  function drawDrip(t) {
    const d = HC.sim.rt.drip;
    if (!d) return;
    const [cx, cy] = L.hiveSlots[d.hive];
    const x = cx * 16 + 8, y = cy * 16 - 14 + Math.round(Math.sin(t * 5) * 2);
    if (d.left < 3 && Math.floor(t * 8) % 2) return; // blinking: about to vanish
    ctx.fillStyle = '#fff6b0';
    for (let i = 0; i < 4; i++) {
      const a = t * 3 + (i * Math.PI) / 2;
      ctx.fillRect(Math.round(x + Math.cos(a) * 8), Math.round(y + Math.sin(a) * 6), 1, 1);
    }
    rect(ctx, x - 3, y - 2, 7, 6, INK);
    rect(ctx, x - 2, y - 4, 5, 2, INK);
    rect(ctx, x - 1, y - 6, 3, 2, INK);
    rect(ctx, x - 2, y - 2, 5, 5, '#ffd23a');
    rect(ctx, x - 1, y - 4, 3, 2, '#ffd23a');
    rect(ctx, x, y - 5, 1, 1, '#ffd23a');
    rect(ctx, x - 1, y - 1, 1, 2, '#fff4c0');
  }

  // A 7×7 face for reputation changes: yellow smiley or red frown, with a
  // "+" or "-" beside it. (Playtest 3: the old star looked like a plus.)
  function drawRepFace(e) {
    const k = e.t / e.life;
    const x = Math.round(e.x - 2), y = Math.round(e.y - k * 12);
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const face = e.happy ? '#ffd23a' : '#ff7a6a';
    rect(ctx, x, y + 1, 7, 5, INK); // dark outline
    rect(ctx, x + 1, y, 5, 7, INK);
    rect(ctx, x + 1, y + 1, 5, 5, face);
    rect(ctx, x + 2, y + 2, 1, 1, INK); // eyes
    rect(ctx, x + 4, y + 2, 1, 1, INK);
    if (e.happy) {
      rect(ctx, x + 2, y + 4, 3, 1, INK); // smile: corners up
      rect(ctx, x + 1, y + 3, 1, 1, INK);
      rect(ctx, x + 5, y + 3, 1, 1, INK);
    } else {
      rect(ctx, x + 2, y + 4, 3, 1, INK); // frown: corners down
      rect(ctx, x + 1, y + 5, 1, 1, INK);
      rect(ctx, x + 5, y + 5, 1, 1, INK);
    }
    spr.drawText(ctx, e.happy ? '+' : '-', x - 3, y + 1, e.happy ? '#fff08a' : '#ff7a6a');
    ctx.globalAlpha = 1;
  }

  function drawFx() {
    for (const e of HC.sim.rt.fx) {
      if (e.kind === 'rep') drawRepFace(e);
      if (e.kind !== 'text') continue;
      const k = e.t / e.life;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      spr.drawText(ctx, e.text, e.x, e.y - k * 14, e.color || '#fff08a');
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Draw one complete frame.
  // ---------------------------------------------------------------------------
  function draw(s, t) {
    ctx.drawImage(staticFor(s), 0, 0);
    drawFlowerBeds(s, t);
    drawFlowers(s, t);
    drawGardenFlat(s, t);
    drawHives(s, t);
    drawShelves(s, t);
    drawShopFlat(s);
    drawCrates(s);
    drawMachine(s, t);
    drawShopSigns(s);
    drawActors(s, t);
    drawBees(s, t);
    drawWeather(s, t);
    drawLighting(s, t);
    drawDrip(t);
    drawFx();
    drawGuideArrow(t);
  }

  // ---------------------------------------------------------------------------
  // What did the player tap? x/y are in game pixels (0-240, 0-160).
  // ---------------------------------------------------------------------------
  function hitTest(s, x, y) {
    const d = HC.sim.rt.drip;
    if (d) {
      const [cx, cy] = L.hiveSlots[d.hive];
      if (Math.abs(x - (cx * 16 + 8)) < 12 && y > cy * 16 - 26 && y < cy * 16 - 2) return { kind: 'drip' };
    }
    for (let i = 0; i < L.hiveSlots.length; i++) {
      const [cx, cy] = L.hiveSlots[i];
      if (x >= cx * 16 - 2 && x < cx * 16 + 18 && y >= cy * 16 - 14 && y < cy * 16 + 22) {
        if (s.hives[i]) return { kind: 'hive', index: i };
        if (i === s.hives.length) return { kind: 'buildHive' };
      }
    }
    if (y >= 6 && y < 34 && x >= 112 && x < 240) {
      const i = Math.floor((x - 112) / 16);
      if (s.shelves[i]) return { kind: 'shelf', index: i };
      return { kind: 'buyShelf' };
    }
    const m = L.machine;
    if (x >= m.x && x < m.x + m.w && y >= m.y - 4 && y < m.y + m.h) return { kind: 'machine' };
    const c = L.crates;
    if (x >= c.x && x < c.x + c.w && y >= c.y - 4 && y < c.y + c.h) return { kind: 'crates' };
    if (Math.abs(x - L.board.x) < 11 && y >= L.board.y - 14 && y < L.board.y + 5) return { kind: 'board' };
    if (s.merchant && x >= L.wagon.x - 22 && x < L.wagon.x + 34 && y >= L.wagon.y - 26 && y < L.wagon.y + 4) return { kind: 'merchant' };
    // Tapping a worker (within a person-sized box around their feet)
    for (const w of HC.sim.rt.workers) {
      if (Math.abs(x - w.x) < 7 && y > w.y - 20 && y < w.y + 2) return { kind: 'worker', role: w.role };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Store previews: draw one decoration on a blank canvas using the same code
  // as the scene, then cut out the area around it.
  // ---------------------------------------------------------------------------
  const THUMB_BOX = {
    'deco-table': [114, 56, 34, 32, drawTable],
    'deco-plant': [222, 100, 16, 26, drawPlant],
    'deco-rug': [138, 115, 28, 14, drawRug],
    'deco-chalk': [122, 136, 20, 19, drawChalkboard],
    'deco-lights': [112, 0, 44, 9, () => drawLightsOnly()],
    'deco-mural': [162, 126, 34, 17, () => drawShopSigns({ cos: { placed: { 'deco-mural': true } }, time: 0 })],
    'deco-bench': [55, 132, 22, 14, drawBench],
    'deco-gnome': [84, 20, 12, 24, () => drawGnome(0)],
    'deco-lanterns': [36, 46, 24, 66, () => drawLanterns(HC.game, 0)],
    'deco-pond': [80, 46, 22, 16, () => drawGardenFlat({ cos: { placed: { 'deco-pond': true } } }, 0)],
    'deco-fountain': [81, 83, 20, 24, () => drawFountain(0)],
    'deco-blossom': [220, 120, 20, 31, () => drawBlossom(0)],
    'deco-lemonade': [1, 133, 31, 24, drawLemonade],
    'deco-pumpkins': [32, 130, 16, 13, drawPumpkins],
    'deco-tree': [186, 56, 14, 29, () => drawHolidayTree(0)],
    'deco-birdhouse': [85, 56, 16, 25, () => drawBirdhouse(0)],
    'deco-icecream': [56, 134, 30, 26, drawIceCream],
    'deco-scarecrow': [31, 3, 18, 28, () => drawScarecrow(0)],
    'deco-snowman': [84, 131, 16, 27, drawSnowman],
  };
  function drawLightsOnly() {
    for (let x = 114; x < 158; x += 6) {
      const sag = Math.round(Math.sin(((x - 114) / 124) * Math.PI * 4) * 1.5) + 3;
      rect(ctx, x, sag, 6, 1, '#4a3a2a');
      rect(ctx, x + 2, sag + 1, 2, 2, ['#ffd23a', '#f07898', '#8ad0f0', '#8cd06a'][(x / 6) % 4 | 0]);
    }
  }
  const thumbCache = {};
  function decorThumb(id) {
    if (thumbCache[id]) return thumbCache[id];
    const box = THUMB_BOX[id];
    if (!box) return null;
    const [x, y, w, h, fn] = box;
    const full = spr.canvas(L.W, L.H);
    const saved = ctx;
    ctx = full.getContext('2d');
    // A patch of grass or floor behind it, so it reads like the scene.
    rect(ctx, x, y, w, h, x < 110 ? '#6cbc54' : '#f2dfb4');
    try { fn(); } finally { ctx = saved; }
    const out = spr.canvas(w, h);
    out.getContext('2d').drawImage(full, x, y, w, h, 0, 0, w, h);
    thumbCache[id] = { url: out.toDataURL(), w, h };
    return thumbCache[id];
  }

  // The guide arrow (playtest 3): when an early goal says "tap a hive", a
  // bouncing arrow points at it. ui.js sets HC.render.guide = { hive: i }.
  function drawGuideArrow(t) {
    const g = HC.render.guide;
    if (!g || g.hive == null || !L.hiveSlots[g.hive]) return;
    if (Math.floor(t * 2.5) % 3 === 2) return; // slow blink
    // Beside the hive (the top row of hives is right at the top edge of the
    // picture, so an arrow above would be cut off), pointing left at it.
    const [cx, cy] = L.hiveSlots[g.hive];
    const x = cx * 16 + 20 + Math.round(Math.sin(t * 5) * 2), y = cy * 16 + 4;
    for (let k = 0; k < 5; k++) {
      rect(ctx, x + k, y - k - 1, 1, 2 * k + 3, INK); // arrow head outline
      if (k) rect(ctx, x + k, y - k, 1, 2 * k + 1, '#ffd23a');
    }
    rect(ctx, x + 5, y - 3, 7, 7, INK); // shaft
    rect(ctx, x + 5, y - 2, 6, 5, '#ffd23a');
  }

  HC.render = { init, draw, hitTest, lightLevels, decorThumb, guide: null };
})();
