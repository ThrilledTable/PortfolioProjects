// Scene renderer: draws the garden, shop, customers and effects to a 240x160
// canvas that CSS scales up with crisp pixels.
(function () {
  const HC = window.HC;
  const { util, data: D, spr, layout: L } = HC;
  const INK = spr.INK;

  let ctx, cvs, staticLayer, flowers;
  const KEEPER_LOOK = { hair: ['#6a3e1e', '#4a2a12'], skin: ['#f8c898', '#d89868'], shirt: ['#f4f0e0', '#d0c8b0'], hat: 'bandana', apron: '#e8a020' };
  const MERCHANT_LOOK = { hair: ['#d8d0c8', '#a8a098'], skin: ['#e0a878', '#b87c50'], shirt: ['#6a4a9a', '#4a3070'], hat: 'tophat' };
  const FLOWER_COLS = ['#f07898', '#ffffff', '#b890e8', '#f8d030', '#f06a4a', '#80c8f0'];

  function init(canvasEl) {
    cvs = canvasEl;
    ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    staticLayer = buildStatic();
    flowers = buildFlowers();
  }

  // ---- Static background ---------------------------------------------------
  function buildStatic() {
    const c = spr.canvas(L.W, L.H);
    const g = c.getContext('2d');
    const rnd = util.seeded(7);
    const rect = (x, y, w, h, col) => {
      g.fillStyle = col;
      g.fillRect(x, y, w, h);
    };

    // Garden grass
    rect(0, 0, 112, 144, '#6cbc54');
    for (let i = 0; i < 520; i++) {
      const x = Math.floor(rnd() * 112), y = Math.floor(rnd() * 144);
      rect(x, y, 1, 1, rnd() < 0.5 ? '#5aa848' : '#86d06c');
    }
    for (let i = 0; i < 40; i++) {
      // grass tufts
      const x = Math.floor(rnd() * 104) + 2, y = Math.floor(rnd() * 136) + 4;
      rect(x, y, 1, 2, '#4a9a3c');
      rect(x + 2, y, 1, 2, '#4a9a3c');
      rect(x + 1, y + 1, 1, 1, '#4a9a3c');
    }
    // Hive pads: trodden dirt under each slot
    for (const [cx, cy] of L.hiveSlots) {
      rect(cx * 16 - 1, cy * 16 + 11, 18, 6, '#8ab04a');
    }
    // Picket fence between garden and shop
    for (let y = 2; y < 140; y += 4) {
      rect(102, y, 3, 3, '#f4ecd8');
      rect(102, y + 3, 3, 1, '#c8b898');
    }
    rect(101, 4, 1, 136, '#b8a888');
    // Lamp post
    rect(106, 116, 2, 26, '#3a3040');
    rect(104, 112, 6, 5, '#3a3040');
    rect(105, 113, 4, 3, '#ffe08a');

    // Street
    rect(0, 144, 240, 16, '#d8b878');
    rect(0, 144, 240, 1, '#b89858');
    for (let i = 0; i < 90; i++) {
      rect(Math.floor(rnd() * 240), 146 + Math.floor(rnd() * 13), 2, 1, rnd() < 0.5 ? '#c4a466' : '#e6caa0');
    }

    // Shop floor: warm checkerboard
    for (let y = 16; y < 128; y += 8) {
      for (let x = 112; x < 240; x += 8) {
        rect(x, y, 8, 8, ((x + y) / 8) % 2 ? '#f2dfb4' : '#e6cc98');
      }
    }
    // Back wall
    rect(112, 0, 128, 16, '#b86a32');
    for (let x = 112; x < 240; x += 6) rect(x, 2, 1, 14, '#9a5626');
    rect(112, 0, 128, 2, '#6a3418');
    rect(112, 15, 128, 1, '#7a3e1a');
    // Side walls
    rect(112, 0, 3, 144, '#7a3e1a');
    rect(237, 0, 3, 144, '#7a3e1a');
    // Front wall with door gap
    rect(112, 128, 128, 16, '#a85a2a');
    for (let x = 112; x < 240; x += 8) rect(x, 128, 1, 16, '#8a4420');
    rect(112, 128, 128, 2, '#6a3418');
    rect(144, 128, 16, 16, '#6a3418');
    rect(145, 130, 14, 14, '#d84a3a'); // doormat seen through the door
    rect(147, 132, 10, 10, '#e8704a');
    // Front windows
    for (const wx of [120, 212]) {
      rect(wx, 131, 16, 9, '#4a2a18');
      rect(wx + 1, 132, 14, 7, '#a8d8e8');
      rect(wx + 2, 133, 4, 2, '#e0f4fa');
      rect(wx + 7, 132, 1, 7, '#4a2a18');
    }
    // Hanging sign by the door: a honey pot on a board
    rect(164, 130, 30, 11, '#4a2a18');
    rect(165, 131, 28, 9, '#f2b230');
    g.drawImage(spr.goodIcon('wildflower'), 175, 131);
    // Welcome rug inside the door
    rect(140, 118, 24, 9, '#b8483a');
    rect(142, 119, 20, 7, '#d86a4a');
    rect(144, 121, 16, 3, '#f2b230');
    // Counter
    rect(190, 98, 47, 14, '#8a5a2a');
    rect(190, 96, 47, 5, '#c88a4a');
    rect(190, 96, 47, 1, '#e8b070');
    rect(190, 111, 47, 1, INK);
    for (let x = 194; x < 237; x += 10) rect(x, 102, 6, 7, '#7a4a22');
    // Register
    rect(222, 90, 12, 8, '#8a8a9a');
    rect(223, 91, 10, 3, '#3a3a4a');
    rect(224, 92, 3, 1, '#9af09a');
    rect(222, 94, 12, 1, '#f2b230');
    // Potted plant
    rect(118, 112, 8, 7, '#b86a32');
    rect(117, 111, 10, 2, '#8a4a22');
    rect(116, 104, 4, 4, '#4a9a3c');
    rect(121, 102, 4, 6, '#5aae48');
    rect(119, 100, 3, 4, '#6cc054');
    // Display table with a jar pyramid (kept clear of the customer paths)
    rect(118, 84, 26, 3, 'rgba(43,29,20,0.25)');
    rect(117, 70, 28, 13, INK);
    rect(118, 71, 26, 9, '#c88a4a');
    rect(118, 71, 26, 1, '#e8b070');
    rect(118, 80, 26, 2, '#8a5a2a');
    rect(119, 82, 2, 4, '#6a3a1a');
    rect(141, 82, 2, 4, '#6a3a1a');
    const jar = (x, y) => {
      rect(x, y, 5, 6, INK);
      rect(x + 1, y + 2, 3, 3, '#f8c838');
      rect(x + 1, y + 1, 3, 1, '#c8642a');
      rect(x + 1, y + 2, 1, 1, '#fde8a0');
    };
    jar(121, 70); jar(126, 70); jar(131, 70); jar(136, 70);
    jar(123, 65); jar(128, 65); jar(133, 65);
    jar(126, 60); jar(131, 60);
    // "Try me" sample dish
    rect(138, 76, 5, 2, '#fff4d8');
    rect(139, 75, 3, 1, '#f8c838');
    // Wall clock
    rect(226, 4, 7, 7, INK);
    rect(227, 5, 5, 5, '#fff4d8');
    rect(229, 6, 1, 2, INK);
    rect(229, 7, 2, 1, INK);
    return c;
  }

  function buildFlowers() {
    const rnd = util.seeded(42);
    const out = [];
    const blocked = (x, y) => {
      if (x > 96) return true;
      for (const [cx, cy] of L.hiveSlots) {
        if (x > cx * 16 - 4 && x < cx * 16 + 20 && y > cy * 16 - 3 && y < cy * 16 + 20) return true;
      }
      return false;
    };
    let tries = 0;
    while (out.length < 110 && tries < 5000) {
      tries++;
      const x = 3 + Math.floor(rnd() * 92), y = 4 + Math.floor(rnd() * 134);
      if (blocked(x, y)) continue;
      if (out.some((f) => Math.abs(f.x - x) < 5 && Math.abs(f.y - y) < 5)) continue;
      out.push({ x, y, col: FLOWER_COLS[Math.floor(rnd() * FLOWER_COLS.length)], ph: rnd() * 6 });
    }
    return out;
  }

  function visibleFlowers(s) {
    return flowers.slice(0, Math.min(flowers.length, 14 + 5 * s.up.flowers));
  }

  // ---- Dynamic pieces -------------------------------------------------------
  function drawFlowers(s, t) {
    for (const f of visibleFlowers(s)) {
      const sway = Math.sin(t * 1.6 + f.ph) > 0.6 ? 1 : 0;
      ctx.fillStyle = '#3e8a34';
      ctx.fillRect(f.x, f.y + 1, 1, 3);
      const x = f.x + sway, y = f.y;
      ctx.fillStyle = f.col;
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = f.col === '#f8d030' ? '#e86a20' : '#f8d030';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function drawHives(s, t) {
    L.hiveSlots.forEach(([cx, cy], i) => {
      const x = cx * 16, y = cy * 16;
      const h = s.hives[i];
      if (h) {
        ctx.drawImage(spr.hive(h.level), x, y);
        // level pips
        for (let l = 0; l < h.level; l++) {
          ctx.fillStyle = '#fff4c0';
          ctx.fillRect(x + 3 + l * 2, y + 6, 1, 1);
        }
      } else if (i === s.hives.length) {
        // Next buildable slot: dashed outline, pulses when affordable
        const can = s.coins >= HC.sim.f.hiveCost(s);
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

  function beeColors(s, bee) {
    const sp = D.species[bee.sp];
    return bee.sparkle ? spr.sparklePalette(sp) : sp;
  }

  function drawBees(s, t) {
    const fl = visibleFlowers(s);
    if (!fl.length) return;
    s.hives.forEach((h, hi) => {
      const [cx, cy] = L.hiveSlots[hi];
      const hx = cx * 16 + 8, hy = cy * 16 + 11;
      h.bees.slice(0, 8).forEach((id) => {
        const bee = s.bees[id];
        if (!bee) return;
        const seed = util.hash(id);
        const period = 5 + (seed % 300) / 100;
        const off = (seed % 1000) / 100;
        const trip = Math.floor((t + off) / period);
        const u = ((t + off) % period) / period;
        const f = fl[util.hash(id + trip) % fl.length];
        let x, y;
        if (u < 0.4) {
          const k = u / 0.4;
          x = util.lerp(hx, f.x, k);
          y = util.lerp(hy, f.y - 2, k) - Math.sin(Math.PI * k) * 10;
        } else if (u < 0.6) {
          x = f.x + Math.sin(t * 9 + seed) * 1.5;
          y = f.y - 3 + Math.cos(t * 7 + seed) * 1;
        } else {
          const k = (u - 0.6) / 0.4;
          x = util.lerp(f.x, hx, k);
          y = util.lerp(f.y - 2, hy, k) - Math.sin(Math.PI * k) * 8;
        }
        x = Math.round(x);
        y = Math.round(y);
        const col = beeColors(s, bee);
        const flap = Math.floor(t * 14 + seed) % 2;
        // wings
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x - 1, y - 2 + flap, 1, 1);
        ctx.fillRect(x + 1, y - 2 + flap, 1, 1);
        // body: bright colour with a dark stripe and head
        ctx.fillStyle = col.body;
        ctx.fillRect(x - 1, y - 1, 4, 2);
        ctx.fillStyle = col.stripe;
        ctx.fillRect(x + 1, y - 1, 1, 2);
        ctx.fillStyle = INK;
        ctx.fillRect(x - 2, y - 1, 1, 2);
        if (bee.sparkle && Math.floor(t * 4 + seed) % 3 === 0) {
          ctx.fillStyle = '#fff6b0';
          ctx.fillRect(x + 2, y - 3, 1, 1);
        }
      });
    });
  }

  function drawShelves(s, t) {
    const cap = HC.sim.f.shelfCap(s);
    for (let i = 0; i < 8; i++) {
      const x = 112 + i * 16, y = 8;
      const sh = s.shelves[i];
      if (!sh) {
        // Unbought slot: a framed honeycomb picture on the wall
        if (i % 2 === 0) {
          ctx.fillStyle = '#6a3418';
          ctx.fillRect(x + 4, 4, 8, 8);
          ctx.fillStyle = '#f2c050';
          ctx.fillRect(x + 5, 5, 6, 6);
          ctx.fillStyle = '#d8962a';
          ctx.fillRect(x + 6, 6, 2, 2);
          ctx.fillRect(x + 9, 8, 1, 2);
        }
        continue;
      }
      // Frame
      ctx.fillStyle = INK;
      ctx.fillRect(x + 1, y, 14, 23);
      ctx.fillStyle = '#9a5a2a';
      ctx.fillRect(x + 2, y + 1, 12, 21);
      ctx.fillStyle = '#6a3a1a';
      ctx.fillRect(x + 3, y + 2, 10, 8);
      ctx.fillRect(x + 3, y + 12, 10, 8);
      ctx.fillStyle = '#c88a4a';
      ctx.fillRect(x + 2, y + 10, 12, 2);
      ctx.fillRect(x + 2, y + 20, 12, 2);
      if (sh.good) {
        const g = D.good[sh.good];
        const n = Math.ceil((sh.qty / cap) * 6);
        for (let k = 0; k < n; k++) {
          const row = k < 3 ? 1 : 0;
          const jx = x + 3 + (k % 3) * 3 + (row ? 0 : 1);
          const jy = y + (row ? 14 : 4);
          ctx.fillStyle = INK;
          ctx.fillRect(jx, jy, 3, 6);
          ctx.fillStyle = g.fill;
          ctx.fillRect(jx, jy + 2, 3, 4);
          ctx.fillStyle = g.lid;
          ctx.fillRect(jx, jy + 1, 3, 1);
        }
        // Price tag in the product colour
        ctx.fillStyle = g.fill;
        ctx.fillRect(x + 6, y + 21, 4, 2);
        if (sh.qty === 0 && !(s.store[sh.good] > 0) && Math.floor(t * 2) % 2 === 0) {
          spr.drawText(ctx, '!', x + 8, y - 6, '#ff6a4a');
        }
      }
    }
  }

  function drawBubble(x, y, bubble, t) {
    const bx = Math.round(x - 6), by = Math.round(y);
    ctx.fillStyle = INK;
    ctx.fillRect(bx, by, 12, 11);
    ctx.fillRect(bx + 5, by + 11, 2, 2);
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(bx + 1, by + 1, 10, 9);
    ctx.fillRect(bx + 5, by + 10, 2, 1);
    if (bubble.kind === 'good') ctx.drawImage(spr.goodIcon(bubble.good), bx + 2, by + 1);
    else if (bubble.kind === 'heart') ctx.drawImage(spr.misc('heart'), bx + 2, by + 2);
    else if (bubble.kind === 'dots') {
      ctx.fillStyle = INK;
      const n = 1 + (Math.floor(t * 4) % 3);
      for (let i = 0; i < n; i++) ctx.fillRect(bx + 3 + i * 2, by + 6, 1, 1);
    }
  }

  function frameFor(c) {
    return c.path && c.path.length ? Math.floor(c.walk * 8) % 4 : 0;
  }

  function drawActors(s, t) {
    const rt = HC.sim.rt;
    const actors = rt.customers.map((c) => ({ y: c.y, draw: () => drawCustomer(c, t) }));
    // The keeper stands behind the counter; drawKeeper repaints the counter
    // top over her legs.
    actors.push({ y: L.keeper.y, draw: () => drawKeeper(s, t) });
    if (s.merchant) actors.push({ y: L.wagon.y - 1, draw: () => drawWagon(s, t) });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();
  }

  function drawCustomer(c, t) {
    const img = spr.character(c.look, c.dir, frameFor(c));
    const x = Math.round(c.x - 8), y = Math.round(c.y - 19);
    // shadow
    ctx.fillStyle = 'rgba(43,29,20,0.25)';
    ctx.fillRect(x + 4, y + 18, 8, 2);
    ctx.drawImage(img, x, y);
    if (c.bubble) drawBubble(c.x, c.y - 33, c.bubble, t);
  }

  function drawKeeper(s, t) {
    const paying = HC.sim.rt.queue[0] && HC.sim.rt.queue[0].state === 'pay';
    const frame = paying && Math.floor(t * 6) % 2 ? 1 : 0;
    const img = spr.character(KEEPER_LOOK, 'down', frame);
    const x = L.keeper.x - 8, y = L.keeper.y - 19;
    ctx.drawImage(img, x, y);
    // Redraw the counter top edge over her legs so she reads as behind it.
    ctx.fillStyle = '#c88a4a';
    ctx.fillRect(190, 96, 47, 5);
    ctx.fillStyle = '#e8b070';
    ctx.fillRect(190, 96, 47, 1);
    ctx.fillStyle = '#8a8a9a';
    ctx.fillRect(222, 90, 12, 8);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(223, 91, 10, 3);
    ctx.fillStyle = paying && Math.floor(t * 8) % 2 ? '#fff08a' : '#9af09a';
    ctx.fillRect(224, 92, 3, 1);
    ctx.fillStyle = '#f2b230';
    ctx.fillRect(222, 94, 12, 1);
  }

  function drawWagon(s, t) {
    const x = L.wagon.x - 20, y = L.wagon.y - 22;
    // wheels
    ctx.fillStyle = INK;
    ctx.fillRect(x + 4, y + 16, 7, 7);
    ctx.fillRect(x + 27, y + 16, 7, 7);
    ctx.fillStyle = '#c8a060';
    ctx.fillRect(x + 5, y + 17, 5, 5);
    ctx.fillRect(x + 28, y + 17, 5, 5);
    // body
    ctx.fillStyle = INK;
    ctx.fillRect(x, y + 6, 38, 12);
    ctx.fillStyle = '#4a7a9a';
    ctx.fillRect(x + 1, y + 7, 36, 10);
    ctx.fillStyle = '#6a9aba';
    ctx.fillRect(x + 1, y + 7, 36, 2);
    // striped awning
    for (let i = 0; i < 38; i += 4) {
      ctx.fillStyle = (i / 4) % 2 ? '#fff4d8' : '#d84a4a';
      ctx.fillRect(x + i, y, 4, 5);
    }
    ctx.fillStyle = INK;
    ctx.fillRect(x, y + 5, 38, 1);
    // jars in the window
    ctx.drawImage(spr.beePortrait(s.merchant.offer.sp, s.merchant.offer.sparkle), x + 11, y + 4);
    // merchant
    const img = spr.character(MERCHANT_LOOK, 'down', 0);
    ctx.drawImage(img, x + 38, y + 3);
    if (Math.floor(t * 2) % 2 === 0) spr.drawText(ctx, '!', x + 46, y - 4, '#fff08a');
  }

  function drawFx(t) {
    for (const e of HC.sim.rt.fx) {
      if (e.kind !== 'text') continue;
      const k = e.t / e.life;
      const y = e.y - k * 14;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      spr.drawText(ctx, e.text, e.x, y, '#fff08a');
      ctx.globalAlpha = 1;
    }
  }

  // ---- Lighting -------------------------------------------------------------
  function lightLevels(s) {
    const p = HC.sim.f.dayPhase(s);
    // 0 = full day, 1 = full night; dusk is a warm transition
    let night = 0, dusk = 0;
    if (p >= 0.6 && p < 0.7) {
      const k = (p - 0.6) / 0.1;
      dusk = Math.sin(Math.PI * k);
      night = k;
    } else if (p >= 0.7 && p < 0.95) night = 1;
    else if (p >= 0.95) night = 1 - (p - 0.95) / 0.05;
    return { night, dusk };
  }

  function mix(a, b, k) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * k));
  }

  function drawLighting(s, t) {
    const { night, dusk } = lightLevels(s);
    if (night <= 0.01 && dusk <= 0.01) return;
    let outside = [255, 255, 255];
    outside = mix(outside, [255, 190, 140], dusk * 0.8);
    outside = mix(outside, [78, 88, 160], night * 0.9);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${outside})`;
    ctx.fillRect(0, 0, L.W, L.H);
    // Lamps and the lit shop interior glow through the dark.
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
    ctx.globalCompositeOperation = 'source-over';
    // Stars over the garden
    if (night > 0.5) {
      ctx.fillStyle = `rgba(255,250,220,${(night - 0.5) * 1.4})`;
      const rnd = util.seeded(99);
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(rnd() * 96), y = Math.floor(rnd() * 30);
        if (Math.sin(t * 2 + i) > -0.3) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function draw(s, t) {
    ctx.drawImage(staticLayer, 0, 0);
    drawFlowers(s, t);
    drawHives(s, t);
    drawShelves(s, t);
    drawActors(s, t);
    drawBees(s, t);
    drawFx(t);
    drawLighting(s, t);
  }

  // ---- Hit testing for taps on the scene -----------------------------------
  function hitTest(s, x, y) {
    for (let i = 0; i < L.hiveSlots.length; i++) {
      const [cx, cy] = L.hiveSlots[i];
      if (x >= cx * 16 - 2 && x < cx * 16 + 18 && y >= cy * 16 && y < cy * 16 + 17) {
        if (s.hives[i]) return { kind: 'hive', index: i };
        if (i === s.hives.length) return { kind: 'buildHive' };
      }
    }
    if (y >= 6 && y < 34 && x >= 112 && x < 240) {
      const i = Math.floor((x - 112) / 16);
      if (s.shelves[i]) return { kind: 'shelf', index: i };
      return { kind: 'buyShelf' };
    }
    if (s.merchant && x >= L.wagon.x - 22 && x < L.wagon.x + 34 && y >= L.wagon.y - 26 && y < L.wagon.y + 4) return { kind: 'merchant' };
    if (x >= 200 && x < 236 && y >= 66 && y < 112) return { kind: 'keeper' };
    return null;
  }

  HC.render = { init, draw, hitTest, lightLevels, KEEPER_LOOK };
})();
