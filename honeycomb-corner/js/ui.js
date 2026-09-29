// DOM interface: HUD, tab panels, modals, toasts and the tutorial text box.
// Panels re-render only on structural changes ('dirty'); fast-changing numbers
// update through [data-live] bindings so buttons are never replaced mid-click.
(function () {
  const HC = window.HC;
  const { util, data: D, spr, bus } = HC;
  const { fmt, esc } = util;
  const f = () => HC.sim.f;
  const S = () => HC.game;

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = {};
  let tab = 'apiary';
  let dirty = true;
  let modal = null; // { render: () => html, onAct?: (act, ds) => bool }
  const live = new Map();
  let liveSeq = 0;

  // Register a live binding; returns an id to drop in a data attribute.
  function L(fn) {
    const id = 'l' + liveSeq++;
    live.set(id, fn);
    return id;
  }

  const coin = () => `<img class="px ico" src="${spr.miscURL('coin')}" alt="" width="16" height="16">`;
  const goodImg = (g, size = 16) => `<img class="px ico" src="${spr.goodURL(g)}" alt="" width="${size}" height="${size}">`;
  const beeImg = (sp, sparkle, size = 32, cls = '') => `<img class="px bee-img ${cls}" src="${spr.beeURL(sp, sparkle)}" alt="" width="${size}" height="${size}">`;
  const price = (n) => `${coin()}<span>${fmt(n)}</span>`;
  const rarityChip = (r) => `<span class="chip chip-${r.toLowerCase()}">${r}</span>`;

  function btn(label, act, args = {}, opts = {}) {
    const data = Object.entries(args).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
    const afford = opts.cost != null ? `data-afford="${L(() => S().coins >= opts.cost)}"` : '';
    const dis = opts.disabled ? 'disabled' : '';
    return `<button class="btn ${opts.cls || ''}" data-act="${act}" ${data} ${afford} ${dis}>${label}</button>`;
  }

  // ---- Toasts & text box --------------------------------------------------
  function toast(msg, kind = '') {
    if (!msg) return;
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    el.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
    while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
  }

  const textQueue = [];
  let typing = null;
  let shown = null; // the queue item currently on screen
  // `valid` (optional) is re-checked before each line so stale hints are skipped.
  function say(lines, valid) {
    textQueue.push(...lines.map((text) => ({ text, valid })));
    if (!typing && el.textbox.hidden) nextLine();
  }
  function nextLine() {
    if (typing) {
      // Finish the current line instantly on tap.
      clearInterval(typing.timer);
      el.textboxText.textContent = typing.line;
      typing = null;
      el.textbox.classList.add('done');
      return;
    }
    let item = textQueue.shift();
    while (item && item.valid && !item.valid()) item = textQueue.shift();
    shown = item || null;
    const line = item && item.text;
    if (line == null) {
      el.textbox.hidden = true;
      return;
    }
    el.textbox.hidden = false;
    el.textbox.classList.remove('done');
    el.textboxText.textContent = '';
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.textboxText.textContent = line;
      el.textbox.classList.add('done');
      return;
    }
    let i = 0;
    typing = {
      line,
      timer: setInterval(() => {
        i++;
        el.textboxText.textContent = line.slice(0, i);
        if (i % 3 === 0) HC.audio.play('text');
        if (i >= line.length) {
          clearInterval(typing.timer);
          typing = null;
          el.textbox.classList.add('done');
        }
      }, 24),
    };
  }

  // ---- HUD ------------------------------------------------------------------
  function renderHud() {
    el.goalbar.innerHTML = `<div class="goal-inner" data-html="${L(goalHtml)}"></div>`;
    el.hud.innerHTML = `
      <div class="hud-coins" title="Coins">${coin()}<b data-live="${L(() => fmt(S().coins))}"></b></div>
      <div class="hud-item" title="Income over the last minute"><span class="lbl">per min</span><b data-live="${L(() => fmt(HC.sim.incomePerMin()))}"></b></div>
      <div class="hud-item" title="Reputation"><span class="lbl">rep</span><span class="stars" data-html="${L(starsHtml)}"></span></div>
      <div class="hud-item hud-time" title="Time of day"><span data-html="${L(timeHtml)}"></span></div>
      <button class="hud-item season-chip" data-act="season" data-html="${L(seasonHtml)}"></button>
      ${S().ribbons ? `<div class="hud-item" title="Festival ribbons: +${S().ribbons * 10}% sale prices"><img class="px ico" src="${spr.miscURL('ribbon')}" alt="" width="16" height="16"><b>${S().ribbons}</b></div>` : ''}
    `;
  }
  function goalHtml() {
    const s = S();
    const g = HC.goals.current(s);
    if (!g) return '<span class="goal-text">Every goal complete. The town is proud of you.</span>';
    const ok = g.check(s);
    return `<span class="goal-label">Goal ${(s.goal || 0) + 1}</span><span class="goal-text">${g.text}</span>` +
      (ok ? `<button class="btn btn-sm btn-go" data-act="claimGoal">Claim ${price(g.reward)}</button>` : `<span class="goal-reward">${price(g.reward)}</span>`);
  }
  function seasonHtml() {
    const s = S();
    const se = f().season(s);
    return `<span class="season-dot season-${se.id}"></span><b>${se.name}</b><span class="lbl">day ${f().day(s)}</span>`;
  }
  function starsHtml() {
    const r = S().rep;
    let h = '';
    for (let i = 0; i < 5; i++) {
      const on = r >= i + 0.5;
      h += `<img class="px ico" src="${spr.miscURL(on ? 'star' : 'starEmpty')}" alt="" width="12" height="12">`;
    }
    return h + `<span class="sr-only">${r.toFixed(1)} of 5</span>`;
  }
  function timeHtml() {
    const p = f().dayPhase(S());
    const mins = Math.floor(((p * 24 + 6) % 24) * 60);
    const hh = Math.floor(mins / 60), mm = mins % 60;
    const night = f().isNight(S());
    const label = `${((hh + 11) % 12) + 1}:${String(mm - (mm % 10)).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
    return `<img class="px ico" src="${spr.miscURL(night ? 'moon' : 'sun')}" alt="" width="14" height="14"><b>${label}</b>`;
  }

  // ---- Panels ---------------------------------------------------------------
  const panels = {};

  function beeTile(bee, extra = '') {
    const sp = D.species[bee.sp];
    return `<button class="bee-tile ${bee.sparkle ? 'is-sparkle' : ''}" data-act="bee" data-id="${bee.id}" title="${esc(bee.name)}">
      ${beeImg(bee.sp, bee.sparkle, 32)}
      <span class="bee-name">${esc(bee.name)}</span>
      <span class="bee-sub">${sp.name.replace(' Bee', '')} · ${util.pct(bee.vigor)}</span>
      ${extra}
    </button>`;
  }

  panels.apiary = function () {
    const s = S();
    const rates = f().goodRates(s);
    const hiveCards = s.hives.map((h, i) => {
      const cap = f().hiveCap(h);
      const slots = [];
      for (let k = 0; k < cap; k++) {
        const id = h.bees[k];
        slots.push(id ? beeTile(s.bees[id]) : `<button class="bee-tile empty" data-act="addToHive" data-i="${i}" title="Add a bee"><span class="plus">+</span><span class="bee-sub">Add bee</span></button>`);
      }
      const upCost = h.level < D.HIVE_MAX_LEVEL ? f().hiveUpgradeCost(s, i) : null;
      const mult = f().hiveMult(s, h);
      return `<article class="card hive-card" id="hive-${i}">
        <header class="card-head">
          <img class="px" src="${spr.hiveURL(h.level)}" alt="" width="32" height="32">
          <div class="grow"><h3>Hive ${i + 1}</h3><p class="muted">Level ${h.level + 1} · ${h.bees.length}/${cap} bees · ${util.pct(mult)} output</p></div>
          ${upCost != null ? btn(`Upgrade ${price(upCost)}`, 'upgradeHive', { i }, { cost: upCost, cls: 'btn-sm' }) : '<span class="chip">Max level</span>'}
        </header>
        <div class="bee-grid">${slots.join('')}</div>
      </article>`;
    }).join('');

    const nextHive = s.hives.length < 6 ? `<article class="card build-card">
        <div class="grow"><h3>Build hive ${s.hives.length + 1}</h3><p class="muted">Room for 3 more bees. Upgrades add slots and output.</p></div>
        ${btn(`Build ${price(f().hiveCost(s))}`, 'buildHive', {}, { cost: f().hiveCost(s) })}
      </article>` : '';

    const boxBees = s.box.map((id) => beeTile(s.bees[id])).join('') || '<p class="muted empty-note">No spare bees. Bees you buy or hatch land here when the hives are full.</p>';

    const market = ['meadow', 'clover'].map((sp) => {
      const spec = D.species[sp];
      const unlocked = f().marketUnlocked(s, sp);
      const cost = f().marketPrice(s, sp);
      return `<div class="row-item ${unlocked ? '' : 'locked'}">
        ${beeImg(sp, false, 32)}
        <div class="grow"><b>${spec.name}</b><p class="muted">${unlocked ? `Makes ${D.good[spec.good].name} · 1 per ${spec.secs}s` : `Unlocks after earning ₵${fmt(120)} in total.`}</p></div>
        ${unlocked ? btn(`Buy ${price(cost)}`, 'buyBee', { sp }, { cost }) : '<span class="chip">Locked</span>'}
      </div>`;
    }).join('');

    const prod = Object.entries(rates).sort((a, b) => D.good[a[0]].tier - D.good[b[0]].tier)
      .map(([g, r]) => `<span class="pill">${goodImg(g)} ${(r * 60).toFixed(1)}/min</span>`).join('');

    return `
      <section class="win">
        <div class="win-head"><h2>Apiary</h2><span class="muted">${f().beeCount(s)} bees · ${s.hives.length}/6 hives</span></div>
        <div class="pills">${prod || '<span class="muted">Nothing in production.</span>'}</div>
        <div class="stack">${hiveCards}${nextHive}</div>
      </section>
      <section class="win">
        <div class="win-head"><h2>Bee box</h2><span class="muted">${s.box.length}/${f().boxCap(s)} spaces</span></div>
        <div class="bee-grid">${boxBees}</div>
      </section>
      <section class="win">
        <div class="win-head"><h2>Bee Market</h2><span class="muted">Prices rise with each purchase</span></div>
        <div class="list">${market}</div>
        ${s.merchant ? merchantCard() : ''}
      </section>`;
  };

  function merchantCard() {
    const s = S();
    const o = s.merchant.offer;
    const sp = D.species[o.sp];
    const known = s.discovered[o.sp];
    return `<div class="merchant-card">
      ${beeImg(o.sp, o.sparkle, 48, known ? '' : 'mystery')}
      <div class="grow">
        <b>Travelling merchant</b> <span class="muted">leaves in <span data-live="${L(() => (S().merchant ? util.fmtTime(S().merchant.left) : 'gone'))}"></span></span>
        <p>${known ? sp.name : 'An unfamiliar bee'}${o.sparkle ? ' <span class="chip chip-sparkle">Sparkle</span>' : ''} · vigor ${util.pct(o.vigor)}${o.trait ? ' · ' + D.TRAITS[o.trait].name : ''}</p>
      </div>
      ${btn(`Buy ${price(o.price)}`, 'merchant', {}, { cost: o.price })}
    </div>`;
  }

  panels.shop = function () {
    const s = S();
    const cap = f().shelfCap(s);
    const shelves = s.shelves.map((sh, i) => {
      const g = sh.good && D.good[sh.good];
      return `<button class="shelf-tile" data-act="shelf" data-i="${i}">
        <span class="shelf-num">${i + 1}</span>
        ${g ? goodImg(g.id, 24) : '<span class="shelf-empty">empty</span>'}
        <span class="grow shelf-info">
          <b>${g ? g.name : 'Choose a product'}</b>
          ${g ? `<span class="muted">₵${fmt(f().price(s, g.id))} each · <span data-live="${L(() => sh.qty + '/' + cap)}"></span> on shelf · <span data-live="${L(() => fmt(S().store[sh.good] || 0))}"></span> in store</span>` : '<span class="muted">Tap to stock this shelf</span>'}
        </span>
      </button>`;
    }).join('');

    const storeCap = f().storageCap(s);
    const store = D.GOODS.filter((g) => s.unlockedGoods[g.id]).map((g) => `
      <div class="store-item" title="${g.name}">
        ${goodImg(g.id, 24)}
        <span class="store-qty" data-live="${L(() => fmt(S().store[g.id] || 0))}"></span>
        <span class="bar"><i data-width="${L(() => Math.min(1, (S().store[g.id] || 0) / storeCap))}"></i></span>
      </div>`).join('');

    const ups = D.UPGRADES.map((u) => {
      const lv = s.up[u.id];
      const maxed = lv >= u.max;
      const cost = maxed ? 0 : f().upgradeCost(s, u.id);
      return `<div class="row-item">
        <div class="grow"><b>${u.name}</b> <span class="chip">${maxed ? 'Max' : 'Lv ' + lv}</span><p class="muted">${u.desc(lv)}</p></div>
        ${maxed ? '' : btn(price(cost), 'upgrade', { id: u.id }, { cost, cls: 'btn-sm' })}
      </div>`;
    }).join('');

    return `
      <section class="win">
        <div class="win-head"><h2>Shelves</h2><span class="muted">Customers buy what's on display</span></div>
        <div class="stack">${shelves}</div>
        <p class="muted small">Reputation <b data-live="${L(() => S().rep.toFixed(2))}"></b>/5 · a customer every <b data-live="${L(() => f().spawnInterval(S()).toFixed(1) + 's')}"></b> on average · prices ×${f().priceMult(s).toFixed(2)}</p>
      </section>
      <section class="win">
        <div class="win-head"><h2>Storehouse</h2><span class="muted">Holds ${fmt(storeCap)} of each product</span></div>
        <div class="store-grid">${store}</div>
      </section>
      <section class="win">
        <div class="win-head"><h2>Upgrades</h2></div>
        <div class="list">${ups}</div>
      </section>`;
  };

  panels.nursery = function () {
    const s = S();
    const slots = s.nursery.map((n, i) => {
      if (!n) {
        return `<article class="card cradle">
          <img class="px egg" src="${spr.miscURL('egg')}" alt="" width="32" height="32">
          <div class="grow"><h3>Cradle ${i + 1}</h3><p class="muted">Empty. Choose two bees to raise an egg.</p></div>
          ${btn('Pick parents', 'breed', { slot: i })}
        </article>`;
      }
      const a = s.bees[n.a], b = s.bees[n.b];
      const parents = [a, b].map((x) => (x ? beeImg(x.sp, x.sparkle, 32) : '<span class="muted">gone</span>')).join('<span class="heart">+</span>');
      return `<article class="card cradle ${n.ready ? 'ready' : ''}">
        <div class="parents">${parents}</div>
        <div class="grow">
          <h3>Cradle ${i + 1}</h3>
          ${n.ready ? '<p><b>The egg is ready to hatch!</b></p>' : `<p class="muted">Hatching in <span data-live="${L(() => (S().nursery[i] ? util.fmtTime(S().nursery[i].dur - S().nursery[i].t) : ''))}"></span></p>
          <span class="bar big"><i data-width="${L(() => (S().nursery[i] ? S().nursery[i].t / S().nursery[i].dur : 1))}"></i></span>`}
        </div>
        ${n.ready ? btn('Hatch!', 'hatch', { slot: i }, { cls: 'btn-go' }) : btn('Cancel', 'cancelBreed', { slot: i }, { cls: 'btn-sm btn-ghost' })}
      </article>`;
    }).join('');

    const known = D.RECIPES.filter((r) => s.discovered[r.out]).map((r) => `
      <div class="recipe">${beeImg(r.a, false, 24)}<span>+</span>${beeImg(r.b, false, 24)}<span>→</span>${beeImg(r.out, false, 24)}
        <span class="muted">${D.species[r.out].name} · ${Math.round(r.p * 100)}%</span></div>`).join('');
    const unknown = D.RECIPES.filter((r) => !s.discovered[r.out]).length;

    return `
      <section class="win">
        <div class="win-head"><h2>Nursery</h2><span class="muted">Parents keep working while they raise an egg</span></div>
        <div class="stack">${slots}</div>
        <p class="muted small">Eggs from two different species can hatch into a new kind of bee. Same-species pairs pass on their vigor, often a little stronger. Rarely, an egg hatches with a sparkle: double output and a rose-gold coat.</p>
      </section>
      <section class="win">
        <div class="win-head"><h2>Recipe book</h2><span class="muted">${D.RECIPES.length - unknown}/${D.RECIPES.length} found</span></div>
        <div class="recipes">${known || '<p class="muted">No recipes yet. Try pairing a Meadow Bee with a Clover Bee.</p>'}</div>
        ${unknown ? `<p class="muted small">${unknown} more to find. The Field Guide has hints.</p>` : ''}
      </section>`;
  };

  panels.town = function () {
    const s = S();
    const orders = s.orders.map((o) => {
      const g = D.good[o.good];
      return `<article class="card order">
        ${goodImg(o.good, 32)}
        <div class="grow">
          <h3>${esc(o.who)}</h3>
          <p>Wants <b>${o.qty} × ${g.name}</b></p>
          <p class="muted">Have <span data-live="${L(() => fmt(S().store[o.good] || 0))}"></span> · expires in <span data-live="${L(() => { const x = S().orders.find((y) => y.id === o.id); return x ? util.fmtTime(x.left) : '—'; })}"></span></p>
        </div>
        <div class="order-actions">
          <button class="btn" data-act="deliver" data-id="${o.id}" data-need="Not enough ${g.name} in the storehouse yet." data-afford="${L(() => (S().store[o.good] || 0) >= o.qty)}">Deliver ${price(o.reward)}</button>
          <button class="link" data-act="dismiss" data-id="${o.id}">Decline</button>
        </div>
      </article>`;
    }).join('');

    const ribbons = f().festivalRibbons(s);
    const progress = Math.min(1, s.runEarned / D.FESTIVAL_AT);
    const festival = `<section class="win festival">
      <div class="win-head"><h2>Honey Festival</h2>${s.ribbons ? `<span class="muted">${s.ribbons} ribbons · +${s.ribbons * 10}% prices</span>` : ''}</div>
      <p>Once the shop has earned ₵${fmt(D.FESTIVAL_AT)} since the last festival, the town will throw you a Honey Festival. You start over with a fresh garden, and you keep your Field Guide, your ribbons and one keepsake bee. Every ribbon raises sale prices by 10% for good.</p>
      <span class="bar big"><i data-width="${L(() => Math.min(1, S().runEarned / D.FESTIVAL_AT))}"></i></span>
      <p class="muted small">₵<span data-live="${L(() => fmt(S().runEarned))}"></span> of ₵${fmt(D.FESTIVAL_AT)}${ribbons ? ` · the festival would award <b>${ribbons}</b> ribbons` : ''}</p>
      ${progress >= 1 ? btn('Plan the festival', 'festival', {}, { cls: 'btn-go' }) : ''}
    </section>`;

    return `
      <section class="win">
        <div class="win-head"><h2>Request board</h2><span class="muted">New requests every couple of minutes</span></div>
        <div class="stack">${orders || '<p class="muted empty-note">No requests pinned right now. Check back soon.</p>'}</div>
      </section>
      ${s.merchant ? `<section class="win"><div class="win-head"><h2>On the street</h2></div>${merchantCard()}</section>` : ''}
      ${festival}`;
  };

  panels.guide = function () {
    const s = S();
    const found = D.SPECIES.filter((x) => s.discovered[x.id]).length;
    const sparkles = D.SPECIES.filter((x) => s.sparkleSeen[x.id]).length;
    const cells = D.SPECIES.map((sp, i) => {
      const known = s.discovered[sp.id];
      return `<button class="guide-cell ${known ? '' : 'unknown'}" data-act="guide" data-sp="${sp.id}">
        <span class="guide-no">No.${String(i + 1).padStart(2, '0')}</span>
        ${beeImg(sp.id, false, 48, known ? '' : 'mystery')}
        <span class="bee-name">${known ? sp.name : '???'}</span>
        ${known ? rarityChip(sp.rarity) : '<span class="chip">Unknown</span>'}
        ${s.sparkleSeen[sp.id] ? '<span class="sparkle-dot" title="Sparkle seen">✦</span>' : ''}
      </button>`;
    }).join('');
    const st = s.stats;
    const stat = (k, v) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`;
    return `
      <section class="win">
        <div class="win-head"><h2>Field Guide</h2><span class="muted">${found}/${D.SPECIES.length} species · ${sparkles} sparkles</span></div>
        <div class="guide-grid">${cells}</div>
      </section>
      <section class="win">
        <div class="win-head"><h2>Ledger</h2></div>
        <div class="stats">
          ${stat('Earned (all time)', '₵' + fmt(s.lifetime))}
          ${stat('Customers served', fmt(st.customers))}
          ${stat('Items sold', fmt(st.sold))}
          ${stat('Left empty-handed', fmt(st.disappointed))}
          ${stat('Biggest sale', '₵' + fmt(st.best))}
          ${stat('Eggs hatched', fmt(st.bred))}
          ${stat('Requests filled', fmt(st.orders))}
          ${stat('Festivals held', fmt(s.festivals))}
          ${stat('Time in the shop', util.fmtTime(s.playTime))}
        </div>
      </section>`;
  };

  panels.menu = function () {
    const s = S();
    const tog = (key, label) => `<label class="toggle"><input type="checkbox" id="set-${key}" data-act="setting" data-key="${key}" ${s.settings[key] ? 'checked' : ''}> <span>${label}</span></label>`;
    return `
      <section class="win">
        <div class="win-head"><h2>Settings</h2></div>
        <div class="stack">${tog('sfx', 'Sound effects')}${tog('music', 'Music')}</div>
      </section>
      <section class="win">
        <div class="win-head"><h2>Save</h2><span class="muted">Saves automatically every few seconds on this device</span></div>
        <div class="btn-row">${btn('Save now', 'save')}${btn('Export save', 'export')}${btn('Import save', 'import')}</div>
        <div id="saveArea"></div>
      </section>
      <section class="win">
        <div class="win-head"><h2>About</h2></div>
        <p>Honeycomb Corner is a prototype idle game about a honey shop in a small town. The shop runs while you're away, for up to 8 hours.</p>
        <p class="muted small">All art, music and characters are original and drawn in code. Tip: ${esc(util.pick(D.TIPS))}</p>
        <div class="btn-row">${btn('Replay tutorial', 'tutorial', {}, { cls: 'btn-ghost' })}${btn('Start over', 'reset', {}, { cls: 'btn-danger' })}</div>
      </section>`;
  };

  // ---- Modals ---------------------------------------------------------------
  function openModal(m) {
    modal = m;
    renderModal();
    el.modal.hidden = false;
    const first = el.modalBody.querySelector('button, input, textarea');
    if (first) first.focus({ preventScroll: true });
  }
  function closeModal() {
    modal = null;
    el.modal.hidden = true;
    el.modalBody.innerHTML = ''; // also drops focus from any field inside it
  }
  function renderModal() {
    if (!modal) return;
    el.modalBody.innerHTML = modal.render();
    refreshLive(el.modalBody);
  }

  function confirmModal(title, text, yesLabel, onYes, danger) {
    openModal({
      render: () => `<h2>${title}</h2><p>${text}</p><div class="btn-row end">${btn('Cancel', 'closeModal', {}, { cls: 'btn-ghost' })}${btn(yesLabel, 'confirmYes', {}, { cls: danger ? 'btn-danger' : 'btn-go' })}</div>`,
      onAct: (act) => {
        if (act === 'confirmYes') {
          closeModal();
          onYes();
          return true;
        }
      },
    });
  }

  function beeStats(bee) {
    const s = S();
    const sp = D.species[bee.sp];
    const hi = f().hiveOf(s, bee.id);
    const rate = hi >= 0 ? f().beeRate(s, bee, s.hives[hi], f().isNight(s)) : (1 / sp.secs) * bee.vigor * (bee.sparkle ? 2 : 1);
    const trait = bee.trait && D.TRAITS[bee.trait];
    return `<div class="stats">
      <div class="stat-row"><span>Makes</span><b>${goodImg(sp.good)} ${D.good[sp.good].name}</b></div>
      <div class="stat-row"><span>Output</span><b>${(rate * 60).toFixed(1)}/min${hi < 0 ? ' (resting)' : ''}</b></div>
      <div class="stat-row"><span>Vigor</span><b>${util.pct(bee.vigor)}</b></div>
      <div class="stat-row"><span>Trait</span><b>${trait ? trait.name + ' · <span class="muted">' + trait.desc + '</span>' : '—'}</b></div>
      ${sp.aura ? `<div class="stat-row"><span>Special</span><b>${sp.aura.hive ? '+' + sp.aura.hive * 100 + '% hive output' : '+' + sp.aura.customers * 100 + '% customers'}</b></div>` : ''}
      ${sp.nightBonus ? `<div class="stat-row"><span>Special</span><b>+${sp.nightBonus * 100}% at night</b></div>` : ''}
      <div class="stat-row"><span>Generation</span><b>${bee.gen}</b></div>
      <div class="stat-row"><span>Lives in</span><b>${hi >= 0 ? 'Hive ' + (hi + 1) : 'Bee box'}</b></div>
    </div>`;
  }

  function beeModal(id) {
    let renaming = false;
    openModal({
      render: () => {
        const s = S();
        const bee = s.bees[id];
        if (!bee) return `<p>This bee has moved on.</p><div class="btn-row end">${btn('Close', 'closeModal')}</div>`;
        const sp = D.species[bee.sp];
        const hi = f().hiveOf(s, id);
        const moves = s.hives.map((h, i) => (i === hi ? '' : btn(`Hive ${i + 1} <span class="muted">${h.bees.length}/${f().hiveCap(h)}</span>`, 'moveBee', { id, target: i }, { cls: 'btn-sm', disabled: h.bees.length >= f().hiveCap(h) }))).join('');
        return `
          <div class="bee-hero ${bee.sparkle ? 'is-sparkle' : ''}">
            ${beeImg(bee.sp, bee.sparkle, 96)}
            <div>
              ${renaming ? `<form class="rename" data-form="rename"><input id="renameInput" maxlength="16" value="${esc(bee.name)}" aria-label="Bee name"><button class="btn btn-sm" type="submit">Save</button></form>` : `<h2>${esc(bee.name)} <button class="link" data-act="rename">rename</button></h2>`}
              <p>${sp.name} ${rarityChip(sp.rarity)} ${bee.sparkle ? '<span class="chip chip-sparkle">Sparkle</span>' : ''}</p>
            </div>
          </div>
          ${beeStats(bee)}
          <h3 class="sub">Move</h3>
          <div class="btn-row">${moves}${hi >= 0 ? btn('Bee box', 'moveBee', { id, target: 'box' }, { cls: 'btn-sm' }) : ''}</div>
          <div class="btn-row end">
            ${btn(`Sell ${price(f().sellPrice(bee))}`, 'sellBee', { id }, { cls: 'btn-ghost btn-sm' })}
            ${btn('Close', 'closeModal')}
          </div>`;
      },
      onAct: (act, ds) => {
        if (act === 'rename') {
          renaming = true;
          renderModal();
          const inp = $('#renameInput');
          if (inp) { inp.focus(); inp.select(); }
          return true;
        }
        if (act === 'moveBee') {
          const r = HC.act.moveBee(ds.id, ds.target === 'box' ? 'box' : Number(ds.target));
          if (r.ok) toast(r.msg);
          renderModal();
          return true;
        }
        if (act === 'sellBee') {
          const bee = S().bees[ds.id];
          confirmModal('Sell ' + esc(bee.name) + '?', `A keeper from the next town will pay ₵${fmt(f().sellPrice(bee))}. This can't be undone.`, 'Sell', () => {
            const r = HC.act.sellBee(ds.id);
            if (r.ok) toast(r.msg);
          }, true);
          return true;
        }
      },
      onSubmit: (form) => {
        if (form.dataset.form === 'rename') {
          HC.act.renameBee(id, $('#renameInput').value);
          renaming = false;
          renderModal();
        }
      },
    });
  }

  function addToHiveModal(hiveIdx) {
    openModal({
      render: () => {
        const s = S();
        const box = s.box.map((id) => {
          const b = s.bees[id];
          return `<button class="pick-row" data-act="pickAdd" data-id="${id}">${beeImg(b.sp, b.sparkle, 32)}<span class="grow"><b>${esc(b.name)}</b><span class="muted">${D.species[b.sp].name} · ${util.pct(b.vigor)}</span></span></button>`;
        }).join('');
        return `<h2>Add a bee to hive ${hiveIdx + 1}</h2>
          ${box ? `<div class="pick-list">${box}</div>` : '<p class="muted">Your bee box is empty. Buy bees at the Bee Market or hatch them in the Nursery.</p>'}
          <div class="btn-row end">${box ? '' : btn('Go to market', 'gotoMarket')}${btn('Close', 'closeModal', {}, { cls: 'btn-ghost' })}</div>`;
      },
      onAct: (act, ds) => {
        if (act === 'pickAdd') {
          const r = HC.act.moveBee(ds.id, hiveIdx);
          closeModal();
          if (r.ok) toast(r.msg);
          return true;
        }
        if (act === 'gotoMarket') {
          closeModal();
          setTab('apiary');
          requestAnimationFrame(() => el.panel.querySelector('.win:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          return true;
        }
      },
    });
  }

  function shelfModal(i) {
    openModal({
      render: () => {
        const s = S();
        const sh = s.shelves[i];
        const onOther = new Set(s.shelves.filter((x, k) => k !== i).map((x) => x.good));
        const rows = D.GOODS.filter((g) => s.unlockedGoods[g.id]).reverse().map((g) => `
          <button class="pick-row ${sh.good === g.id ? 'selected' : ''}" data-act="pickGood" data-good="${g.id}">
            ${goodImg(g.id, 24)}
            <span class="grow"><b>${g.name}</b><span class="muted">₵${fmt(f().price(s, g.id))} each · ${fmt(s.store[g.id] || 0)} in store${onOther.has(g.id) ? ' · also on another shelf' : ''}</span></span>
          </button>`).join('');
        return `<h2>Shelf ${i + 1}</h2><p class="muted">Pick what this shelf sells. Pricier goods need richer customers, and they come with reputation.</p>
          <div class="pick-list">${rows}</div>
          <div class="btn-row end">${sh.good ? btn('Clear shelf', 'pickGood', { good: '' }, { cls: 'btn-ghost' }) : ''}${btn('Close', 'closeModal', {}, { cls: 'btn-ghost' })}</div>`;
      },
      onAct: (act, ds) => {
        if (act === 'pickGood') {
          const r = HC.act.setShelf(i, ds.good || null);
          closeModal();
          if (r.ok) toast(r.msg);
          return true;
        }
      },
    });
  }

  function breedModal(slot) {
    const pick = { a: null, b: null };
    openModal({
      render: () => {
        const s = S();
        const busy = new Set(s.nursery.filter(Boolean).flatMap((n) => [n.a, n.b]));
        const bees = Object.values(s.bees).filter((b) => !busy.has(b.id))
          .sort((x, y) => D.species[y.sp].tier - D.species[x.sp].tier || y.vigor - x.vigor);
        const list = bees.map((b) => {
          const sel = pick.a === b.id ? 'A' : pick.b === b.id ? 'B' : '';
          return `<button class="bee-tile ${sel ? 'selected' : ''} ${b.sparkle ? 'is-sparkle' : ''}" data-act="pickParent" data-id="${b.id}">
            ${sel ? `<span class="sel-badge">${sel}</span>` : ''}
            ${beeImg(b.sp, b.sparkle, 32)}
            <span class="bee-name">${esc(b.name)}</span>
            <span class="bee-sub">${D.species[b.sp].name.replace(' Bee', '')} · ${util.pct(b.vigor)}</span>
          </button>`;
        }).join('');
        let preview = '<p class="muted">Choose two bees.</p>';
        let startBtn = '';
        if (pick.a && pick.b) {
          const a = s.bees[pick.a], b = s.bees[pick.b];
          const r = D.recipeFor(a.sp, b.sp);
          let outcome;
          if (a.sp === b.sp) outcome = `Another ${D.species[a.sp].name}, with vigor near ${util.pct((a.vigor + b.vigor) / 2 + 0.045)}.`;
          else if (r && s.discovered[r.out]) outcome = `${Math.round(r.p * 100)}% chance of a ${D.species[r.out].name}. Otherwise it takes after a parent.`;
          else if (r) outcome = '<b>These two feel close to something new…</b> Otherwise it takes after a parent.';
          else outcome = 'The egg will take after one of its parents.';
          const cost = f().breedCost(a, b);
          preview = `<div class="breed-preview">${beeImg(a.sp, a.sparkle, 40)}<span class="heart">+</span>${beeImg(b.sp, b.sparkle, 40)}
            <div class="grow"><p>${outcome}</p><p class="muted">Takes ${util.fmtTime(f().breedTime(a, b))} · costs ₵${fmt(cost)}</p></div></div>`;
          startBtn = btn(`Start ${price(cost)}`, 'startBreed', {}, { cost, cls: 'btn-go' });
        }
        return `<h2>Cradle ${slot + 1}: pick parents</h2>
          ${preview}
          <div class="bee-grid pick">${list}</div>
          <div class="btn-row end">${btn('Close', 'closeModal', {}, { cls: 'btn-ghost' })}${startBtn}</div>`;
      },
      onAct: (act, ds) => {
        if (act === 'pickParent') {
          const id = ds.id;
          if (pick.a === id) pick.a = null;
          else if (pick.b === id) pick.b = null;
          else if (!pick.a) pick.a = id;
          else if (!pick.b) pick.b = id;
          else pick.b = id;
          HC.audio.play('click');
          renderModal();
          return true;
        }
        if (act === 'startBreed') {
          const r = HC.act.startBreed(slot, pick.a, pick.b);
          if (r.ok) {
            closeModal();
            toast(r.msg);
          }
          return true;
        }
      },
    });
  }

  function guideModal(spId) {
    const s = S();
    const sp = D.species[spId];
    const known = s.discovered[spId];
    const recipesIn = D.RECIPES.filter((r) => r.out === spId);
    const usedIn = D.RECIPES.filter((r) => (r.a === spId || r.b === spId) && s.discovered[r.out]);
    openModal({
      render: () => `
        <div class="bee-hero">
          ${beeImg(spId, false, 96, known ? '' : 'mystery')}
          ${known && s.sparkleSeen[spId] ? beeImg(spId, true, 48) : ''}
          <div>
            <h2>${known ? sp.name : '???'}</h2>
            <p>${known ? rarityChip(sp.rarity) + ' · makes ' + D.good[sp.good].name : 'Not yet discovered'}</p>
          </div>
        </div>
        <p>${known ? sp.flavor : '<i>' + sp.hint + '</i>'}</p>
        ${known ? `<div class="stats">
          <div class="stat-row"><span>Base output</span><b>1 per ${sp.secs}s</b></div>
          <div class="stat-row"><span>Sells for</span><b>₵${fmt(f().price(s, sp.good))} each</b></div>
          ${recipesIn.map((r) => `<div class="stat-row"><span>Bred from</span><b>${D.species[r.a].name} + ${D.species[r.b].name}</b></div>`).join('')}
          ${usedIn.map((r) => `<div class="stat-row"><span>Parent of</span><b>${D.species[r.out].name}</b></div>`).join('')}
        </div>` : ''}
        <div class="btn-row end">${btn('Close', 'closeModal')}</div>`,
    });
  }

  function newBeeModal(evt) {
    const { bee, isNew, newSparkle } = evt;
    const sp = D.species[bee.sp];
    HC.audio.play(isNew || newSparkle ? 'discover' : 'hatch');
    openModal({
      render: () => `
        <div class="reveal ${bee.sparkle ? 'is-sparkle' : ''}">
          <p class="eyebrow">${isNew ? 'New species!' : newSparkle ? 'A sparkle!' : evt.source === 'merchant' ? 'Welcome aboard' : 'An egg hatched'}</p>
          ${beeImg(bee.sp, bee.sparkle, 128, 'pop')}
          <h2>${esc(bee.name)} the ${sp.name}</h2>
          <p>${rarityChip(sp.rarity)} ${bee.sparkle ? '<span class="chip chip-sparkle">Sparkle</span>' : ''} vigor ${util.pct(bee.vigor)}${bee.trait ? ' · ' + D.TRAITS[bee.trait].name : ''}</p>
          ${isNew ? `<p class="muted">${sp.flavor}</p><p>Makes <b>${D.good[sp.good].name}</b>, sold at ₵${fmt(f().price(S(), sp.good))} each.</p>` : ''}
        </div>
        <div class="btn-row center">${btn('Meet them', 'viewBee', { id: bee.id })}${btn('Lovely', 'closeModal', {}, { cls: 'btn-go' })}</div>`,
      onAct: (act, ds) => {
        if (act === 'viewBee') {
          beeModal(ds.id);
          return true;
        }
      },
    });
  }

  function offlineModal(r) {
    const made = Object.entries(r.made).filter(([, n]) => n > 0).map(([g, n]) => `<span class="pill">${goodImg(g)} +${fmt(n)}</span>`).join('');
    openModal({
      render: () => `
        <p class="eyebrow">Welcome back</p>
        <h2>While you were away (${util.fmtTime(r.seconds)})</h2>
        <div class="stats">
          <div class="stat-row"><span>Coins earned</span><b>${coin()} ${fmt(r.coins)}</b></div>
          <div class="stat-row"><span>Items sold</span><b>${fmt(r.sold)}</b></div>
        </div>
        ${made ? `<p class="muted">Added to the storehouse:</p><div class="pills">${made}</div>` : ''}
        ${[
          r.eggs ? `${r.eggs === 1 ? 'An egg is' : r.eggs + ' eggs are'} ready to hatch in the Nursery.` : '',
          r.newOrders ? `${r.newOrders} new ${r.newOrders === 1 ? 'request is' : 'requests are'} pinned on the Town board.` : '',
          r.merchant ? 'A travelling merchant is parked outside.' : '',
          r.season ? `${r.season.name} has arrived. ${r.season.desc}` : '',
        ].filter(Boolean).map((t) => `<p>• ${t}</p>`).join('')}
        <p class="muted small">Your helper runs the shop at a slower pace while you're gone, for up to 8 hours.</p>
        <div class="btn-row end">${btn('Open the shop', 'closeModal', {}, { cls: 'btn-go' })}</div>`,
    });
  }

  function festivalModal() {
    let keep = null;
    openModal({
      render: () => {
        const s = S();
        const gain = f().festivalRibbons(s);
        const bees = Object.values(s.bees).sort((a, b) => f().beeValue(b) - f().beeValue(a)).slice(0, 18);
        return `<h2>Honey Festival</h2>
          <p>The whole town turns out. You earn <b>${gain} ribbons</b> (+${gain * 10}% sale prices, for good).</p>
          <p class="muted">You start over with a fresh garden, and you keep the Field Guide and ribbons. Pick one keepsake bee to bring along:</p>
          <div class="bee-grid pick">${bees.map((b) => `<button class="bee-tile ${keep === b.id ? 'selected' : ''} ${b.sparkle ? 'is-sparkle' : ''}" data-act="keep" data-id="${b.id}">${beeImg(b.sp, b.sparkle, 32)}<span class="bee-name">${esc(b.name)}</span><span class="bee-sub">${D.species[b.sp].name.replace(' Bee', '')} · ${util.pct(b.vigor)}</span></button>`).join('')}</div>
          <div class="btn-row end">${btn('Not yet', 'closeModal', {}, { cls: 'btn-ghost' })}${btn('Hold the festival', 'holdFestival', {}, { cls: 'btn-go', disabled: !keep })}</div>`;
      },
      onAct: (act, ds) => {
        if (act === 'keep') {
          keep = ds.id;
          renderModal();
          return true;
        }
        if (act === 'holdFestival') {
          const r = HC.act.holdFestival(keep);
          if (r.ok) {
            closeModal();
            setTab('apiary');
          }
          return true;
        }
      },
    });
  }

  // ---- Live bindings --------------------------------------------------------
  function refreshLive(root = document) {
    root.querySelectorAll('[data-live],[data-afford],[data-width],[data-html]').forEach((node) => {
      try {
        if (node.dataset.live) {
          const fn = live.get(node.dataset.live);
          if (fn) {
            const v = String(fn());
            if (node.textContent !== v) node.textContent = v;
          }
        }
        if (node.dataset.html) {
          const fn = live.get(node.dataset.html);
          if (fn) {
            const v = fn();
            if (node._html !== v) {
              node.innerHTML = v;
              node._html = v;
            }
          }
        }
        if (node.dataset.afford) {
          const fn = live.get(node.dataset.afford);
          if (fn) node.classList.toggle('cant', !fn());
        }
        if (node.dataset.width) {
          const fn = live.get(node.dataset.width);
          if (fn) node.style.width = Math.round(util.clamp(fn(), 0, 1) * 100) + '%';
        }
      } catch (e) {
        /* a binding whose subject vanished; the next render replaces it */
      }
    });
  }

  function render() {
    live.clear();
    renderHud();
    el.panel.innerHTML = panels[tab]();
    el.tabs.querySelectorAll('[data-tab]').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.setAttribute('aria-selected', on);
      b.classList.toggle('on', on);
    });
    updateBadges();
    if (modal) renderModal();
    refreshLive();
    dirty = false;
  }

  function updateBadges() {
    const s = S();
    const badge = (t, on) => el.tabs.querySelector(`[data-tab="${t}"]`)?.classList.toggle('badge', !!on);
    badge('nursery', s.nursery.some((n) => n && n.ready));
    badge('town', s.orders.some((o) => (s.store[o.good] || 0) >= o.qty) || f().festivalRibbons(s) > 0);
    badge('apiary', !!s.merchant);
  }

  function setTab(t) {
    tab = t;
    dirty = true;
    render();
    el.panel.scrollTop = 0;
  }

  // ---- Event handling -------------------------------------------------------
  function handleAct(act, ds) {
    const s = S();
    HC.audio.unlock();
    if (modal && modal.onAct && modal.onAct(act, ds)) return;
    let r;
    switch (act) {
      case 'tab': return setTab(ds.tab);
      case 'closeModal': return closeModal();
      case 'buyBee': r = HC.act.buyBee(ds.sp); break;
      case 'buildHive': r = HC.act.buildHive(); break;
      case 'upgradeHive': r = HC.act.upgradeHive(Number(ds.i)); break;
      case 'upgrade': r = HC.act.buyUpgrade(ds.id); break;
      case 'bee': return beeModal(ds.id);
      case 'addToHive': return addToHiveModal(Number(ds.i));
      case 'shelf': return shelfModal(Number(ds.i));
      case 'breed': return breedModal(Number(ds.slot));
      case 'hatch': r = HC.act.hatch(Number(ds.slot)); break;
      case 'cancelBreed':
        return confirmModal('Cancel this egg?', 'The coins spent on it are not refunded.', 'Cancel egg', () => HC.act.cancelBreed(Number(ds.slot)), true);
      case 'deliver': r = HC.act.deliverOrder(ds.id); break;
      case 'dismiss': r = HC.act.dismissOrder(ds.id); break;
      case 'merchant': r = HC.act.buyMerchant(); break;
      case 'festival': return festivalModal();
      case 'claimGoal': r = HC.goals.claim(); break;
      case 'season': {
        const se = f().season(s);
        say([`${se.name}. ${se.desc} ${util.fmtTime(f().seasonLeft(s))} until the season turns.`]);
        return;
      }
      case 'guide': return guideModal(ds.sp);
      case 'save':
        HC.main.save();
        toast('Saved.');
        return;
      case 'export': {
        const code = HC.state.exportSave(s);
        $('#saveArea').innerHTML = `<label class="small muted" for="exportBox">Copy this code somewhere safe:</label><textarea id="exportBox" readonly rows="4">${code}</textarea>${btn('Copy', 'copyExport', {}, { cls: 'btn-sm' })}`;
        $('#exportBox').select();
        return;
      }
      case 'copyExport': {
        const box = $('#exportBox');
        box.select();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(box.value).then(() => toast('Copied.'), () => toast('Select the text and copy it manually.'));
        } else toast('Select the text and copy it manually.');
        return;
      }
      case 'import':
        $('#saveArea').innerHTML = `<label class="small muted" for="importBox">Paste a save code:</label><textarea id="importBox" rows="4"></textarea>${btn('Load this save', 'doImport', {}, { cls: 'btn-sm' })}`;
        $('#importBox').focus();
        return;
      case 'doImport': {
        try {
          const loaded = HC.state.importSave($('#importBox').value);
          HC.main.replaceGame(loaded);
          toast('Save loaded.');
        } catch (e) {
          toast('That code could not be read. Check that it was copied in full.', 'bad');
        }
        return;
      }
      case 'reset':
        return confirmModal('Start over?', 'This erases your shop, bees and Field Guide on this device.', 'Erase and restart', () => HC.main.replaceGame(HC.state.newGame(), true), true);
      case 'tutorial':
        s.hints = {};
        return;
      default:
        return;
    }
    if (r && r.ok && r.msg) toast(r.msg);
  }

  function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    if (t.type === 'checkbox') return; // handled on change
    e.preventDefault();
    if (t.classList.contains('cant') && t.dataset.afford) {
      bus.emit('fail', t.dataset.need || 'Not enough coins.');
      t.classList.remove('shake');
      void t.offsetWidth;
      t.classList.add('shake');
      return;
    }
    handleAct(t.dataset.act, t.dataset);
  }

  function onChange(e) {
    const t = e.target;
    if (t.dataset.act === 'setting') {
      S().settings[t.dataset.key] = t.checked;
      HC.audio.unlock();
      HC.audio.syncMusic();
      HC.main.save();
    }
  }

  function onCanvasTap(e) {
    HC.audio.unlock();
    const rect = el.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * HC.layout.W;
    const y = ((e.clientY - rect.top) / rect.height) * HC.layout.H;
    if (!el.textbox.hidden && y > HC.layout.H * 0.62) {
      nextLine();
      return;
    }
    const hit = HC.render.hitTest(S(), x, y);
    if (!hit) {
      if (!el.textbox.hidden) nextLine();
      return;
    }
    if (hit.kind === 'drip') {
      const amt = HC.sim.claimDrip(S());
      if (amt) {
        HC.audio.play('discover');
        toast('Golden drip! +₵' + fmt(amt), 'good');
      }
      return;
    }
    HC.audio.play('click');
    if (hit.kind === 'hive') {
      setTab('apiary');
      requestAnimationFrame(() => {
        const card = $('#hive-' + hit.index);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('flash');
          setTimeout(() => card.classList.remove('flash'), 900);
        }
      });
    } else if (hit.kind === 'buildHive') {
      setTab('apiary');
      requestAnimationFrame(() => $('.build-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } else if (hit.kind === 'shelf') shelfModal(hit.index);
    else if (hit.kind === 'buyShelf') setTab('shop');
    else if (hit.kind === 'merchant') setTab('town');
    else if (hit.kind === 'keeper') say([util.pick(D.TIPS)]);
  }

  // ---- Tutorial hints -------------------------------------------------------
  const HINTS = [
    { id: 'welcome', when: () => true, lines: ['Welcome to Honeycomb Corner!', 'Your bees fill jars out in the garden, and customers buy whatever is on the shelves.', 'Earn coins, grow the apiary, and breed new kinds of bees. Tap the shopkeeper any time for a tip.'] },
    { id: 'buyBee', when: (s) => s.coins >= f().marketPrice(s, 'meadow') && f().beeCount(s) < 3, lines: ['Hive 1 has room for one more bee. Open the Apiary tab and buy a Meadow Bee.'] },
    { id: 'clover', when: (s) => f().marketUnlocked(s, 'clover') && !s.discovered.clover, lines: ['Word is getting around! The Bee Market now sells Clover Bees.'] },
    { id: 'shelf2', when: (s) => Object.keys(s.unlockedGoods).length >= 2 && s.shelves.length === 1, lines: ['You make two products now. Buy an Extra Shelf in the Shop tab so customers can find both.'] },
    { id: 'nursery', when: (s) => s.discovered.clover && !s.discovered.waxwing, lines: ['Try the Nursery: pair a Meadow Bee with a Clover Bee and see what hatches.'] },
    { id: 'order', when: (s) => s.orders.length > 0, lines: ['Someone pinned a request on the Town board. Fill it for a big payout and a boost to your reputation.'] },
    { id: 'merchant', when: (s) => !!s.merchant, lines: ['A travelling merchant has parked outside. The bees are rare, and the wagon won\'t stay long.'] },
    { id: 'drip', when: () => !!HC.sim.rt.drip, lines: ['A golden drip is glistening on one of your hives. Tap it before it drips away!'] },
    { id: 'boxfull', when: (s) => s.box.length >= f().boxCap(s), lines: ['Your bee box is full. Build or upgrade a hive, or sell bees you don\'t need.'] },
    { id: 'night', when: (s) => s.discovered.moonmoth && f().isNight(s), lines: ['Night has fallen. Moonmoth Bees are hard at work.'] },
    { id: 'festival', when: (s) => f().festivalRibbons(s) > 0, lines: ['The town wants to throw a Honey Festival in your honour! Take a look in the Town tab.'] },
  ];
  function checkHints() {
    const s = S();
    // A hint the player has already acted on dismisses itself.
    if (!el.textbox.hidden && shown && shown.valid && !shown.valid()) {
      if (typing) {
        clearInterval(typing.timer);
        typing = null;
      }
      nextLine();
    }
    if (!el.textbox.hidden || modal) return;
    for (const h of HINTS) {
      if (s.hints[h.id]) continue;
      if (h.when(s)) {
        s.hints[h.id] = true;
        say(h.lines, h.id === 'welcome' ? null : () => h.when(S()));
        return;
      }
    }
  }

  // ---- Init -----------------------------------------------------------------
  function init() {
    el.hud = $('#hud');
    el.goalbar = $('#goalbar');
    el.panel = $('#panel');
    el.tabs = $('#tabs');
    el.modal = $('#modal');
    el.modalBody = $('#modalBody');
    el.toasts = $('#toasts');
    el.textbox = $('#textbox');
    el.textboxText = $('#textboxText');
    el.canvas = $('#scene');

    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', (e) => {
      e.preventDefault();
      if (modal && modal.onSubmit) modal.onSubmit(e.target);
    });
    el.canvas.addEventListener('pointerdown', onCanvasTap);
    el.textbox.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      nextLine();
    });
    el.modal.addEventListener('pointerdown', (e) => {
      if (e.target === el.modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
      if (!typing && !modal && /^[1-6]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setTab(['apiary', 'shop', 'nursery', 'town', 'guide', 'menu'][Number(e.key) - 1]);
        return;
      }
      if (e.key === 'Escape' && modal) closeModal();
      else if ((e.key === 'Enter' || e.key === ' ') && !el.textbox.hidden && document.activeElement === document.body) {
        e.preventDefault();
        nextLine();
      }
    });

    bus.on('dirty', () => (dirty = true));
    bus.on('fail', (msg) => {
      toast(msg, 'bad');
      HC.audio.play('fail');
    });
    bus.on('sfx', (n) => HC.audio.play(n));
    bus.on('sale', () => HC.audio.play('coin'));
    bus.on('newBee', (evt) => {
      if (evt.source === 'market' && !evt.isNew) return;
      newBeeModal(evt);
    });
    const quiet = () => HC.sim.rt.silent;
    bus.on('eggReady', (i) => {
      if (quiet()) return;
      toast('An egg in cradle ' + (i + 1) + ' is ready to hatch!', 'good');
      HC.audio.play('bell');
    });
    bus.on('order', (o) => !quiet() && toast(o.who + ' pinned a request for ' + D.good[o.good].name + '.'));
    bus.on('merchant', () => {
      if (quiet()) return;
      toast('A travelling merchant parked outside!', 'good');
      HC.audio.play('bell');
    });
    bus.on('season', (se) => {
      toast(se.name + ' has arrived. ' + se.desc, 'good');
      HC.audio.play('bell');
    });
    bus.on('festival', (e) => {
      renderHud();
      say(['What a festival! The town awarded you ' + e.gain + ' ribbons.', 'You have ' + e.total + ' ribbons now, so every sale earns ' + e.total * 10 + '% more. Time to build it all again!']);
    });

    // Don't rebuild the page under someone who is typing (rename, import).
    const typingNow = () => {
      const a = document.activeElement;
      return a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.type !== 'checkbox';
    };
    setInterval(() => {
      if (dirty && !typingNow()) render();
      else {
        refreshLive();
        updateBadges();
      }
    }, 250);
    setInterval(checkHints, 1000);
    render();
  }

  HC.ui = {
    init, render, toast, say, offlineModal, setTab,
    markDirty: () => (dirty = true),
    get tab() { return tab; },
  };
})();
