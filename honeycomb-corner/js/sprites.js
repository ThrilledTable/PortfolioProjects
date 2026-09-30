// =============================================================================
// sprites.js: ALL THE PIXEL ART
// -----------------------------------------------------------------------------
// There are no image files in this game. Every picture is drawn by code,
// either:
//   - from a little text "grid", where each letter stands for a colour (see
//     the character heads below: 'k' is the dark outline, 'h' is hair...), or
//   - by drawing rectangles and circles directly (hives, bees, the machine).
//
// Drawing is fairly slow, so every picture is drawn once into a small hidden
// canvas and remembered ("cached"). After that, the game just copies it.
//
// The same pictures are also turned into image links (data URLs) so the
// menus can show them: the bee portraits in the Apiary, product icons, etc.
// =============================================================================
(function () {
  const HC = window.HC;
  const D = HC.data;
  const cache = new Map();

  const INK = '#2b1d14'; // the dark brown used for every outline

  // Make a blank hidden drawing surface of the given size.
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Build a picture once, then reuse it: cached('name', () => draw it).
  function cached(key, build) {
    if (!cache.has(key)) cache.set(key, build());
    return cache.get(key);
  }

  // Draw a text grid: each character maps to a colour in `pal`; '.' is
  // transparent. `flip` mirrors it left-to-right.
  function drawGrid(ctx, rows, pal, ox = 0, oy = 0, flip = false) {
    const w = rows[0].length;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = pal[row[x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(ox + (flip ? w - 1 - x : x), oy + y, 1, 1);
      }
    });
  }

  function gridCanvas(rows, pal, flip) {
    const c = canvas(rows[0].length, rows.length);
    drawGrid(c.getContext('2d'), rows, pal, 0, 0, flip);
    return c;
  }

  // Lighten (amt > 0) or darken (amt < 0) a colour. shade('#808080', 0.5)
  // is halfway to white.
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // Blend two colours: mix(a, b, 0.25) is 25% of the way from a to b.
  function mix(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (n, sh) => (n >> sh) & 255;
    const m = (sh) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * k);
    return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
  }

  // ---------------------------------------------------------------------------
  // PEOPLE (16 pixels wide, 20 tall; the top 4 rows are room for hats)
  // Letters: k outline, h/H hair and hair shadow, s/S skin and shadow,
  //          u/U shirt and shadow, e trousers.
  // Heads and bodies are drawn separately so they can be mixed and matched.
  // ---------------------------------------------------------------------------
  const HEAD_FRONT = [
    '................',
    '....kkkkkkkk....',
    '...khhhhhhhhk...',
    '..khhhhhhhhhhk..',
    '..khHhhhhhhHhk..',
    '..kHssssssssHk..',
    '..kssksssskssk..',
    '..kssksssskssk..',
    '...kssssssssk...',
    '....kkSSSSkk....',
  ];
  const HEAD_BACK = [
    '................',
    '....kkkkkkkk....',
    '...khhhhhhhhk...',
    '..khhhhhhhhhhk..',
    '..khhhhhhhhhhk..',
    '..khhhhhhhhhhk..',
    '..kHhhhhhhhhHk..',
    '..kHHhhhhhhHHk..',
    '...kHHHHHHHHk...',
    '....kkSSSSkk....',
  ];
  const HEAD_SIDE = [
    '................',
    '.....kkkkkkk....',
    '....khhhhhhhk...',
    '...khhhhhhhhhk..',
    '...khhhhhhHHhk..',
    '...kssshhhhHHk..',
    '...ksksshhhHHk..',
    '..ksssssshhhk...',
    '...kssssssHk....',
    '....kkSSSkk.....',
  ];
  // Two frames each: standing, and mid-step (legs apart).
  const BODY_FRONT = [
    ['...kuuuuuuuuk...', '..ksuuuuuuuusk..', '..ksuUUUUUUusk..', '...kkeeeeeekk...', '....kek..kek....', '....kk....kk....'],
    ['...kuuuuuuuuk...', '..ksuuuuuuuusk..', '..ksuUUUUUUusk..', '...kkeeeeeekk...', '....kek..kkk....', '....kk..........'],
  ];
  const BODY_BACK = [
    ['...kuuuuuuuuk...', '..ksuuuuuuuusk..', '..ksUUUUUUUUsk..', '...kkeeeeeekk...', '....kek..kek....', '....kk....kk....'],
    ['...kuuuuuuuuk...', '..ksuuuuuuuusk..', '..ksUUUUUUUUsk..', '...kkeeeeeekk...', '....kek..kkk....', '....kk..........'],
  ];
  const BODY_SIDE = [
    ['....kuuuuuk.....', '....kuuuusk.....', '....kUUUUsk.....', '....kkeeekk.....', '....kek.kek.....', '....kk..kk......'],
    ['....kuuuuuk.....', '....kuuuusk.....', '....kUUUUsk.....', '....kkeeek......', '.....keeek......', '.....kkkk.......'],
  ];

  function charPalette(look) {
    return {
      k: INK, h: look.hair[0], H: look.hair[1], s: look.skin[0], S: look.skin[1],
      u: look.shirt[0], U: look.shirt[1], e: '#4a3a5a', w: '#fff8e8',
    };
  }

  // Hats are painted on top of the head. `dir` is which way the person faces.
  function drawHat(ctx, hat, dir) {
    const side = dir === 'left' || dir === 'right';
    const px = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    if (hat === 'cap') {
      px(4, 5, 8, 2, '#3a6a2a');
      px(3, 5, 1, 2, INK); px(12, 5, 1, 2, INK); px(4, 4, 8, 1, INK);
      if (dir === 'down') px(3, 7, 10, 1, '#2a4a1e');
      if (side) px(1, 7, 5, 1, '#2a4a1e');
    } else if (hat === 'chef') {
      px(4, 0, 8, 6, '#fbf8f0');
      px(3, 1, 1, 4, INK); px(12, 1, 1, 4, INK); px(4, 0, 8, 1, INK);
      px(4, 5, 8, 1, '#d8d0c0');
    } else if (hat === 'tophat') {
      px(5, 0, 6, 5, '#2a2232');
      px(5, 3, 6, 1, '#8a2a3a');
      px(3, 5, 10, 1, '#2a2232');
      px(4, 0, 1, 5, INK); px(11, 0, 1, 5, INK);
    } else if (hat === 'beret') {
      px(3, 4, 9, 2, '#b03a78');
      px(4, 3, 7, 1, '#b03a78');
      px(10, 2, 1, 1, INK);
      px(3, 3, 1, 1, INK); px(12, 4, 1, 1, INK);
    } else if (hat === 'bandana') {
      px(3, 5, 10, 2, '#e8a020');
      px(3, 6, 10, 1, '#b87818');
    } else if (hat === 'straw') {
      px(5, 2, 6, 3, '#e8c870');
      px(5, 4, 6, 1, '#c84a3a'); // ribbon
      px(1, 5, 14, 1, '#d8b058');
      px(1, 6, 14, 1, '#b8903a');
      px(4, 2, 1, 3, INK); px(11, 2, 1, 3, INK); px(5, 1, 6, 1, INK);
    } else if (hat === 'crown') {
      // A ring of flowers
      const cols = ['#f07898', '#ffffff', '#f8d030', '#b890e8', '#f07898'];
      cols.forEach((c, i) => px(3 + i * 2, 4, 2, 2, c));
      px(4, 5, 8, 1, '#4a9a3c');
    }
  }

  // Draw a person. `look` = { hair, skin, shirt, hat, apron }.
  // dir: 'down' | 'up' | 'left' | 'right'; frame: 0-3 of the walk cycle.
  function character(look, dir, frame) {
    const key = ['ch', look.hair, look.skin, look.shirt, look.hat, look.apron, dir, frame].join('|');
    return cached(key, () => {
      const c = canvas(16, 20);
      const ctx = c.getContext('2d');
      const pal = charPalette(look);
      const step = frame === 1 ? 1 : 0; // frames 1 and 3 use the stepping legs
      const flip = frame === 3; // frame 3 is frame 1 mirrored (other foot)
      let head, body, hflip = false;
      if (dir === 'down') { head = HEAD_FRONT; body = BODY_FRONT[step]; }
      else if (dir === 'up') { head = HEAD_BACK; body = BODY_BACK[step]; }
      else { head = HEAD_SIDE; body = BODY_SIDE[frame === 1 || frame === 3 ? 1 : 0]; hflip = dir === 'right'; }
      const rows = head.concat(body);
      const tmp = gridCanvas(rows, pal, hflip !== (flip && (dir === 'down' || dir === 'up')));
      const bob = frame === 1 || frame === 3 ? 1 : 0; // bounce while walking
      ctx.drawImage(tmp, 0, 4 + bob);
      if (look.hat) {
        ctx.save();
        ctx.translate(0, bob);
        if (hflip) {
          ctx.translate(16, 0);
          ctx.scale(-1, 1);
        }
        drawHat(ctx, look.hat, dir);
        ctx.restore();
      }
      if (look.apron && dir !== 'up') {
        ctx.fillStyle = look.apron;
        ctx.fillRect(5, 15 + bob, dir === 'down' ? 6 : 4, 2);
      }
      return c;
    });
  }

  // The shopkeeper's look comes from what you've equipped in the Store.
  function keeperLook(s) {
    const eq = s.cos.equip;
    const item = (cat, fallback) => D.item[eq[cat]] || D.item[fallback];
    return {
      hair: item('hair', 'hair-brown').colors,
      skin: ['#f8c898', '#d89868'],
      shirt: item('shirt', 'shirt-cream').colors,
      hat: item('hat', 'hat-bandana').value,
      apron: item('apron', 'apron-honey').colors[0],
    };
  }

  // ---------------------------------------------------------------------------
  // BEE PORTRAITS (16×16), built from each species' shape and colours.
  // ---------------------------------------------------------------------------
  // Sparkle bees keep their species colours with a rose-gold sheen.
  function sparklePalette(sp) {
    return { body: mix(sp.body, '#ffc8dc', 0.45), stripe: mix(sp.stripe, '#b0306a', 0.35), wing: '#ffe6f2' };
  }

  function beePortrait(spId, sparkle) {
    return cached('bee|' + spId + '|' + !!sparkle, () => {
      const sp = D.species[spId];
      const col = sparkle ? sparklePalette(sp) : { body: sp.body, stripe: sp.stripe, wing: sp.wing };
      const N = 16;
      // Work on a 16×16 grid of colours first, then outline it, then paint it.
      const px = Array.from({ length: N }, () => Array(N).fill(null));
      const set = (x, y, c) => {
        if (x >= 0 && y >= 0 && x < N && y < N) px[y][x] = c;
      };
      const shp = Object.assign({ rx: 4.7, ry: 3.3, wing: 'round', stripes: 'double' }, sp.shape || {});
      // Wings sit behind the body. Each style gives a different silhouette.
      // e() tests "inside an oval", d() "inside a diamond".
      const inWing = (x, y) => {
        const e = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
        const d = (cx, cy, a, b) => Math.abs(x - cx) / a + Math.abs(y - cy) / b <= 1;
        switch (shp.wing) {
          case 'small': return e(7.5, 5.5, 2.1, 2.4) || e(10.5, 6, 1.8, 2.1);
          case 'long': return e(9, 4.2, 4.3, 2.1) || e(12, 5.6, 3.2, 1.8);
          case 'moth': return e(7, 4.6, 3.5, 4) || e(11.6, 5.4, 3.1, 3.4);
          case 'angular': return d(7.5, 4, 2.8, 3.8) || d(11.5, 4.8, 2.4, 3.2);
          default: return e(7.5, 4.5, 2.6, 3.3) || e(11, 5, 2.2, 2.8);
        }
      };
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inWing(x, y)) set(x, y, col.wing);
      const vein = shade(col.wing, -0.18);
      if (shp.wing === 'moth') {
        set(6, 4, col.stripe); set(11, 5, col.stripe); set(7, 3, vein); set(12, 4, vein);
      } else if (shp.wing === 'angular') {
        set(7, 3, '#ffffff'); set(8, 4, vein); set(11, 4, '#ffffff');
      } else {
        set(8, 4, vein); set(11, 5, vein);
      }
      // The striped body ("abdomen"). The pattern depends on the species.
      const bands = {
        double: (x) => x === 8 || x === 9 || x === 12 || x === 13,
        triple: (x) => x === 7 || x === 10 || x === 13,
        single: (x) => x === 10 || x === 11,
        spots: (x, y) => (x + y) % 4 === 0,
      }[shp.stripes];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (((x - (5.1 + shp.rx)) / shp.rx) ** 2 + ((y - 10.2) / shp.ry) ** 2 <= 1) {
          set(x, y, bands(x, y) ? col.stripe : col.body);
        }
      }
      set(7, 11 - Math.round(shp.ry), shade(col.body, 0.5)); set(10, 11 - Math.round(shp.ry), shade(col.body, 0.5)); // shine
      // Head
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (((x - 4) / 2.7) ** 2 + ((y - 10.3) / 2.6) ** 2 <= 1) set(x, y, shade(col.stripe, 0.12));
      }
      set(15, 10, INK); // stinger
      set(7, 14, INK); set(10, 14, INK); // legs
      // Outline: any empty pixel touching a coloured one becomes dark.
      const out = px.map((r) => r.slice());
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (px[y][x]) continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => px[y + dy] && px[y + dy][x + dx] && px[y + dy][x + dx] !== INK);
        if (nb) out[y][x] = INK;
      }
      // Eye and antennae on top.
      out[9][3] = '#fffdf4';
      out[10][3] = INK;
      out[9][2] = '#fffdf4';
      out[7][3] = INK; out[6][2] = INK; out[5][2] = INK; out[4][1] = INK;
      out[7][5] = INK; out[6][5] = INK; out[5][6] = INK;
      if (sp.shape && sp.shape.feathery) {
        out[4][0] = INK; out[5][1] = INK; out[4][6] = INK; out[4][7] = INK; out[5][7] = INK;
      }
      const c = canvas(N, N);
      const ctx = c.getContext('2d');
      out.forEach((row, y) => row.forEach((cl, x) => {
        if (!cl) return;
        ctx.fillStyle = cl;
        ctx.fillRect(x, y, 1, 1);
      }));
      drawMark(ctx, sp.mark, col);
      if (sparkle) {
        ctx.fillStyle = '#fff6b0';
        [[1, 1], [14, 2], [13, 14], [0, 13]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(14, 1, 1, 1);
        ctx.fillRect(1, 0, 1, 1);
      }
      return c;
    });
  }

  // The little species detail: a leaf, crown, moon, star...
  function drawMark(ctx, mark, col) {
    const p = (x, y, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    };
    switch (mark) {
      case 'crown':
        ['#f8d030', '#f8d030', '#f8d030'].forEach((c, i) => p(2 + i * 2, 6, c));
        for (let x = 2; x <= 6; x++) p(x, 7, '#f8d030');
        p(4, 6, '#e84a4a');
        break;
      case 'leaf':
        p(1, 3, '#4c9a3c'); p(2, 3, '#6ac050'); p(1, 2, '#6ac050');
        break;
      case 'drop':
        p(11, 11, '#fff6d8'); p(11, 12, '#fff6d8');
        break;
      case 'flower':
        p(1, 3, '#ffffff'); p(0, 4, '#ffffff'); p(2, 4, '#ffffff'); p(1, 5, '#ffffff'); p(1, 4, '#f8c838');
        break;
      case 'moon':
        p(1, 1, '#fff4c0'); p(2, 1, '#fff4c0'); p(0, 2, '#fff4c0'); p(0, 3, '#fff4c0'); p(1, 4, '#fff4c0'); p(2, 4, '#fff4c0');
        break;
      case 'gem':
        p(11, 11, '#ffffff'); p(10, 10, '#ffffff'); p(12, 12, shade(col.body, 0.6));
        break;
      case 'star':
        p(1, 2, '#fff6a0'); p(0, 3, '#fff6a0'); p(1, 3, '#ffffff'); p(2, 3, '#fff6a0'); p(1, 4, '#fff6a0');
        p(14, 13, '#fff6a0');
        break;
      case 'band':
        for (let y = 8; y <= 12; y++) p(3, y, '#3a5a8a');
        break;
      case 'cross':
        p(11, 9, '#ffffff'); p(10, 10, '#ffffff'); p(11, 10, '#ffffff'); p(12, 10, '#ffffff'); p(11, 11, '#ffffff');
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // PRODUCT ICONS (8×8). Letters: k outline, F fill colour, L lid colour,
  // x/w highlights, o/y candle flame.
  // ---------------------------------------------------------------------------
  const ICONS = {
    jar: ['..kkkk..', '..kLLk..', '.kkkkkk.', 'kxFFFFxk', 'kxFwwFFk', 'kFFwwFFk', 'kFFFFFFk', '.kkkkkk.'],
    candle: ['...o....', '...y....', '..kkk...', '..kFk...', '..kFk...', '..kFk...', '.kkkkk..', '.kLLLk..'],
    pot: ['........', '.kkkkkk.', 'kLLLLLLk', 'kkkkkkkk', 'kFFwFFFk', 'kFFFFFFk', '.kFFFFk.', '..kkkk..'],
    vial: ['...kk...', '...LL...', '..kkkk..', '..kxFk..', '.kxFFFk.', '.kFFFFk.', '.kFFFFk.', '..kkkk..'],
    comb: ['..kkkk..', '.kxxFFk.', 'kxFFkFFk', 'kFFkkkFk', 'kFkFFkFk', 'kFFkkFFk', '.kFFFFk.', '..kkkk..'],
    block: ['........', '..kkkkk.', '.kwwwwLk', 'kwFFFFLk', 'kFFxFFLk', 'kFFFFFLk', 'kLLLLLk.', 'kkkkkk..'],
  };

  function goodIcon(goodId) {
    return cached('good|' + goodId, () => {
      const g = D.good[goodId];
      const pal = { k: INK, F: g.fill, L: g.lid, x: shade(g.fill, 0.55), w: shade(g.fill, 0.7), o: '#f06a20', y: '#ffd850' };
      return gridCanvas(ICONS[g.kind], pal);
    });
  }

  // Other small icons used in menus and the status bar.
  const MISC = {
    coin: ['..kkkk..', '.kywyyk.', 'kywyyyok', 'kyyoyyok', 'kyyoyyok', 'kyyyyyok', '.kyyook.', '..kkkk..'],
    gem: ['..kkkk..', '.kbwbbk.', 'kbwbbbBk', 'kbbbbBBk', '.kbbBBk.', '..kbBk..', '...kk...', '........'],
    star: ['...kk...', '...yk...', 'kkkyykkk', 'kyyyyyok', '.kyyyok.', '.kyokyk.', 'kyok.kok', 'kkk...kk'],
    starEmpty: ['...kk...', '...gk...', 'kkkggkkk', 'kgggggGk', '.kgggGk.', '.kgGkgk.', 'kgGk.kGk', 'kkk...kk'],
    heart: ['........', '.kk.kk..', 'kppkppk.', 'kpwppp k', 'kppppp k', '.kpppk..', '..kpk...', '...k....'],
    sun: ['...y....', '.y.y.y..', '..yyy...', 'yyyyyyy.', '..yyy...', '.y.y.y..', '...y....', '........'],
    moon: ['..kkk...', '.kmmk...', 'kmmk....', 'kmmk....', 'kmmk....', 'kmmmk...', '.kmmmkk.', '..kkk...'],
    egg: ['..kkk...', '.kwwwk..', 'kwwwwwk.', 'kwpwwwk.', 'kwwwpwk.', 'kwwwwwk.', '.kwwwk..', '..kkk...'],
    ribbon: ['.kkkkk..', 'krrrrrk.', 'krryrrk.', 'krrrrrk.', '.krrrk..', '.krkrk..', 'krk.krk.', 'kk...kk.'],
    hammer: ['.kkkk...', 'kggggk..', 'kggggk..', '.kkbk...', '...kbk..', '....kbk.', '.....kbk', '......k.'],
    note: ['kkkkkk..', 'kwwwwk..', 'kwkkwk..', 'kwwwwk..', 'kwkkwk..', 'kwwwwk..', 'kkkkkk..', '........'],
  };
  const MISC_PAL = { k: INK, y: '#f8c838', o: '#d8861e', w: '#fff4c0', g: '#d8c8a8', G: '#b8a888', p: '#e8506a', m: '#e8e0ff', r: '#d84a4a', b: '#6ad0f0', B: '#3a90c0' };

  function misc(name) {
    return cached('misc|' + name, () => gridCanvas(MISC[name].map((r) => r.replace(/ /g, '.')), MISC_PAL));
  }

  // ---------------------------------------------------------------------------
  // HIVES. They grow as you upgrade them:
  //   level 1: one box        level 2: two boxes
  //   level 3: two boxes + peaked roof
  //   level 4: three boxes + roof       level 5: + flower box
  //   level 6: + a little gold flag on top
  // The hive style from the Store changes the colours (and the Straw Skep
  // is a dome that gets taller instead of stacked boxes).
  // The picture is 18 wide × 32 tall; its bottom edge sits on the hive spot.
  // ---------------------------------------------------------------------------
  const HIVE_W = 18, HIVE_H = 32;
  const STYLES = {
    'hive-classic': { a: '#e8c888', b: '#c89858', roof: ['#c8642a', '#d8902a', '#b84a5a', '#8a5ab8', '#3a8a8a', '#e8b830'], legs: '#7a4a22' },
    'hive-painted': { a: '#f6f2e6', b: '#8ab8e0', roof: ['#3a6aa8', '#3a6aa8', '#2a5a98', '#2a5a98', '#c84a5a', '#c84a5a'], legs: '#5a6a7a' },
    'hive-royal': { a: '#fff0c8', b: '#e0b848', roof: ['#6a3a9a', '#6a3a9a', '#5a2a8a', '#5a2a8a', '#4a1a7a', '#4a1a7a'], legs: '#8a6a2a', trim: '#ffd23a' },
  };

  function hive(level, style = 'hive-classic') {
    return cached('hive|' + level + '|' + style, () => {
      const c = canvas(HIVE_W, HIVE_H);
      const g = c.getContext('2d');
      const r = (x, y, w, h, col) => {
        g.fillStyle = col;
        g.fillRect(x, y, w, h);
      };
      const bottom = HIVE_H;
      if (style === 'hive-skep') {
        // A woven straw dome: taller with each level.
        const rings = 3 + level;
        const top = bottom - 3 - rings * 3;
        for (let k = 0; k < rings; k++) {
          const y = bottom - 3 - (k + 1) * 3;
          const half = Math.round(8 - Math.max(0, k - rings + 3) * 2);
          r(9 - half - 1, y, half * 2 + 2, 3, INK);
          r(9 - half, y + 1, half * 2, 2, k % 2 ? '#e8c060' : '#d0a040');
        }
        r(6, top - 2, 6, 2, INK);
        r(7, top - 1, 4, 1, '#d0a040');
        r(2, bottom - 3, 14, 3, INK); // base
        r(3, bottom - 3, 12, 2, '#8a6a3a');
        r(7, bottom - 6, 4, 3, '#3a2a1a'); // doorway
        if (level >= 5) {
          r(8, top - 7, 1, 5, INK);
          r(9, top - 7, 4, 3, '#ffd23a');
        }
        return c;
      }
      const st = STYLES[style] || STYLES['hive-classic'];
      const boxes = [1, 2, 2, 3, 3, 3][level] || 1;
      // legs
      r(3, bottom - 3, 3, 3, INK); r(4, bottom - 3, 1, 2, st.legs);
      r(12, bottom - 3, 3, 3, INK); r(13, bottom - 3, 1, 2, st.legs);
      // boxes, stacked upward
      let y = bottom - 3;
      for (let k = 0; k < boxes; k++) {
        y -= 6;
        r(1, y, 16, 7, INK);
        r(2, y + 1, 14, 2, st.a);
        r(2, y + 3, 14, 1, st.b);
        r(2, y + 4, 14, 2, st.a);
        if (st.trim) r(2, y + 1, 14, 1, st.trim);
        if (k === 0) r(7, y + 4, 4, 2, INK); // entrance slit on the bottom box
      }
      // roof: a flat lid at first, a peaked roof from level 3
      const roof = st.roof[Math.min(level, st.roof.length - 1)];
      if (level < 2) {
        r(0, y - 2, 18, 3, INK);
        r(1, y - 1, 16, 1, roof);
        y -= 2;
      } else {
        r(0, y - 2, 18, 3, INK);
        r(1, y - 1, 16, 1, shade(roof, -0.2));
        r(2, y - 4, 14, 2, INK);
        r(3, y - 3, 12, 1, roof);
        r(5, y - 5, 8, 1, INK);
        y -= 5;
      }
      // level 5+: a little window box of flowers on the front
      if (level >= 4) {
        const fy = bottom - 3 - 6 * boxes + 3;
        r(1, fy + 5, 16, 2, INK);
        ['#f07898', '#ffffff', '#f8d030', '#b890e8', '#f07898'].forEach((col, i) => r(2 + i * 3, fy + 4, 2, 1, col));
      }
      // level 6: a gold pennant on top
      if (level >= 5) {
        r(8, y - 6, 1, 6, INK);
        r(9, y - 6, 4, 3, '#ffd23a');
        r(9, y - 6, 4, 1, INK);
      }
      return c;
    });
  }

  // ---------------------------------------------------------------------------
  // TINY 3×5 FONT for numbers drawn inside the game picture (+45, !, ...).
  // Each character is 15 on/off pixels, read left-to-right, top-to-bottom.
  // ---------------------------------------------------------------------------
  const GLYPHS = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
    4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001111', '+': '000010111010000', '-': '000000111000000',
    '.': '000000000000010', K: '101101110101101', M: '101111111101101', B: '110101110101110',
    T: '111010010010010', '!': '010010010000010', '?': '111001010000010', ' ': '000000000000000',
    Z: '111001010100111', z: '000111001010111', '/': '001001010100100',
    '*': '010111010101000', // a tiny star, floated up when reputation changes
  };

  // Write `str` centred at (x, y) with a dark outline so it reads on any background.
  function drawText(ctx, str, x, y, color = '#fff8e0', outline = INK) {
    const width = str.length * 4 - 1;
    const ox = Math.round(x - width / 2);
    const oy = Math.round(y);
    const pass = (c, dx, dy) => {
      ctx.fillStyle = c;
      for (let i = 0; i < str.length; i++) {
        const g = GLYPHS[str[i]];
        if (!g) continue;
        for (let p = 0; p < 15; p++) {
          if (g[p] === '1') ctx.fillRect(ox + i * 4 + (p % 3) + dx, oy + Math.floor(p / 3) + dy, 1, 1);
        }
      }
    };
    if (outline) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pass(outline, dx, dy);
    pass(color, 0, 0);
  }

  // Turn any of the pictures above into an image link the menus can use.
  const urlCache = new Map();
  function url(key, make) {
    if (!urlCache.has(key)) urlCache.set(key, make().toDataURL());
    return urlCache.get(key);
  }

  HC.spr = {
    INK, canvas, shade, mix, character, keeperLook, beePortrait, goodIcon, misc, hive, drawText, drawGrid, gridCanvas,
    HIVE_W, HIVE_H,
    beeURL: (sp, sparkle) => url('b' + sp + sparkle, () => beePortrait(sp, sparkle)),
    goodURL: (g) => url('g' + g, () => goodIcon(g)),
    miscURL: (n) => url('m' + n, () => misc(n)),
    hiveURL: (lv, style) => url('h' + lv + style, () => hive(lv, style)),
    // A big front-facing picture of a person, for the Store's wardrobe preview.
    personURL: (look) => url('p' + JSON.stringify(look), () => character(look, 'down', 0)),
    sparklePalette,
  };
})();
