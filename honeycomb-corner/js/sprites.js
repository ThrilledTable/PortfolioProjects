// Pixel art. Everything is drawn from code or tiny character grids: no image
// files, no third-party art. Sprites are cached as offscreen canvases.
(function () {
  const HC = window.HC;
  const D = HC.data;
  const cache = new Map();

  const INK = '#2b1d14';

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function cached(key, build) {
    if (!cache.has(key)) cache.set(key, build());
    return cache.get(key);
  }

  // Draw a character grid: each char maps to a palette colour, '.' is clear.
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

  // ---- Characters (16 wide, 20 tall with headroom for hats) --------------
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
    }
  }

  // dir: down/up/left/right; frame 0..3 walk cycle
  function character(look, dir, frame) {
    const key = ['ch', look.hair, look.skin, look.shirt, look.hat, dir, frame].join('|');
    return cached(key, () => {
      const c = canvas(16, 20);
      const ctx = c.getContext('2d');
      const pal = charPalette(look);
      const step = frame === 1 ? 1 : 0; // frames 1 and 3 use the stepping legs
      const flip = frame === 3;
      let head, body, hflip = false;
      if (dir === 'down') { head = HEAD_FRONT; body = BODY_FRONT[step]; }
      else if (dir === 'up') { head = HEAD_BACK; body = BODY_BACK[step]; }
      else { head = HEAD_SIDE; body = BODY_SIDE[frame === 1 || frame === 3 ? 1 : 0]; hflip = dir === 'right'; }
      const rows = head.concat(body);
      const tmp = gridCanvas(rows, pal, hflip !== (flip && (dir === 'down' || dir === 'up')));
      const bob = frame === 1 || frame === 3 ? 1 : 0;
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
        ctx.fillRect(dir === 'down' ? 5 : 5, 15 + bob, dir === 'down' ? 6 : 4, 2);
      }
      return c;
    });
  }

  // ---- Bees -----------------------------------------------------------------
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function sparklePalette(sp) {
    // Sparkle variants swap to a rose-gold scheme with a lighter stripe.
    return { body: shade(sp.body, 0.35), stripe: '#c04a7a', wing: '#fff4fa' };
  }

  function beePortrait(spId, sparkle) {
    return cached('bee|' + spId + '|' + !!sparkle, () => {
      const sp = D.species[spId];
      const col = sparkle ? sparklePalette(sp) : { body: sp.body, stripe: sp.stripe, wing: sp.wing };
      const N = 16;
      const px = Array.from({ length: N }, () => Array(N).fill(null));
      const set = (x, y, c) => {
        if (x >= 0 && y >= 0 && x < N && y < N) px[y][x] = c;
      };
      // Wings (behind the body)
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const w1 = ((x - 7.5) / 2.6) ** 2 + ((y - 4.5) / 3.3) ** 2 <= 1;
        const w2 = ((x - 11) / 2.2) ** 2 + ((y - 5) / 2.8) ** 2 <= 1;
        if (w1 || w2) set(x, y, col.wing);
      }
      // Wing veins
      set(8, 4, shade(col.wing, -0.18)); set(11, 5, shade(col.wing, -0.18));
      // Abdomen with stripes
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (((x - 9.8) / 4.7) ** 2 + ((y - 10.2) / 3.3) ** 2 <= 1) {
          const band = x === 8 || x === 9 || x === 12 || x === 13;
          set(x, y, band ? col.stripe : col.body);
        }
      }
      // Highlight on the abdomen
      set(7, 8, shade(col.body, 0.5)); set(10, 8, shade(col.body, 0.5));
      // Head
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (((x - 4) / 2.7) ** 2 + ((y - 10.3) / 2.6) ** 2 <= 1) set(x, y, shade(col.stripe, 0.12));
      }
      // Stinger
      set(15, 10, INK);
      // Legs
      set(7, 14, INK); set(10, 14, INK);
      // Outline pass
      const out = px.map((r) => r.slice());
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (px[y][x]) continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => px[y + dy] && px[y + dy][x + dx] && px[y + dy][x + dx] !== INK);
        if (nb) out[y][x] = INK;
      }
      // Eye and antennae go on top of the outline
      out[9][3] = '#fffdf4';
      out[10][3] = INK;
      out[9][2] = '#fffdf4';
      out[7][3] = INK; out[6][2] = INK; out[5][2] = INK; out[4][1] = INK;
      out[7][5] = INK; out[6][5] = INK; out[5][6] = INK;

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
        [[1, 1], [14, 2], [13, 14], [0, 13]].forEach(([x, y]) => {
          ctx.fillRect(x, y, 1, 1);
        });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(14, 1, 1, 1);
        ctx.fillRect(1, 0, 1, 1);
      }
      return c;
    });
  }

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

  // ---- Product icons (8x8) -----------------------------------------------
  const ICONS = {
    jar: ['..kkkk..', '..kLLk..', '.kkkkkk.', 'kxFFFFxk', 'kxFwwFFk', 'kFFwwFFk', 'kFFFFFFk', '.kkkkkk.'],
    candle: ['...o....', '...y....', '..kkk...', '..kFk...', '..kFk...', '..kFk...', '.kkkkk..', '.kLLLk..'],
    pot: ['........', '.kkkkkk.', 'kLLLLLLk', 'kkkkkkkk', 'kFFwFFFk', 'kFFFFFFk', '.kFFFFk.', '..kkkk..'],
    vial: ['...kk...', '...LL...', '..kkkk..', '..kxFk..', '.kxFFFk.', '.kFFFFk.', '.kFFFFk.', '..kkkk..'],
    comb: ['..kkkk..', '.kxxFFk.', 'kxFFkFFk', 'kFFkkkFk', 'kFkFFkFk', 'kFFkkFFk', '.kFFFFk.', '..kkkk..'],
  };

  function goodIcon(goodId) {
    return cached('good|' + goodId, () => {
      const g = D.good[goodId];
      const pal = { k: INK, F: g.fill, L: g.lid, x: shade(g.fill, 0.55), w: shade(g.fill, 0.7), o: '#f06a20', y: '#ffd850' };
      return gridCanvas(ICONS[g.kind], pal);
    });
  }

  const MISC = {
    coin: ['..kkkk..', '.kywyyk.', 'kywyyyok', 'kyyoyyok', 'kyyoyyok', 'kyyyyyok', '.kyyook.', '..kkkk..'],
    star: ['...kk...', '...yk...', 'kkkyykkk', 'kyyyyyok', '.kyyyok.', '.kyokyk.', 'kyok.kok', 'kkk...kk'],
    starEmpty: ['...kk...', '...gk...', 'kkkggkkk', 'kgggggGk', '.kgggGk.', '.kgGkgk.', 'kgGk.kGk', 'kkk...kk'],
    heart: ['........', '.kk.kk..', 'kppkppk.', 'kpwppp k', 'kppppp k', '.kpppk..', '..kpk...', '...k....'],
    sun: ['...y....', '.y.y.y..', '..yyy...', 'yyyyyyy.', '..yyy...', '.y.y.y..', '...y....', '........'],
    moon: ['..kkk...', '.kmmk...', 'kmmk....', 'kmmk....', 'kmmk....', 'kmmmk...', '.kmmmkk.', '..kkk...'],
    egg: ['..kkk...', '.kwwwk..', 'kwwwwwk.', 'kwpwwwk.', 'kwwwpwk.', 'kwwwwwk.', '.kwwwk..', '..kkk...'],
    ribbon: ['.kkkkk..', 'krrrrrk.', 'krryrrk.', 'krrrrrk.', '.krrrk..', '.krkrk..', 'krk.krk.', 'kk...kk.'],
  };
  const MISC_PAL = { k: INK, y: '#f8c838', o: '#d8861e', w: '#fff4c0', g: '#d8c8a8', G: '#b8a888', p: '#e8506a', m: '#e8e0ff', r: '#d84a4a' };

  function misc(name) {
    return cached('misc|' + name, () => gridCanvas(MISC[name].map((r) => r.replace(/ /g, '.')), MISC_PAL));
  }

  // ---- Hive (16x16) ------------------------------------------------------
  const HIVE = [
    '................',
    '..kkkkkkkkkkkk..',
    '.krrrrrrrrrrrrk.',
    'kRRRRRRRRRRRRRRk',
    '.kkkkkkkkkkkkkk.',
    '.kttttttttttttk.',
    '.knnnnnnnnnnnnk.',
    '.kttttttttttttk.',
    '.kkkkkkkkkkkkkk.',
    '.kttttttttttttk.',
    '.knnnnnnnnnnnnk.',
    '.ktttttkktttttk.',
    '.kkkkkkkkkkkkkk.',
    '..kbk......kbk..',
    '..kbk......kbk..',
    '..kkk......kkk..',
  ];
  const ROOFS = ['#c8642a', '#d8902a', '#b84a5a', '#8a5ab8', '#3a8a8a', '#e8b830'];

  function hive(level) {
    return cached('hive|' + level, () => {
      const r = ROOFS[level] || ROOFS[0];
      return gridCanvas(HIVE, { k: INK, r, R: shade(r, -0.25), t: '#e8c888', n: '#c89858', b: '#7a4a22' });
    });
  }

  // ---- 3x5 bitmap font for in-scene numbers ------------------------------
  const GLYPHS = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
    4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001111', '+': '000010111010000', '-': '000000111000000',
    '.': '000000000000010', K: '101101110101101', M: '101111111101101', B: '110101110101110',
    T: '111010010010010', '!': '010010010000010', '?': '111001010000010', ' ': '000000000000000',
    Z: '111001010100111', z: '000111001010111',
  };

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

  // DOM helpers: data URLs so the same pixel art appears in menus.
  const urlCache = new Map();
  function url(key, make) {
    if (!urlCache.has(key)) urlCache.set(key, make().toDataURL());
    return urlCache.get(key);
  }

  HC.spr = {
    INK, canvas, shade, character, beePortrait, goodIcon, misc, hive, drawText, drawGrid, gridCanvas,
    beeURL: (sp, sparkle) => url('b' + sp + sparkle, () => beePortrait(sp, sparkle)),
    goodURL: (g) => url('g' + g, () => goodIcon(g)),
    miscURL: (n) => url('m' + n, () => misc(n)),
    hiveURL: (lv) => url('h' + lv, () => hive(lv)),
    sparklePalette,
  };
})();
