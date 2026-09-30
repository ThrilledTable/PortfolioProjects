// =============================================================================
// ui.js: THE MENUS, BUTTONS AND MESSAGES AROUND THE GAME PICTURE
// -----------------------------------------------------------------------------
// Everything that isn't the pixel scene is built here as ordinary web page
// content (HTML): the status bar, the goal/work strip, the tabs (Apiary,
// Shop, Nursery, Town, Store, Guide), pop-up windows ("modals"), the little
// messages that slide in ("toasts") and the tutorial text box.
//
// HOW THE SCREEN STAYS UP TO DATE
// Rebuilding a whole tab 20 times a second would be slow and would swallow
// clicks (a button replaced mid-tap never receives the tap). So there are
// two kinds of updates:
//   1. Full redraws, only when something structural changes: you bought a
//      bee, a build finished, a request appeared... Game code signals this
//      by announcing 'dirty' on the message bus.
//   2. "Live" values: numbers that tick constantly (coins, timers, honey
//      meters). These are marked in the HTML with data-live="..." (text),
//      data-width="..." (progress bars), data-afford="..." (buttons that
//      grey out when you can't pay) or data-html="..." (small chunks).
//      Four times a second, refreshLive() updates only those.
//
// HOW BUTTONS WORK
// Every button has data-act="something" (plus optional data-* details).
// One click listener for the whole page reads data-act and calls
// handleAct(), which calls the matching function in actions.js.
// =============================================================================
(function () {
  const HC = window.HC;
  const { util, data: D, spr, bus } = HC;
  const { fmt, esc } = util;
  const f = () => HC.sim.f;
  const S = () => HC.game;

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = {}; // handy references to page elements, filled in init()
  let tab = 'apiary'; // which tab is open
  let dirty = true; // does the open tab need a full redraw?
  let modal = null; // the open pop-up: { render, onAct?, onSubmit? }
  const live = new Map(); // live-value functions, looked up by id
  let liveSeq = 0;

  // Register a live value; returns an id to put in a data-live attribute.
  function L(fn) {
    const id = 'l' + liveSeq++;
    live.set(id, fn);
    return id;
  }

  // ---------------------------------------------------------------------------
  // Little HTML building blocks
  // ---------------------------------------------------------------------------
  const icon = (name, size = 16) => `<img class="px ico" src="${spr.miscURL(name)}" alt="" width="${size}" height="${size}">`;
  const coin = () => icon('coin');
  const gem = () => icon('gem');
  const goodImg = (g, size = 16) => `<img class="px ico" src="${spr.goodURL(g)}" alt="" width="${size}" height="${size}">`;
  const beeImg = (sp, sparkle, size = 32, cls = '') => `<img class="px bee-img ${cls}" src="${spr.beeURL(sp, sparkle)}" alt="" draggable="false" width="${size}" height="${size}">`;
  const price = (n) => `${coin()}<span>${fmt(n)}</span>`;
  const gemPrice = (n) => `${gem()}<span>${n}</span>`;
  const rarityChip = (r) => `<span class="chip chip-${r.toLowerCase()}">${r}</span>`;
  const bar = (fn, cls = '') => `<span class="bar ${cls}"><i data-width="${L(fn)}"></i></span>`;

  // A button. opts.cost greys it out while you can't afford it;
  // opts.gems does the same for gems; opts.need is the message shown if
  // tapped while greyed out.
  function btn(label, act, args = {}, opts = {}) {
    const data = Object.entries(args).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
    let afford = '';
    if (opts.cost != null) afford = `data-afford="${L(() => S().coins >= opts.cost && (!opts.build || HC.builds.freeBuilder(S())))}" data-cost="${opts.cost}"`;
    else if (opts.gems != null) afford = `data-afford="${L(() => S().gems >= opts.gems)}"`;
    const need = opts.need ? `data-need="${esc(opts.need)}"` : '';
    const dis = opts.disabled ? 'disabled' : '';
    return `<button class="btn ${opts.cls || ''}" data-act="${act}" ${data} ${afford} ${need} ${dis}>${label}</button>`;
  }

  // A "build this" button showing cost and how long it takes. If that exact
  // thing is already under construction, shows its progress and a gem skip.
  function buildBtn(label, act, args, cost, kind, key) {
    const s = S();
    const b = HC.builds.find(s, kind, key);
    if (b) return buildingChip(b);
    const busy = HC.builds.freeBuilder(s) ? '' : 'Your builder is busy. Wait for the current build, or finish it now with gems.';
    return btn(`${label} ${price(cost)} <span class="time">${util.fmtTime(f().buildTime(cost))}</span>`, act, args, { cost, build: true, need: busy || 'Not enough coins.', cls: 'btn-sm' });
  }
  function buildingChip(b) {
    return `<span class="building">${icon('hammer', 12)}<span data-live="${L(() => util.fmtTime(HC.builds.left(S(), b)))}"></span>
      ${bar(() => 1 - HC.builds.left(S(), b) / b.dur, 'mini')}
      <button class="btn btn-sm btn-gem" data-act="skipBuild" data-id="${b.id}" data-afford="${L(() => S().gems >= f().gemsToSkip(HC.builds.left(S(), b)))}" data-need="Not enough gems.">Finish ${gem()}<span data-live="${L(() => f().gemsToSkip(HC.builds.left(S(), b)))}"></span></button></span>`;
  }

  // ---------------------------------------------------------------------------
  // Toasts (sliding messages) and the tutorial text box
  // ---------------------------------------------------------------------------
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
  // Same, but at most once every `secs` seconds per `key` (avoids spam).
  const lastToast = {};
  function toastOnce(key, secs, msg, kind) {
    const now = Date.now();
    if (lastToast[key] && now - lastToast[key] < secs * 1000) return;
    lastToast[key] = now;
    toast(msg, kind);
  }

  // The text box types out lines one letter at a time. Each line can carry a
  // `valid` check: if it's no longer true (you already did the thing), the
  // line is skipped or dismissed.
  const textQueue = [];
  let typing = null;
  let shown = null;
  function say(lines, valid) {
    textQueue.push(...lines.map((text) => ({ text, valid })));
    if (!typing && el.textbox.hidden) nextLine();
  }
  function nextLine() {
    if (typing) {
      // Tapped while typing: finish the line instantly.
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
    // The shopkeeper's portrait (wearing whatever you've dressed them in).
    const face = $('#textboxFace');
    if (face) face.src = spr.personURL(spr.keeperLook(S()));
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

  // ---------------------------------------------------------------------------
  // STATUS BAR (under the picture) and the goal / work / build strip
  // ---------------------------------------------------------------------------
  function renderHud() {
    const s = S();
    el.hud.innerHTML = `
      <div class="hud-coins" title="Coins">${coin()}<b data-live="${L(() => fmt(S().coins))}"></b></div>
      <div class="hud-gems" title="Gems: finish timers early, buy special items">${gem()}<b data-live="${L(() => fmt(S().gems))}"></b></div>
      <div class="hud-item" title="Income over the last minute"><span class="lbl">per min</span><b data-live="${L(() => fmt(HC.sim.incomePerMin()))}"></b></div>
      <button class="hud-item hud-rep" data-act="rep" title="Reputation: tap to see what raises and lowers it"><span class="stars" data-html="${L(starsHtml)}"></span><b data-live="${L(() => S().rep.toFixed(1))}"></b></button>
      <div class="hud-item hud-time" title="Time of day"><span data-html="${L(timeHtml)}"></span></div>
      <button class="hud-item season-chip" data-act="season" data-html="${L(seasonHtml)}"></button>
      ${s.ribbons ? `<div class="hud-item" title="Festival ribbons: +${s.ribbons * 10}% sale prices">${icon('ribbon')}<b>${s.ribbons}</b></div>` : ''}
    `;
    // The strip: current goal, what the shopkeeper is doing, and builds.
    const keeper = HC.workers.keeper();
    el.goalbar.innerHTML = `
      <div class="goal-inner" data-html="${L(goalHtml)}"></div>
      <div class="work-row">
        <span class="goal-label">Shopkeeper</span>
        <span class="work-text" data-live="${L(() => (keeper ? HC.workers.statusOf(S(), keeper) : ''))}"></span>
        <span class="work-queue" data-live="${L(() => (HC.workers.keeperJobs.length ? '+' + HC.workers.keeperJobs.length + ' errand' + (HC.workers.keeperJobs.length > 1 ? 's' : '') : ''))}"></span>
        ${HC.workers.keeperJobs.length ? '<button class="link" data-act="cancelErrands">clear</button>' : ''}
        <span class="work-open" data-html="${L(openHtml)}"></span>
      </div>
      <div class="work-row today-row" data-html="${L(todayHtml)}"></div>
      ${s.builds.map((b) => `<div class="build-row"><span class="goal-label">Building</span><span class="work-text">${esc(b.label)}</span>${buildingChip(b)}</div>`).join('')}
    `;
  }
  function goalHtml() {
    const s = S();
    const g = HC.goals.current(s);
    if (!g) return '<span class="goal-text">Every goal complete. The town is proud of you.</span>';
    const ok = g.check(s);
    const reward = price(g.reward) + (g.gems ? ' ' + gemPrice(g.gems) : '');
    // Counting goals (sell 1,000 items...) get a filling progress bar.
    let prog = '';
    // The guide is waiting for you to afford the next step (see updateSpotlight).
    if (!ok && guideWait && guideWait.cost) {
      prog = `<span class="goal-progress"><span class="lbl-save">Saving up</span><span class="bar"><i style="width:${Math.round(util.clamp(s.coins / guideWait.cost, 0, 1) * 100)}%"></i></span><b>₵${fmt(s.coins)} / ₵${fmt(guideWait.cost)}</b></span>`;
    } else if (!ok && guideWait && guideWait.busy) {
      prog = '<span class="goal-progress"><span class="lbl-save">Waiting for your builder to finish the current job</span></span>';
    }
    if (g.progress && !ok && !prog) {
      const [have, need] = g.progress(s);
      prog = `<span class="goal-progress"><span class="bar"><i style="width:${Math.round(util.clamp(have / need, 0, 1) * 100)}%"></i></span><b>${fmt(have)} / ${fmt(need)}</b></span>`;
    }
    // Milestone goals (the only ones that pay gems) get a small gem badge.
    return `<span class="goal-label">Goal ${(s.goal || 0) + 1}</span>${g.milestone ? '<span class="chip chip-gem">Milestone</span>' : ''}<button class="goal-text" data-act="goalHint" title="Show a hint">${g.text}</button>` +
      (ok ? `<button class="btn btn-sm btn-go" data-act="claimGoal">Claim ${reward}</button>` : `<span class="goal-reward">${reward}</span>`) + prog;
  }
  // "Open", "Lunch rush!" or "Closed for the night".
  function openHtml() {
    const s = S();
    if (!f().isOpen(s)) return '<span class="closed">Closed · bees asleep</span>';
    return f().isRush(s) ? '<span class="rush">Lunch rush!</span>' : '<span class="open">Open</span>';
  }
  // Today's special and whether the food critic is still expected.
  function todayHtml() {
    const s = S();
    const bits = [];
    if (s.special && f().isSpecial(s, s.special.good)) {
      const g = D.good[s.special.good];
      bits.push(`<span class="goal-label">Today</span><span class="today-item">${goodImg(g.id, 14)} <b>${g.name}</b> is the special · +${Math.round((D.EVENTS.special.priceMult - 1) * 100)}% price</span>`);
    }
    const cr = s.critic;
    if (cr && cr.day === f().day(s) && !cr.done) bits.push('<span class="today-item critic-note">A food critic is expected today</span>');
    else if (HC.sim.rt.customers.some((c) => c.critic && !c.done)) bits.push('<span class="today-item critic-note">The food critic is in the shop!</span>');
    return bits.join('');
  }
  function seasonHtml() {
    const s = S();
    const se = f().season(s);
    return `<span class="season-dot season-${se.id}"></span><b>${se.name}</b><span class="lbl">day ${f().day(s)}</span>`;
  }
  function starsHtml() {
    const r = S().rep;
    let h = '';
    for (let i = 0; i < 5; i++) h += icon(r >= i + 0.5 ? 'star' : 'starEmpty', 12);
    return h + `<span class="sr-only">${r.toFixed(1)} of 5</span>`;
  }
  function timeHtml() {
    const p = f().dayPhase(S());
    const mins = Math.floor(((p * 24 + 6) % 24) * 60); // day starts at 6am
    const hh = Math.floor(mins / 60), mm = mins % 60;
    const night = f().isNight(S());
    const label = `${((hh + 11) % 12) + 1}:${String(mm - (mm % 10)).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
    return `${icon(night ? 'moon' : 'sun', 14)}<b>${label}</b>`;
  }

  // ---------------------------------------------------------------------------
  // TAB PANELS. Each returns the HTML for one tab.
  // ---------------------------------------------------------------------------
  const panels = {};

  // A small card for one bee (used in hives, the bee box, pickers).
  function beeTile(bee, extra = '') {
    const sp = D.species[bee.sp];
    const resting = f().busyBees(S()).has(bee.id);
    return `<button class="bee-tile ${bee.sparkle ? 'is-sparkle' : ''} ${resting ? 'resting' : ''}" data-act="bee" data-id="${bee.id}" title="${esc(bee.name)}">
      ${resting ? '<span class="rest-badge">nursery</span>' : ''}
      ${beeImg(bee.sp, bee.sparkle, 32)}
      <span class="bee-name">${esc(bee.name)}</span>
      <span class="bee-sub">${sp.name.replace(' Bee', '')} · ${util.pct(bee.vigor)}</span>
      ${extra}
    </button>`;
  }

  // ---- APIARY ---------------------------------------------------------------
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
      const upgrade = h.level < D.HIVE_MAX_LEVEL
        ? buildBtn('Upgrade', 'upgradeHive', { i }, f().hiveUpgradeCost(s, i), 'hiveUp', i)
        : '<span class="chip">Max level</span>';
      return `<article class="card hive-card" id="hive-${i}" data-drop-hive="${i}">
        <header class="card-head">
          <button class="hive-style-btn" data-act="hiveStyle" data-i="${i}" title="Change this hive's look"><img class="px hive-ico" src="${spr.hiveURL(h.level, h.style || s.cos.equip.hiveStyle)}" alt="" width="27" height="48"><span>Style</span></button>
          <div class="grow"><h3>Hive ${i + 1}</h3><p class="muted">Level ${h.level + 1} · ${h.bees.length}/${cap} bees · ${util.pct(f().hiveMult(s, h))} output</p></div>
          ${upgrade}
        </header>
        <div class="honey-row">
          <span class="lbl">Honey</span>
          ${bar(() => f().honeyIn(S().hives[i]) / f().honeyCap(S().hives[i]), 'honey')}
          <b data-live="${L(() => f().honeyIn(S().hives[i]) + '/' + f().honeyCap(S().hives[i]))}"></b>
          <span class="full-flag" data-html="${L(() => (f().hiveFull(S().hives[i]) ? 'Full! Bees are waiting' : f().isNight(S()) ? '<span class=\"zzz\">Zzz · asleep</span>' : ''))}"></span>
          ${btn('Collect', 'collect', { i }, { cls: 'btn-sm' })}
        </div>
        <div class="bee-grid">${slots.join('')}</div>
      </article>`;
    }).join('');

    let nextHive = '';
    if (s.hives.length < 6) {
      const b = HC.builds.find(s, 'hive', s.hives.length);
      nextHive = `<article class="card build-card">
        <div class="grow"><h3>Build hive ${s.hives.length + 1}</h3><p class="muted">Room for 3 more bees and ${f().honeyCap({ level: 0 })} jars of honey.</p></div>
        ${b ? buildingChip(b) : buildBtn('Build', 'buildHive', {}, f().hiveCost(s), 'hive', s.hives.length)}
      </article>`;
    }

    const boxBees = s.box.map((id) => beeTile(s.bees[id])).join('') || '<p class="muted empty-note">No spare bees. Bees you buy or hatch land here when the hives are full.</p>';
    const market = ['meadow', 'clover'].map((sp) => {
      const spec = D.species[sp];
      const unlocked = f().marketUnlocked(s, sp);
      const cost = f().marketPrice(s, sp);
      return `<div class="row-item ${unlocked ? '' : 'locked'}">
        ${beeImg(sp, false, 32)}
        <div class="grow"><b>${spec.name}</b><p class="muted">${unlocked ? `Makes ${D.good[spec.good].name} · 1 per ${spec.secs}s` : `Unlocks after earning ₵${fmt(150)} in total.`}</p></div>
        ${unlocked ? btn(`Buy ${price(cost)}`, 'buyBee', { sp }, { cost }) : '<span class="chip">Locked</span>'}
      </div>`;
    }).join('');
    const prod = Object.entries(rates).sort((a, b) => D.good[a[0]].tier - D.good[b[0]].tier)
      .map(([g, r]) => `<span class="pill">${goodImg(g)} ${(r * 60).toFixed(1)}/min</span>`).join('');

    return `
      <section class="win">
        <div class="win-head"><h2>Apiary</h2>${btn('Collect all', 'collectAll', {}, { cls: 'btn-sm' })}</div>
        <p class="muted small">${f().beeCount(s)} bees · ${s.hives.length}/6 hives. Bees fill their hive with honey; when it's full they stop until someone collects it. Tap a hive in the garden to send the shopkeeper. <b>Long-press a bee and drag it</b> onto another hive (or onto a bee to swap them).</p>
        <div class="pills">${prod || '<span class="muted">Nothing in production.</span>'}</div>
        <div class="stack">${hiveCards}${nextHive}</div>
      </section>
      <section class="win" data-drop-box="1">
        <div class="win-head"><h2>Bee box</h2><span class="muted">${s.box.length}/${f().boxCap(s)} spaces</span>
          ${s.box.length >= 4 ? btn('Sell extras', 'sellExtras', {}, { cls: 'btn-sm btn-ghost' }) : ''}</div>
        <div class="bee-grid">${boxBees}</div>
      </section>
      <section class="win" id="market">
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

  // ---- SHOP -----------------------------------------------------------------
  panels.shop = function () {
    const s = S();
    const cap = f().shelfCap(s);

    // Staff: the shopkeeper and each hired helper, with a row of duty
    // buttons to reassign them, then a card to hire the next helper.
    const dutyButtons = (who, current) => `<div class="duty-row" role="group" aria-label="Duty">${D.DUTIES.map((d) => {
      const locked = d.needs === 'machine' && !s.machine;
      const on = current === d.id;
      return `<button class="duty ${on ? 'on' : ''}" data-act="setDuty" data-who="${who}" data-duty="${d.id}" ${locked ? 'disabled title="Build the Candle Machine first"' : `title="${esc(d.desc)}"`} aria-pressed="${on}">${d.short}</button>`;
    }).join('')}</div>`;
    // Training buttons under each helper: "Quick feet Lv 2 → ₵3,600" etc.
    const trainButtons = (id) => `<div class="train-row">${Object.entries(D.TRAINING).map(([track, t]) => {
      const lv = f().trainLevel(s, id, track);
      if (lv >= t.max) return `<span class="chip">${t.name} max</span>`;
      const cost = f().trainCost(s, id, track);
      const what = track === 'speed' ? `+${Math.round(t.per * 100)}% walking speed` : `+${t.per} jars per trip`;
      return btn(`${t.name} <span class="muted">Lv ${lv}</span> ${price(cost)}`, 'train', { id, track }, { cost, cls: 'btn-sm btn-ghost', need: 'Not enough coins.' }).replace('<button ', `<button title="${what}" `);
    }).join('')}</div>`;
    const workerNow = (role) => `<p class="small">Now: <span data-live="${L(() => { const x = HC.workers.list.find((y) => y.role === role); return x ? HC.workers.statusOf(S(), x) : ''; })}"></span></p>`;
    const keeperDuty = HC.workers.dutyOf(s, 'keeper');
    let staff = `<div class="row-item staff-row">
        <img class="px person" src="${spr.personURL(spr.keeperLook(s))}" alt="" width="32" height="40">
        <div class="grow"><b>You (shopkeeper)</b> <span class="chip">${D.duty[keeperDuty].name}</span>
          <p class="muted">Runs your errands first (tapping a hive, the machine, Restock now), then does their duty.</p>
          ${workerNow('keeper')}
          ${dutyButtons('keeper', keeperDuty)}
        </div>
      </div>`;
    for (const st of D.STAFF) {
      if (!s.staff[st.id]) continue;
      const duty = HC.workers.dutyOf(s, st.id);
      staff += `<div class="row-item staff-row">
        <img class="px person" src="${spr.personURL(st.look)}" alt="" width="32" height="40">
        <div class="grow"><b>${st.name}</b> <span class="chip">${D.duty[duty].name}</span> <span class="muted small">₵${st.wage}/day + ${Math.round(D.WAGE_SHARE * 100)}% of sales</span>
          ${workerNow(st.id)}
          ${dutyButtons(st.id, duty)}
          ${trainButtons(st.id)}
        </div>
        ${btn('Let go', 'fire', { id: st.id }, { cls: 'btn-sm btn-ghost' })}
      </div>`;
    }
    const nextHire = D.STAFF.find((x) => !s.staff[x.id]);
    if (nextHire) {
      staff += `<div class="row-item staff-row hire-row">
        <img class="px person" src="${spr.personURL(nextHire.look)}" alt="" width="32" height="40">
        <div class="grow"><b>${nextHire.name}</b> <span class="chip">looking for work</span>
          <p class="muted">Wage ₵${nextHire.wage} each morning plus ${Math.round(D.WAGE_SHARE * 100)}% of the day's earnings. Starts on ${D.duty[nextHire.duty].name}; you can reassign them any time.</p></div>
        ${btn(`Hire ${price(nextHire.hire)}`, 'hire', { id: nextHire.id }, { cost: nextHire.hire, cls: 'btn-sm' })}
      </div>`;
    }
    // Who's on each duty right now, and a warning if the register is empty.
    const cover = D.DUTIES.map((d) => `<span class="pill">${d.short} <b>${HC.workers.onDuty(s, d.id)}</b></span>`).join('');
    const noRegister = !HC.workers.onDuty(s, 'register');
    const wages = f().wagesPerDay(s);

    // Candle Machine
    let machine;
    if (!s.discovered.waxwing) {
      machine = '<p class="muted">Breed a Waxwing Bee to start making Beeswax. The Candle Machine turns wax into candles.</p>';
    } else if (!s.machine) {
      const b = HC.builds.find(s, 'machine', 0);
      machine = `<div class="row-item"><div class="grow"><b>Candle Machine</b><p class="muted">Turns Beeswax from your Waxwings into Beeswax Candles. Someone has to load the wax and carry the candles out.</p></div>
        ${b ? buildingChip(b) : buildBtn('Build', 'buildMachine', {}, D.MACHINE.buildCost, 'machine', 0)}</div>`;
    } else {
      const m = s.machine;
      const mcap = f().machineCap(s);
      machine = `<div class="machine-status">
          <span>${goodImg('wax', 20)} Wax inside ${bar(() => S().machine.wax / f().machineCap(S()))} <b data-live="${L(() => S().machine.wax + '/' + mcap)}"></b></span>
          <span>${goodImg('candle', 20)} Candles ready ${bar(() => S().machine.candles / f().machineCap(S()), 'honey')} <b data-live="${L(() => S().machine.candles + '/' + mcap)}"></b></span>
          <span class="muted small">Level ${m.level + 1} · one candle every ${D.MACHINE.secsPerCandle(m.level).toFixed(1)}s · <span data-live="${L(() => fmt(S().store.wax || 0))}"></span> wax in the storehouse</span>
        </div>
        <div class="btn-row">${btn('Tend the machine', 'tendMachine', {}, { cls: 'btn-sm' })}
          ${m.level < D.MACHINE.maxLevel ? buildBuildMachineUp(s) : '<span class="chip">Max level</span>'}</div>`;
    }

    // Shelves
    const shelves = s.shelves.map((sh, i) => {
      const g = sh.good && D.good[sh.good];
      return `<button class="shelf-tile" data-act="shelf" data-i="${i}">
        <span class="shelf-num">${i + 1}</span>
        ${g ? goodImg(g.id, 24) : '<span class="shelf-empty">empty</span>'}
        <span class="grow shelf-info">
          <b>${g ? g.name : 'Choose a product'}</b>
          ${g ? `<span class="muted">₵${fmt(f().price(s, g.id))} each · <span data-live="${L(() => sh.qty + '/' + cap)}"></span> on shelf · <span data-live="${L(() => fmt(S().store[sh.good] || 0))}"></span> in store</span>` : '<span class="muted">Tap to choose what this shelf sells</span>'}
        </span>
      </button>`;
    }).join('');

    // Storehouse
    const storeCap = f().storageCap(s);
    const store = D.GOODS.filter((g) => s.unlockedGoods[g.id]).map((g) => `
      <div class="store-item" title="${g.name}">
        ${goodImg(g.id, 24)}
        <span class="store-qty" data-live="${L(() => fmt(S().store[g.id] || 0))}"></span>
        <span class="bar"><i data-width="${L(() => Math.min(1, (S().store[g.id] || 0) / storeCap))}"></i></span>
      </div>`).join('');

    // Upgrades
    const ups = D.UPGRADES.map((u) => {
      const lv = s.up[u.id];
      const maxed = lv >= u.max;
      return `<div class="row-item">
        <div class="grow"><b>${u.name}</b> <span class="chip">${maxed ? 'Max' : 'Lv ' + lv}</span><p class="muted">${u.desc(lv)}</p></div>
        ${maxed ? '' : buildBtn('', 'upgrade', { id: u.id }, f().upgradeCost(s, u.id), 'upgrade', u.id)}
      </div>`;
    }).join('');

    return `
      <section class="win" id="staff">
        <div class="win-head"><h2>Staff</h2><span class="muted">${wages ? `Tomorrow's wages about ₵<b data-live="${L(() => fmt(f().wagesDue(S())))}"></b>` : 'No helpers yet'}</span></div>
        <p class="muted small">Train helpers with coins to make them faster or let them carry more (instant, no builder needed). Give everyone a duty and they get on with it by themselves, even while you're away. Two people on the Register ring customers up faster. Each helper is paid a base wage every morning <b>plus ${Math.round(D.WAGE_SHARE * 100)}% of what the shop earned the day before</b>, so keep enough coins aside: if you can't pay, someone quits.</p>
        <div class="pills">${cover}</div>
        ${noRegister ? '<p class="warn small">Nobody is on the Register: customers will wait in line and may walk out.</p>' : ''}
        <div class="list">${staff}</div>
      </section>
      <section class="win" id="machine">
        <div class="win-head"><h2>Candle Machine</h2></div>
        ${machine}
      </section>
      <section class="win">
        <div class="win-head"><h2>Shelves</h2>${btn('Restock now', 'restockNow', {}, { cls: 'btn-sm btn-ghost' })}</div>
        <p class="muted small">Goods have to be carried from the storehouse to the shelves. Customers buy what's on display.</p>
        <div class="stack">${shelves}</div>
        <p class="muted small">Reputation <b data-live="${L(() => S().rep.toFixed(2))}"></b>/5 · a customer every <b data-live="${L(() => f().spawnInterval(S()).toFixed(1) + 's')}"></b> while open · prices ×${f().priceMult(s).toFixed(2)} · <b data-live="${L(() => fmt(S().stats.walkouts))}"></b> walked out of a slow line</p>
      </section>
      <section class="win" id="storehouse">
        <div class="win-head"><h2>Storehouse</h2><span class="muted">Holds ${fmt(storeCap)} of each product</span></div>
        <div class="store-grid">${store}</div>
      </section>
      <section class="win">
        <div class="win-head"><h2>Upgrades</h2><span class="muted">1 builder</span></div>
        <p class="muted small">Upgrades take time to build. Your builder works on one thing at a time, so choose what to build next carefully. Gems finish a build instantly.</p>
        <div class="list">${ups}</div>
      </section>`;
  };
  function buildBuildMachineUp(s) {
    return buildBtn('Upgrade', 'upgradeMachine', {}, f().machineUpgradeCost(s), 'machineUp', 0);
  }

  // ---- NURSERY --------------------------------------------------------------
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
      const secsLeft = () => (S().nursery[i] ? S().nursery[i].dur - S().nursery[i].t : 0);
      return `<article class="card cradle ${n.ready ? 'ready' : ''}">
        <div class="parents">${parents}</div>
        <div class="grow">
          <h3>Cradle ${i + 1}</h3>
          ${n.ready ? '<p><b>The egg is ready to hatch!</b></p>' : `<p class="muted">Hatching in <span data-live="${L(() => util.fmtTime(secsLeft()))}"></span>. The parents are resting and not making honey.</p>
          ${bar(() => (S().nursery[i] ? S().nursery[i].t / S().nursery[i].dur : 1), 'big')}`}
        </div>
        ${n.ready ? btn('Hatch!', 'hatch', { slot: i }, { cls: 'btn-go' })
          : `<div class="order-actions"><button class="btn btn-sm btn-gem" data-act="skipEgg" data-slot="${i}" data-need="Not enough gems." data-afford="${L(() => S().gems >= f().gemsToSkip(secsLeft()))}">Finish ${gem()}<span data-live="${L(() => f().gemsToSkip(secsLeft()))}"></span></button>${btn('Cancel', 'cancelBreed', { slot: i }, { cls: 'btn-sm btn-ghost' })}</div>`}
      </article>`;
    }).join('');
    const known = D.RECIPES.filter((r) => s.discovered[r.out]).map((r) => `
      <div class="recipe">${beeImg(r.a, false, 24)}<span>+</span>${beeImg(r.b, false, 24)}<span>→</span>${beeImg(r.out, false, 24)}
        <span class="muted">${D.species[r.out].name} · ${Math.round(r.p * 100)}%</span></div>`).join('');
    const unknown = D.RECIPES.filter((r) => !s.discovered[r.out]).length;
    return `
      <section class="win">
        <div class="win-head"><h2>Nursery</h2><span class="muted">Parents rest while they raise an egg</span></div>
        <div class="stack">${slots}</div>
        <p class="muted small">Eggs from two different species can hatch into a new kind of bee. Same-species pairs pass on their vigor, often a little stronger. Rarely, an egg hatches with a sparkle: double output and a rose-gold coat.</p>
      </section>
      <section class="win">
        <div class="win-head"><h2>Recipe book</h2><span class="muted">${D.RECIPES.length - unknown}/${D.RECIPES.length} found</span></div>
        <div class="recipes">${known || '<p class="muted">No recipes yet. Try pairing a Meadow Bee with a Clover Bee.</p>'}</div>
        ${unknown ? `<p class="muted small">${unknown} more to find. The Field Guide has hints.</p>` : ''}
      </section>`;
  };

  // ---- TOWN -----------------------------------------------------------------
  panels.town = function () {
    const s = S();
    const orders = s.orders.map((o) => {
      const g = D.good[o.good];
      return `<article class="card order">
        ${goodImg(o.good, 32)}
        <div class="grow">
          <h3>${esc(o.who)}</h3>
          <p>Wants <b>${o.qty} × ${g.name}</b></p>
          <p class="muted">Have <span data-live="${L(() => fmt(S().store[o.good] || 0))}"></span> in the storehouse · expires in <span data-live="${L(() => { const x = S().orders.find((y) => y.id === o.id); return x ? util.fmtTime(x.left) : '—'; })}"></span></p>
        </div>
        <div class="order-actions">
          <button class="btn" data-act="deliver" data-id="${o.id}" data-need="Not enough ${g.name} in the storehouse yet." data-afford="${L(() => (S().store[o.good] || 0) >= o.qty)}">Deliver ${price(o.reward)}${o.gems ? ' ' + gemPrice(o.gems) : ''}</button>
          <button class="link" data-act="dismiss" data-id="${o.id}">Decline</button>
        </div>
      </article>`;
    }).join('');
    const ribbons = f().festivalRibbons(s);
    const progress = Math.min(1, s.runEarned / D.FESTIVAL_AT);
    return `
      <section class="win">
        <div class="win-head"><h2>Request board</h2><span class="muted">Townsfolk pin new requests outside every few minutes</span></div>
        <div class="stack">${orders || '<p class="muted empty-note">No requests pinned right now. Watch for someone walking up to the board outside the shop.</p>'}</div>
      </section>
      ${s.merchant ? `<section class="win"><div class="win-head"><h2>On the street</h2></div>${merchantCard()}</section>` : ''}
      ${regularsSection(s)}
      <section class="win festival">
        <div class="win-head"><h2>Honey Festival</h2>${s.ribbons ? `<span class="muted">${s.ribbons} ribbons · +${s.ribbons * 10}% prices</span>` : ''}</div>
        <p>Once the shop has earned ₵${fmt(D.FESTIVAL_AT)} since the last festival, the town will throw you a Honey Festival. You start over with a fresh garden and keep your Field Guide, cosmetics, gems, ribbons and one keepsake bee. Every ribbon raises sale prices by 10% for good, and the festival pays ${D.GEMS.festival} gems.</p>
        ${bar(() => Math.min(1, S().runEarned / D.FESTIVAL_AT), 'big')}
        <p class="muted small">₵<span data-live="${L(() => fmt(S().runEarned))}"></span> of ₵${fmt(D.FESTIVAL_AT)}${ribbons ? ` · the festival would award <b>${ribbons}</b> ribbons` : ''}</p>
        ${progress >= 1 ? btn('Plan the festival', 'festival', {}, { cls: 'btn-go' }) : ''}
      </section>`;
  };

  // The town's regulars: who they are, their favourite, and friendship hearts.
  // Regulars you haven't met yet show as a silhouette with a hint.
  function regularsSection(s) {
    const rows = D.REGULARS.map((r) => {
      const st = (s.regulars || {})[r.id];
      const met = st && st.visits > 0;
      const hearts = met ? '♥'.repeat(st.hearts) + '♡'.repeat(5 - st.hearts) : '';
      const fav = D.good[r.fav];
      const next = met && st.hearts < 5 ? Object.keys(D.REGULAR_GIFTS).map(Number).find((h) => h > st.hearts) : null;
      return `<div class="row-item ${met ? '' : 'locked'}">
        <img class="px person ${met ? '' : 'mystery'}" src="${spr.personURL(r.look)}" alt="" width="32" height="40">
        <div class="grow"><b>${met ? r.name : '???'}</b> ${met ? `<span class="hearts" title="${st.hearts} of 5 hearts">${hearts}</span>` : ''}
          <p class="muted">${met ? esc(r.blurb) : s.unlockedGoods[r.fav] ? 'Word is getting around. They might drop in any day now.' : `Might visit once you make ${fav.name}.`}</p>
          ${met ? `<p class="small">Loves ${goodImg(r.fav, 14)} <b>${fav.name}</b>${next ? ` · gift at ${next} hearts` : st.hearts >= 5 ? ' · best friends!' : ''}</p>` : ''}
        </div>
      </div>`;
    }).join('');
    return `<section class="win"><div class="win-head"><h2>Regulars</h2><span class="muted">Keep their favourite on the shelves</span></div>
      <p class="muted small">Regulars come back again and again. If their favourite is on a shelf they buy it, leave a 25% tip and grow fonder of the shop (one heart a day). At 3 hearts they bring a thank-you gift; at 5, a rare gem gift.</p>
      <div class="list">${rows}</div></section>`;
  }

  // ---- STORE ----------------------------------------------------------------
  panels.store = function () {
    const s = S();
    const look = spr.keeperLook(s);
    const sections = D.STORE_SECTIONS.map((sec) => {
      const items = D.CATALOG.filter((it) => it.cat === sec.cat).map((it) => storeCard(s, it, sec)).join('');
      const note = sec.cat === 'seasonal' ? ` <span class="muted small">(each is only sold in its own season, and the set changes every year; you keep what you buy: ${esc(f().season(s).name)} of year ${f().year(s) + 1} now)</span>` : sec.cat === 'hiveStyle' ? ' <span class="muted small">(“Use” restyles every hive; to style one hive, tap Style on it in the Apiary tab)</span>' : sec.pick ? '' : ' <span class="muted small">(place as many as you like)</span>';
      return `<h3 class="store-sec">${sec.name}${note}</h3><div class="store-cards">${items}</div>`;
    }).join('');
    return `
      <section class="win">
        <div class="win-head"><h2>Store</h2><span class="muted">${gem()} ${fmt(s.gems)} gems</span></div>
        <div class="store-top">
          <img class="px keeper-preview" src="${spr.personURL(look)}" alt="Your shopkeeper" width="64" height="80">
          <div class="grow">
            <p>Dress up your shopkeeper, decorate the shop and garden, and restyle your hives. Many decorations come with a small bonus.</p>
            <p class="muted small">Gems come from goals, requests, new species, festivals, season changes and golden drips.</p>
          </div>
        </div>
        <!-- A second builder is planned as a paid unlock in the full game, so
             here it's shown locked rather than sold for gems. -->
        <div class="row-item locked">
          <div class="grow"><b>Second builder</b><p class="muted">Build two things at once. Coming as an optional purchase in the full version of the game.</p></div>
          <span class="chip">🔒 Full version</span>
        </div>
      </section>
      <section class="win store">${sections}</section>`;
  };

  // One item card in the Store.
  function storeCard(s, it, sec) {
    const owned = !!s.cos.owned[it.id];
    const inUse = sec.pick ? s.cos.equip[it.cat] === it.id : !!s.cos.placed[it.id];
    let action;
    const offSeason = it.season && !f().inSeason(s, it);
    if (!owned && offSeason) {
      // Seasonal specials can only be bought in their own season (and year).
      const sameSeasonNow = f().season(s).id === it.season;
      action = `<span class="chip">${sameSeasonNow ? 'Back next year' : 'Only in ' + D.SEASONS.find((x) => x.id === it.season).name}</span>`;
    } else if (!owned) {
      const c = it.cost || {};
      action = c.gems ? btn(`Buy ${gemPrice(c.gems)}`, 'buyItem', { id: it.id }, { gems: c.gems, cls: 'btn-sm btn-gem', need: 'Not enough gems.' })
        : btn(`Buy ${price(c.coins || 0)}`, 'buyItem', { id: it.id }, { cost: c.coins || 0, cls: 'btn-sm' });
    } else if (sec.pick) {
      action = inUse ? '<span class="chip chip-on">Using</span>' : btn('Use', 'useItem', { id: it.id }, { cls: 'btn-sm btn-ghost' });
    } else {
      action = btn(inUse ? 'Put away' : 'Place', 'useItem', { id: it.id }, { cls: 'btn-sm btn-ghost' });
    }
    const bonus = it.bonus ? Object.entries(it.bonus).map(([k, v]) => '+' + Math.round(v * 100) + '% ' + { customers: 'customers', prod: 'honey', rep: 'reputation gain' }[k]).join(', ') : '';
    return `<div class="store-card ${inUse ? 'in-use' : ''}">
      <div class="store-thumb">${storeThumb(s, it)}</div>
      <b>${it.name}</b>
      ${bonus ? `<span class="muted small">${bonus}</span>` : ''}
      ${action}
    </div>`;
  }
  // A little preview picture for each kind of Store item.
  function storeThumb(s, it) {
    const look = spr.keeperLook(s);
    if (it.cat === 'hat') return `<img class="px" src="${spr.personURL(Object.assign({}, look, { hat: it.value }))}" alt="" width="32" height="40">`;
    if (it.cat === 'hair') return `<img class="px" src="${spr.personURL(Object.assign({}, look, { hair: it.colors, hat: null }))}" alt="" width="32" height="40">`;
    if (it.cat === 'shirt') return `<img class="px" src="${spr.personURL(Object.assign({}, look, { shirt: it.colors }))}" alt="" width="32" height="40">`;
    if (it.cat === 'apron') return `<img class="px" src="${spr.personURL(Object.assign({}, look, { apron: it.colors[0] }))}" alt="" width="32" height="40">`;
    if (it.cat === 'hiveStyle') return `<img class="px" src="${spr.hiveURL(3, it.id)}" alt="" width="27" height="48">`;
    const sw = {
      'wall-planks': ['#b86a32', '#9a5626'], 'wall-honeycomb': ['#f2c050', '#e0a838'], 'wall-stripes': ['#e4f4e8', '#a8dcc0'], 'wall-rose': ['#f4d4dc', '#d890a4'],
      'floor-checker': ['#f2dfb4', '#e6cc98'], 'floor-wood': ['#c8945a', '#a0703e'], 'floor-tiles': ['#cfe4f0', '#f4f8fb'],
    }[it.id];
    if (sw) return `<span class="swatch" style="background: repeating-linear-gradient(90deg, ${sw[0]} 0 6px, ${sw[1]} 6px 12px)"></span>`;
    const th = HC.render.decorThumb(it.id);
    if (!th) return '';
    const scale = Math.min(2, 44 / Math.max(th.w, th.h));
    return `<img class="px" src="${th.url}" alt="" width="${Math.round(th.w * scale)}" height="${Math.round(th.h * scale)}">`;
  }

  // ---- GUIDE ----------------------------------------------------------------
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
          ${stat('Honey collected', fmt(st.collected))}
          ${stat('Candles made', fmt(st.candles))}
          ${stat('Customers served', fmt(st.customers))}
          ${stat('Items sold', fmt(st.sold))}
          ${stat('Walked out of the line', fmt(st.walkouts))}
          ${stat('Left empty-handed', fmt(st.disappointed))}
          ${stat('Biggest sale', '₵' + fmt(st.best))}
          ${stat('Eggs hatched', fmt(st.bred))}
          ${stat('Requests filled', fmt(st.orders))}
          ${stat('Timers finished with gems', fmt(st.skips))}
          ${stat('Festivals held', fmt(s.festivals))}
          ${stat('Time in the shop', util.fmtTime(s.playTime))}
        </div>
      </section>`;
  };

  // ---- MENU (opened with the ⚙ button) -------------------------------------
  panels.menu = function () {
    const s = S();
    const tog = (key, label) => `<label class="toggle"><input type="checkbox" id="set-${key}" data-act="setting" data-key="${key}" ${s.settings[key] ? 'checked' : ''}> <span>${label}</span></label>`;
    return `
      <section class="win">
        <div class="win-head"><h2>Settings</h2>${btn('Back to the game', 'tab', { tab: 'apiary' }, { cls: 'btn-sm btn-ghost' })}</div>
        <div class="stack">${tog('sfx', 'Sound effects')}${tog('music', 'Music')}${tog('guide', 'Guided goals (flash the next thing to tap for the first goals)')}</div>
      </section>
      <section class="win">
        <div class="win-head"><h2>Save</h2><span class="muted">Saves automatically every few seconds on this device</span></div>
        <div class="btn-row">${btn('Save now', 'save')}${btn('Export save', 'export')}${btn('Import save', 'import')}</div>
        <div id="saveArea"></div>
      </section>
      <section class="win">
        <div class="win-head"><h2>About</h2></div>
        <p>Honeycomb Corner is a prototype idle game about a honey shop in a small town. Bees fill their hives, you carry the honey in, and townsfolk buy it. Staff keep things running while you're away (for up to 8 hours).</p>
        <p class="muted small">All art, music and characters are original and drawn in code. Tip: ${esc(util.pick(D.TIPS))}</p>
        <div class="btn-row">${btn('Send feedback', 'feedback', {}, { cls: 'btn-go' })}${btn('Replay tutorial', 'tutorial', {}, { cls: 'btn-ghost' })}${btn('Start over', 'reset', {}, { cls: 'btn-danger' })}</div>
      </section>`;
  };

  // ---------------------------------------------------------------------------
  // POP-UP WINDOWS
  // ---------------------------------------------------------------------------
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
    const resting = f().busyBees(s).has(bee.id);
    const rate = hi >= 0 ? f().beeRate(s, bee, s.hives[hi], f().isNight(s)) : (1 / sp.secs) * bee.vigor * (bee.sparkle ? 2 : 1);
    const trait = bee.trait && D.TRAITS[bee.trait];
    return `<div class="stats">
      <div class="stat-row"><span>Makes</span><b>${goodImg(sp.good)} ${D.good[sp.good].name}</b></div>
      <div class="stat-row"><span>Output</span><b>${resting ? 'Resting in the nursery' : (rate * 60).toFixed(1) + '/min' + (hi < 0 ? ' (in the bee box)' : '')}</b></div>
      <div class="stat-row"><span>Vigor</span><b>${util.pct(bee.vigor)}</b></div>
      <div class="stat-row"><span>Trait</span><b>${trait ? trait.name + ' · <span class="muted">' + trait.desc + '</span>' : '—'}</b></div>
      ${sp.aura ? `<div class="stat-row"><span>Special</span><b>${sp.aura.hive ? '+' + sp.aura.hive * 100 + '% hive output' : '+' + sp.aura.customers * 100 + '% customers'}</b></div>` : ''}
      ${sp.nightBonus ? `<div class="stat-row"><span>Special</span><b>+${sp.nightBonus * 100}% at night</b></div>` : ''}
      ${sp.season ? `<div class="stat-row"><span>Special</span><b>+80% in ${D.SEASONS.find((x) => x.id === sp.season).name}</b></div>` : ''}
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
          requestAnimationFrame(() => $('#market')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          return true;
        }
      },
    });
  }

  // Pick a look for one hive from the hive styles you own (playtest 3).
  function hiveStyleModal(i) {
    openModal({
      render: () => {
        const s = S();
        const h = s.hives[i];
        const owned = D.CATALOG.filter((it) => it.cat === 'hiveStyle' && s.cos.owned[it.id]);
        const current = h.style || null;
        const cells = [`<button class="pick-row ${!current ? 'selected' : ''}" data-act="pickHiveStyle" data-id=""><img class="px" src="${spr.hiveURL(h.level, s.cos.equip.hiveStyle)}" alt="" width="27" height="48"><b>Same as the rest</b></button>`]
          .concat(owned.map((it) => `<button class="pick-row ${current === it.id ? 'selected' : ''}" data-act="pickHiveStyle" data-id="${it.id}"><img class="px" src="${spr.hiveURL(h.level, it.id)}" alt="" width="27" height="48"><b>${it.name}</b></button>`));
        const more = D.CATALOG.filter((it) => it.cat === 'hiveStyle' && !s.cos.owned[it.id]).length;
        return `<h2>Hive ${i + 1}: style</h2><p class="muted">Give this hive its own look. ${more ? 'More styles are in the Store.' : ''}</p>
          <div class="style-pick">${cells.join('')}</div>
          <div class="btn-row end">${btn('Close', 'closeModal', {}, { cls: 'btn-ghost' })}</div>`;
      },
      onAct: (act, ds) => {
        if (act === 'pickHiveStyle') {
          const r = HC.act.setHiveStyle(i, ds.id || null);
          closeModal();
          if (r.ok) toast(r.msg);
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
        const rows = D.GOODS.filter((g) => s.unlockedGoods[g.id] && !g.raw).reverse().map((g) => `
          <button class="pick-row ${sh.good === g.id ? 'selected' : ''}" data-act="pickGood" data-good="${g.id}">
            ${goodImg(g.id, 24)}
            <span class="grow"><b>${g.name}</b><span class="muted">₵${fmt(f().price(s, g.id))} each · ${fmt(s.store[g.id] || 0)} in store${onOther.has(g.id) ? ' · also on another shelf' : ''}</span></span>
          </button>`).join('');
        return `<h2>Shelf ${i + 1}</h2><p class="muted">Pick what this shelf sells. Pricier goods need richer customers, and they come with reputation. Someone has to carry the stock over from the storehouse.</p>
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
        const busy = f().busyBees(s);
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
        let preview = '<p class="muted">Choose two bees. They will rest (and stop making honey) until the egg hatches.</p>';
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
            <div class="grow"><p>${outcome}</p><p class="muted">Takes ${util.fmtTime(f().breedTime(a, b))} · costs ₵${fmt(cost)} · both parents rest meanwhile</p></div></div>`;
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
          <div class="stat-row"><span>${D.good[sp.good].raw ? 'Becomes' : 'Sells for'}</span><b>${D.good[sp.good].raw ? 'Candles, in the Candle Machine' : '₵' + fmt(f().price(s, sp.good)) + ' each'}</b></div>
          ${recipesIn.map((r) => `<div class="stat-row"><span>Bred from</span><b>${D.species[r.a].name} + ${D.species[r.b].name}</b></div>`).join('')}
          ${usedIn.map((r) => `<div class="stat-row"><span>Parent of</span><b>${D.species[r.out].name}</b></div>`).join('')}
        </div>` : ''}
        <div class="btn-row end">${btn('Close', 'closeModal')}</div>`,
    });
  }

  function newBeeModal(evt) {
    const { bee, isNew, newSparkle } = evt;
    const sp = D.species[bee.sp];
    const good = D.good[sp.good];
    HC.audio.play(isNew || newSparkle ? 'discover' : 'hatch');
    openModal({
      render: () => `
        <div class="reveal ${bee.sparkle ? 'is-sparkle' : ''}">
          <p class="eyebrow">${isNew ? 'New species!' : newSparkle ? 'A sparkle!' : evt.source === 'merchant' ? 'Welcome aboard' : 'An egg hatched'}</p>
          ${beeImg(bee.sp, bee.sparkle, 128, 'pop')}
          <h2>${esc(bee.name)} the ${sp.name}</h2>
          <p>${rarityChip(sp.rarity)} ${bee.sparkle ? '<span class="chip chip-sparkle">Sparkle</span>' : ''} vigor ${util.pct(bee.vigor)}${bee.trait ? ' · ' + D.TRAITS[bee.trait].name : ''}</p>
          ${isNew ? `<p class="muted">${sp.flavor}</p><p>${good.raw ? `Makes <b>${good.name}</b>, which the Candle Machine turns into candles.` : `Makes <b>${good.name}</b>, sold at ₵${fmt(f().price(S(), sp.good))} each.`}${D.GEMS.newSpecies[sp.rarity] ? ` A ${sp.rarity.toLowerCase()} find: you earned ${gemPrice(D.GEMS.newSpecies[sp.rarity])}!` : ''}</p>` : ''}
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

  // "While you were away" report after returning to the game.
  function offlineModal(r) {
    const made = Object.entries(r.made).filter(([, n]) => n > 0).map(([g, n]) => `<span class="pill">${goodImg(g)} +${fmt(n)}</span>`).join('');
    const notes = [
      r.fullHives.length ? `<b>${r.fullHives.length === 1 ? 'Hive ' + (r.fullHives[0] + 1) + ' is' : r.fullHives.length + ' hives are'} full</b>, and the bees are waiting. Tap a hive to collect.` : '',
      r.eggs ? `${r.eggs === 1 ? 'An egg is' : r.eggs + ' eggs are'} ready to hatch in the Nursery.` : '',
      r.newOrders ? `${r.newOrders} new ${r.newOrders === 1 ? 'request is' : 'requests are'} pinned on the board.` : '',
      r.merchant ? 'A travelling merchant is parked outside.' : '',
      r.season ? `${r.season.name} has arrived. ${r.season.desc}` : '',
    ].filter(Boolean).map((t) => `<p>• ${t}</p>`).join('');
    openModal({
      render: () => `
        <p class="eyebrow">Welcome back</p>
        <h2>While you were away (${util.fmtTime(r.seconds)})</h2>
        <div class="stats">
          <div class="stat-row"><span>Coins earned</span><b>${coin()} ${fmt(r.coins)}</b></div>
          <div class="stat-row"><span>Items sold</span><b>${fmt(r.sold)}</b></div>
          ${r.collected ? `<div class="stat-row"><span>Honey your collector brought in</span><b>${fmt(r.collected)}</b></div>` : ''}
          ${r.gems ? `<div class="stat-row"><span>Gems</span><b>${gem()} +${r.gems}</b></div>` : ''}
        </div>
        ${made ? `<p class="muted">Storehouse changes:</p><div class="pills">${made}</div>` : ''}
        ${notes}
        <p class="muted small">While you're gone the shopkeeper minds the register and shelves, but honey only comes in from the hives if someone is on the Collect honey duty. Customers stay home at night, and most bees sleep.</p>
        <div class="btn-row end">${btn('Open the shop', 'closeModal', {}, { cls: 'btn-go' })}</div>`,
    });
  }

  // The Reputation window: what reputation does, every rule that changes it
  // (from REP in data.js), and today's and yesterday's changes by reason.
  function repModal() {
    openModal({
      render: () => {
        const s = S();
        const fmtAmt = (a) => (a >= 0 ? '+' : '−') + Math.abs(a).toFixed(2);
        const logRows = (log) => {
          if (!log || !Object.keys(log.items).length) return '<p class="muted small">No changes yet.</p>';
          return '<div class="stats">' + Object.entries(log.items).sort((a, b) => Math.abs(b[1].amt) - Math.abs(a[1].amt)).map(([k, v]) =>
            `<div class="stat-row"><span>${esc(D.REP[k] ? D.REP[k].text : k)} <span class="muted">×${v.n}</span></span><b class="${v.amt >= 0 ? 'up' : 'down'}">${fmtAmt(v.amt)}</b></div>`).join('') + '</div>';
        };
        const rules = Object.entries(D.REP).filter(([k]) => k !== 'away').map(([k, r]) =>
          `<div class="stat-row"><span>${esc(r.text)}</span><b class="${r.good ? 'up' : 'down'}">${fmtAmt(r.amt)}${k === 'served' ? '*' : ''}</b></div>`).join('');
        const decor = f().decorBonus(s, 'rep');
        return `<h2>Reputation ${starsHtml()} ${s.rep.toFixed(2)}/5</h2>
          <p><b>What it does:</b> more reputation means customers come more often (right now one every <b>${f().spawnInterval(s).toFixed(1)}s</b> while open), and more rich Nobles and Collectors, who buy your priciest goods.</p>
          <h3 class="sub">Today (day ${f().day(s)})</h3>
          ${logRows(s.repLog && s.repLog.day === f().day(s) ? s.repLog : null)}
          ${s.repPrev ? `<h3 class="sub">Day ${s.repPrev.day}</h3>${logRows(s.repPrev)}` : ''}
          <h3 class="sub">How it changes</h3>
          <div class="stats">${rules}</div>
          <p class="muted small">* A happy customer counts for less the closer you are to 5 stars${decor ? `, and your decorations add +${Math.round(decor * 100)}%` : '. Decorations like String Lights make it count for more'}. Watch the scene: a smiley face with a + floats up when a customer leaves happy, and a frowny face with a − when reputation drops.</p>
          <div class="btn-row end">${btn('Close', 'closeModal', {}, { cls: 'btn-go' })}</div>`;
      },
    });
  }

  // ---------------------------------------------------------------------------
  // SEND FEEDBACK (playtest builds)
  // A short form plus the playtest notes from track.js, shown to the player
  // before sending. On the public playtest site (hosted on Netlify) it's
  // sent to Netlify Forms, where the developer reads it. Anywhere else (the
  // Claude preview, a local file) it can't be sent, so it offers to copy
  // everything instead, to paste into a message.
  // ---------------------------------------------------------------------------
  const canSubmit = () => /\.netlify\.app$/.test(location.hostname) || !!document.querySelector('meta[name="feedback-endpoint"]');
  function feedbackModal() {
    const stats = HC.track ? HC.track.summary() : {};
    let sent = false;
    openModal({
      render: () => sent ? `<h2>Thank you!</h2><p>Your feedback was sent. It really helps shape the game.</p><div class="btn-row end">${btn('Back to the shop', 'closeModal', {}, { cls: 'btn-go' })}</div>` : `
        <h2>Send feedback</h2>
        <p class="muted">Thanks for playtesting Honeycomb Corner! A few quick questions (all optional):</p>
        <form class="feedback" data-form="feedback">
          <label>What did you enjoy?<textarea name="enjoyed" rows="2"></textarea></label>
          <label>When (if ever) did it get boring or feel slow?<textarea name="bored" rows="2"></textarea></label>
          <label>Anything confusing?<textarea name="confused" rows="2"></textarea></label>
          <fieldset><legend>Would you keep playing?</legend>
            ${['Definitely', 'Probably', 'Not sure', 'Probably not', 'No'].map((t) => `<label class="radio"><input type="radio" name="keepPlaying" value="${t}"> ${t}</label>`).join('')}
          </fieldset>
          <label>Your name (optional)<input name="name" maxlength="40"></label>
          <details><summary>What else gets sent (no personal info)</summary><pre class="fb-stats">${esc(JSON.stringify(stats, null, 1))}</pre></details>
          <div class="btn-row end">${btn('Not now', 'closeModal', {}, { cls: 'btn-ghost' })}<button class="btn btn-go" type="submit">${canSubmit() ? 'Send' : 'Copy to send'}</button></div>
        </form>`,
      onSubmit: (form) => {
        const data = Object.fromEntries(new FormData(form).entries());
        data.stats = JSON.stringify(stats);
        if (!canSubmit()) {
          // Not on the playtest site: copy everything so it can be pasted.
          const text = Object.entries(data).map(([k, v]) => k + ': ' + v).join('\n');
          const done = () => toast('Copied! Paste it into a message to the developer.', 'good');
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => toast('Could not copy automatically.', 'bad'));
          return;
        }
        const body = new URLSearchParams(Object.assign({ 'form-name': 'playtest-feedback' }, data)).toString();
        fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
          .then((r) => {
            if (!r.ok) throw new Error(r.status);
            sent = true;
            if (HC.track) HC.track.notes().feedbackSent++;
            renderModal();
          })
          .catch(() => toast('Could not send just now. Please try again in a moment.', 'bad'));
      },
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
          <p>The whole town turns out. You earn <b>${gain} ribbons</b> (+${gain * 10}% sale prices, for good) and ${gemPrice(D.GEMS.festival)}.</p>
          <p class="muted">You start over with a fresh garden, and keep the Field Guide, cosmetics, gems and ribbons. Pick one keepsake bee to bring along:</p>
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

  // ---------------------------------------------------------------------------
  // LIVE VALUES: refresh everything marked data-live / data-html / data-width /
  // data-afford inside `root` (the whole page by default).
  // ---------------------------------------------------------------------------
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
        /* the thing this value described is gone; the next redraw replaces it */
      }
    });
  }

  // Full redraw of the status bar, strip and the open tab.
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

  // Little red dots on tabs that need attention.
  function updateBadges() {
    const s = S();
    const badge = (t, on) => el.tabs.querySelector(`[data-tab="${t}"]`)?.classList.toggle('badge', !!on);
    badge('nursery', s.nursery.some((n) => n && n.ready));
    badge('town', s.orders.some((o) => (s.store[o.good] || 0) >= o.qty) || f().festivalRibbons(s) > 0);
    badge('apiary', !!s.merchant || s.hives.some((h) => f().hiveFull(h)));
  }

  function setTab(t) {
    tab = t;
    dirty = true;
    render();
    el.panel.scrollTop = 0;
  }

  // ---------------------------------------------------------------------------
  // BUTTON PRESSES: data-act="name" → what happens
  // ---------------------------------------------------------------------------
  function handleAct(act, ds) {
    const s = S();
    HC.audio.unlock();
    if (modal && modal.onAct && modal.onAct(act, ds)) return; // the pop-up handled it
    let r;
    switch (act) {
      case 'tab': return setTab(ds.tab);
      case 'closeModal': return closeModal();
      case 'buyBee': r = HC.act.buyBee(ds.sp); break;
      case 'buildHive': r = HC.act.buildHive(); break;
      case 'upgradeHive': r = HC.act.upgradeHive(Number(ds.i)); break;
      case 'upgrade': r = HC.act.buyUpgrade(ds.id); break;
      case 'buildMachine': r = HC.act.buildMachine(); break;
      case 'upgradeMachine': r = HC.act.upgradeMachine(); break;
      case 'tendMachine': r = HC.act.tendMachine(); break;
      case 'skipBuild': r = HC.act.skipBuild(ds.id); break;
      case 'setDuty': r = HC.act.setDuty(ds.who, ds.duty); break;
      case 'train': r = HC.act.train(ds.id, ds.track); break;
      case 'rep': return repModal();
      case 'feedback': return feedbackModal();
      case 'collect': r = HC.act.collect(Number(ds.i)); break;
      case 'collectAll': r = HC.act.collectAll(); break;
      case 'restockNow': r = HC.act.restockNow(); break;
      case 'cancelErrands': r = HC.act.cancelErrands(); break;
      case 'hire': r = HC.act.hire(ds.id); break;
      case 'fire':
        return confirmModal('Let ' + D.staff[ds.id].name + ' go?', 'They leave right away and the hiring fee is not refunded.', 'Let them go', () => {
          const res = HC.act.fire(ds.id);
          if (res.ok) toast(res.msg);
        }, true);
      case 'buyItem': r = HC.act.buyItem(ds.id); break;
      case 'useItem': r = HC.act.useItem(ds.id); break;
      case 'bee': return beeModal(ds.id);
      case 'addToHive': return addToHiveModal(Number(ds.i));
      case 'shelf': return shelfModal(Number(ds.i));
      case 'hiveStyle': return hiveStyleModal(Number(ds.i));
      case 'breed': return breedModal(Number(ds.slot));
      case 'hatch': r = HC.act.hatch(Number(ds.slot)); break;
      case 'skipEgg': r = HC.act.skipEgg(Number(ds.slot)); break;
      case 'cancelBreed':
        return confirmModal('Cancel this egg?', 'The coins spent on it are not refunded. The parents go back to work.', 'Cancel egg', () => HC.act.cancelBreed(Number(ds.slot)), true);
      case 'deliver': r = HC.act.deliverOrder(ds.id); break;
      case 'dismiss': r = HC.act.dismissOrder(ds.id); break;
      case 'merchant': r = HC.act.buyMerchant(); break;
      case 'festival': return festivalModal();
      case 'guide': return guideModal(ds.sp);
      case 'claimGoal': r = HC.goals.claim(); break;
      case 'goalHint': {
        const g = HC.goals.current(s);
        if (g) say([g.sp && !s.discovered[g.sp] ? 'Field Guide hint: ' + D.species[g.sp].hint : g.tip || "Keep at it. You're on the right track."]);
        return;
      }
      case 'season': {
        const se = f().season(s);
        say([`${se.name}. ${se.desc} ${util.fmtTime(f().seasonLeft(s))} until the season turns.`]);
        return;
      }
      case 'sellExtras': {
        const plan = HC.act.sellExtras(true);
        if (!plan.count) return toast('Nothing to sell: the box only holds your best bee of each kind.');
        return confirmModal('Sell ' + plan.count + ' spare bees?', `Keeps your best bee of each species, any sparkles, and bees busy in the nursery. Earns ₵${fmt(plan.total)}.`, 'Sell them', () => {
          const res = HC.act.sellExtras();
          if (res.ok) toast(res.msg);
        });
      }
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

  // One click listener for the whole page.
  function onClick(e) {
    // Tapping somewhere other than the flashing guide target pauses the
    // dimming for a minute (the goal bar keeps showing what to do).
    if (spotEl && !spotEl.contains(e.target) && !e.target.closest('#goalbar, #textbox, #modal')) {
      guideSnoozedUntil = Date.now() + 60000;
      spotEl.classList.remove('spotlight');
      spotEl = null;
      document.body.classList.remove('guiding');
    }
    if (drag.suppressClick) {
      // This click is the end of a bee drag, not a tap.
      drag.suppressClick = false;
      e.preventDefault();
      return;
    }
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    if (t.type === 'checkbox') return; // handled by onChange
    e.preventDefault();
    if (t.classList.contains('cant') && t.dataset.afford) {
      // Wanted to skip a timer but couldn't afford it: a playtest signal.
      if ((t.dataset.act === 'skipBuild' || t.dataset.act === 'skipEgg') && HC.track) HC.track.gemStarved();
      // Greyed-out button: explain why and give it a little shake.
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

  // Tapping the game picture: work out what was tapped and react.
  function onCanvasTap(e) {
    HC.audio.unlock();
    const rect = el.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * HC.layout.W;
    const y = ((e.clientY - rect.top) / rect.height) * HC.layout.H;
    // (The tutorial text box now sits below the picture, so taps on the
    // picture always go to the scene.)
    const hit = HC.render.hitTest(S(), x, y);
    if (!hit) return;
    const s = S();
    if (hit.kind === 'drip') {
      const amt = HC.sim.claimDrip(s);
      if (amt) {
        HC.audio.play('discover');
        toast('Golden drip! +₵' + fmt(amt), 'good');
      }
      return;
    }
    HC.audio.play('click');
    if (hit.kind === 'hive') {
      // Honey waiting: send the shopkeeper. Otherwise show the hive card.
      if (f().honeyIn(s.hives[hit.index]) > 0) {
        const r = HC.act.collect(hit.index);
        if (r.ok) toast(r.msg);
        return;
      }
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
    else if (hit.kind === 'machine') {
      if (s.machine) {
        const r = HC.act.tendMachine();
        if (r.ok) toast(r.msg);
      } else {
        setTab('shop');
        requestAnimationFrame(() => $('#machine')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } else if (hit.kind === 'crates') {
      setTab('shop');
      requestAnimationFrame(() => $('#storehouse')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else if (hit.kind === 'board') setTab('town');
    else if (hit.kind === 'merchant') setTab('town');
    else if (hit.kind === 'worker') {
      const w = HC.workers.list.find((x) => x.role === hit.role);
      if (hit.role === 'keeper') say([util.pick(D.TIPS)]);
      else if (w) toast(D.staff[hit.role].name + ' (' + D.duty[HC.workers.dutyOf(s, w)].name + '): ' + HC.workers.statusOf(s, w));
    }
  }

  // ---------------------------------------------------------------------------
  // MOVING BEES BY DRAGGING (Apiary tab)
  // Press and hold a bee for about a third of a second: it lifts up and
  // follows your finger (or mouse). Let go over:
  //   - another hive's card  → the bee moves into that hive (if there's room)
  //   - another bee          → the two bees swap places
  //   - the Bee box section  → the bee goes into the box
  // Moving your finger straight away (before the hold) scrolls as normal, and
  // a quick tap still opens the bee's details.
  // ---------------------------------------------------------------------------
  const HOLD_MS = 350;
  const drag = { timer: null, active: false, id: null, tile: null, start: null, ghost: null, over: null, suppressClick: false };

  function onBeeDown(e) {
    if (tab !== 'apiary' || modal || (e.button != null && e.button !== 0)) return;
    const tile = e.target.closest('.bee-tile[data-act="bee"]');
    if (!tile || !el.panel.contains(tile)) return;
    drag.id = tile.dataset.id;
    drag.tile = tile;
    drag.start = { x: e.clientX, y: e.clientY };
    drag.timer = setTimeout(() => liftBee(drag.start.x, drag.start.y), HOLD_MS);
  }

  // The hold time passed: pick the bee up.
  function liftBee(x, y) {
    drag.timer = null;
    const bee = S().bees[drag.id];
    if (!bee) return endDrag();
    drag.active = true;
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'drag-ghost';
    drag.ghost.innerHTML = beeImg(bee.sp, bee.sparkle, 40) + `<span>${esc(bee.name)}</span>`;
    document.body.appendChild(drag.ghost);
    drag.tile.classList.add('dragging');
    document.body.classList.add('is-dragging');
    moveGhost(x, y);
    if (navigator.vibrate) navigator.vibrate(12); // a little buzz on phones that support it
    HC.audio.play('click');
  }

  function moveGhost(x, y) {
    drag.ghost.style.transform = `translate(${Math.round(x - 24)}px, ${Math.round(y - 30)}px)`;
    // Highlight whatever is under the finger.
    const t = dropTargetAt(x, y);
    const node = t && (t.tile || t.card);
    if (drag.over !== node) {
      if (drag.over) drag.over.classList.remove('drop-over');
      if (node) node.classList.add('drop-over');
      drag.over = node;
    }
    // Near the top or bottom of the screen: scroll so far-away hives are reachable.
    const edge = 70;
    const dy = y < edge ? -10 : y > window.innerHeight - edge ? 10 : 0;
    if (dy) {
      window.scrollBy(0, dy);
      el.panel.scrollBy(0, dy);
    }
  }

  // What's under the point (x, y): another bee, a hive card, or the bee box.
  function dropTargetAt(x, y) {
    const node = document.elementFromPoint(x, y); // the ghost ignores pointers, so this sees through it
    if (!node) return null;
    const tile = node.closest('.bee-tile[data-id]');
    if (tile && tile.dataset.id !== drag.id && el.panel.contains(tile)) return { tile, beeId: tile.dataset.id };
    const hive = node.closest('[data-drop-hive]');
    if (hive) return { card: hive, hive: Number(hive.dataset.dropHive) };
    const box = node.closest('[data-drop-box]');
    if (box) return { card: box, box: true };
    return null;
  }

  function onBeeMove(e) {
    if (drag.timer) {
      // Moved before the hold finished: that's a scroll, not a drag.
      if (Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y) > 8) endDrag();
      return;
    }
    if (!drag.active) return;
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);
  }

  function onBeeUp(e) {
    if (drag.timer) return endDrag(); // a normal quick tap: the click opens the bee
    if (!drag.active) return;
    const t = dropTargetAt(e.clientX, e.clientY);
    const id = drag.id;
    drag.suppressClick = true; // don't also open the bee's details
    setTimeout(() => (drag.suppressClick = false), 400);
    endDrag();
    if (!t) return;
    const s = S();
    let r;
    if (t.beeId) r = HC.act.swapBees(id, t.beeId);
    else if (t.box) r = HC.act.moveBee(id, 'box');
    else if (f().hiveOf(s, id) === t.hive) return; // dropped back where it was
    else {
      const h = s.hives[t.hive];
      r = h.bees.length >= f().hiveCap(h) ? { ok: false, msg: 'Hive ' + (t.hive + 1) + ' is full. Drop onto one of its bees to swap them.' } : HC.act.moveBee(id, t.hive);
    }
    if (r && r.ok) toast(r.msg);
    else if (r) bus.emit('fail', r.msg);
    dirty = true;
  }

  function endDrag() {
    clearTimeout(drag.timer);
    drag.timer = null;
    drag.active = false;
    if (drag.ghost) drag.ghost.remove();
    if (drag.tile) drag.tile.classList.remove('dragging');
    if (drag.over) drag.over.classList.remove('drop-over');
    document.body.classList.remove('is-dragging');
    drag.ghost = drag.tile = drag.over = null;
  }

  // ---------------------------------------------------------------------------
  // GUIDED GOALS (playtest 3)
  // For the first goals, the thing you need to press flashes with a gold ring
  // and everything else dims (you can still tap anything; the dimming is
  // just a pointer). If the button is on another tab, the tab flashes first.
  // Once a goal is done, the Claim button flashes. It can be turned off in
  // Settings ("Guided goals").
  // ---------------------------------------------------------------------------
  let spotEl = null;
  function guideTarget() {
    const s = S();
    HC.render.guide = null;
    if (modal || s.settings.guide === false || (s.goal || 0) >= HC.goals.GUIDED) return null;
    const g = HC.goals.current(s);
    if (!g) return null;
    if (g.check(s)) return $('#goalbar [data-act="claimGoal"]');
    const gd = g.guide;
    if (!gd) return null;
    if (gd.scene) {
      HC.render.guide = gd.scene; // the bouncing arrow over the hive
      return $('.screen');
    }
    if (gd.tab && tab !== gd.tab) return el.tabs.querySelector(`[data-tab="${gd.tab}"]`);
    const sel = typeof gd.sel === 'function' ? gd.sel(s) : gd.sel;
    return sel ? el.panel.querySelector(sel) : null;
  }
  // WAITING INSTEAD OF DIMMING (playtest 6): if the button the guide wants is
  // greyed out (not enough coins yet, or the builder is busy), there's
  // nothing to press, so the page stays in full colour and the goal bar shows
  // a "Saving up" bar instead. The flashing comes back once it's affordable.
  // Tapping anywhere away from the flashing thing also pauses the dimming
  // for a minute, so it never gets in the way.
  let guideWait = null; // { cost } while saving up, { busy: true } if the builder is busy
  let guideSnoozedUntil = 0;
  function updateSpotlight() {
    let target = guideTarget();
    guideWait = null;
    if (target && target.classList.contains('cant')) {
      const cost = Number(target.dataset.cost || 0);
      guideWait = S().coins < cost ? { cost } : { busy: true };
      target = null;
    }
    if (Date.now() < guideSnoozedUntil) target = null;
    if (target === spotEl) return;
    if (spotEl) spotEl.classList.remove('spotlight');
    spotEl = target;
    document.body.classList.toggle('guiding', !!target);
    if (!target) return;
    target.classList.add('spotlight');
    // Bring a button in the tab's content into view if it's off screen.
    if (el.panel.contains(target)) {
      const r = target.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ---------------------------------------------------------------------------
  // TUTORIAL HINTS: shown once each, the first time their condition is true.
  // ---------------------------------------------------------------------------
  const HINTS = [
    { id: 'welcome', when: () => true, lines: ['Welcome to Honeycomb Corner!', 'Your bees fill their hive with honey out in the garden. When a hive is full, they stop and wait.', 'Tap a hive to walk out and collect it. Then customers can buy it from the shelves, as long as someone is at the register.'] },
    { id: 'collect', when: (s) => s.stats.collected === 0 && f().honeyIn(s.hives[0]) >= 4, lines: ['Hive 1 has honey waiting. Tap it in the garden to send the shopkeeper out.'] },
    { id: 'line', when: (s) => HC.sim.rt.queue.length >= 2 && !HC.workers.cashierPresent(s), lines: ["Customers are waiting at the register, but nobody's there! They'll leave if they wait too long. Hire a helper in the Shop tab to cover the Register."] },
    { id: 'duties', when: (s) => Object.keys(s.staff).length >= 1, lines: ['You have a helper! In Shop → Staff, tap the duty buttons (Register, Shelves, Hives, Candles) to choose what each person does. No more tapping for chores they cover.'] },
    { id: 'full', when: (s) => s.hives.some((h) => f().hiveFull(h)), lines: ['A hive is full, so those bees have stopped working. Collect it to get them going again.'] },
    { id: 'night', when: (s) => f().isNight(s), lines: ['Night has fallen. The shop is closed and most bees are asleep in their hives.', 'Nobody needs the register now, so whoever is on Register duty fills the shelves for the morning. Collect any leftover honey too.'] },
    { id: 'rush', when: (s) => f().isRush(s), lines: ["It's the lunch rush! Customers pour in for a while. Full shelves and a second person on the Register keep the line moving."] },
    { id: 'critic', when: () => HC.sim.rt.customers.some((c) => c.critic), lines: ['A food critic (the one in the dark suit and top hat) just walked in. Keep most shelves stocked and the line short for a glowing review.'] },
    { id: 'drag', when: (s) => s.hives.length >= 2, lines: ['Tip: in the Apiary tab, press and hold a bee, then drag it onto another hive to move it.'] },
    { id: 'clover', when: (s) => f().marketUnlocked(s, 'clover') && !s.discovered.clover, lines: ['Word is getting around! The Bee Market now sells Clover Bees.'] },
    { id: 'build', when: (s) => s.builds.length > 0, lines: ['Upgrades take time to build. You can keep playing, or tap Finish to use gems.'] },
    { id: 'nursery', when: (s) => s.discovered.clover && !s.discovered.waxwing, lines: ['Try the Nursery: pair a Meadow Bee with a Clover Bee. The parents rest while they raise the egg.'] },
    { id: 'wax', when: (s) => s.discovered.waxwing && !s.machine, lines: ["Waxwing Bees make Beeswax, which can't be sold as-is. Build the Candle Machine in the Shop tab to turn it into candles."] },
    { id: 'order', when: (s) => s.orders.length > 0, lines: ['Someone pinned a request on the board outside. Fill it from the Town tab for a big payout.'] },
    { id: 'merchant', when: (s) => !!s.merchant, lines: ["A travelling merchant has parked outside. The bees are rare, and the wagon won't stay long."] },
    { id: 'drip', when: () => !!HC.sim.rt.drip, lines: ['A golden drip is glistening on one of your hives. Tap it before it drips away!'] },
    { id: 'boxfull', when: (s) => s.box.length >= f().boxCap(s), lines: ["Your bee box is full. Build or upgrade a hive, or sell bees you don't need."] },
    // After 20 minutes of play, invite feedback once (the ⚙ menu has it too).
    { id: 'feedback', when: (s) => s.playTime > 20 * 60, lines: ['Enjoying the shop? If you have a minute, tap ⚙ → Send feedback and tell us what you think. It really helps!'] },
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

  // ---------------------------------------------------------------------------
  // START-UP: find page elements, wire up listeners, start the refresh timers.
  // ---------------------------------------------------------------------------
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
    // Bee dragging (see "MOVING BEES BY DRAGGING" above).
    document.addEventListener('pointerdown', onBeeDown);
    document.addEventListener('pointermove', onBeeMove, { passive: false });
    document.addEventListener('pointerup', onBeeUp);
    document.addEventListener('pointercancel', endDrag);
    // Stop the page scrolling under a bee being dragged, and stop phones
    // opening the "save image" menu on a long press.
    document.addEventListener('touchmove', (e) => { if (drag.active) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', (e) => { if (e.target.closest('.bee-tile')) e.preventDefault(); });
    el.textbox.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      nextLine();
    });
    el.modal.addEventListener('pointerdown', (e) => {
      if (e.target === el.modal) closeModal(); // tapped the dark area outside
    });
    document.addEventListener('keydown', (e) => {
      const typingInField = /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
      // Keys 1-6 switch tabs on a keyboard.
      if (!typingInField && !modal && /^[1-6]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setTab(['apiary', 'shop', 'nursery', 'town', 'store', 'guide'][Number(e.key) - 1]);
        return;
      }
      if (e.key === 'Escape' && modal) closeModal();
      else if ((e.key === 'Enter' || e.key === ' ') && !el.textbox.hidden && document.activeElement === document.body) {
        e.preventDefault();
        nextLine();
      }
    });

    // React to things the game announces.
    const quiet = () => HC.sim.rt.silent; // fast-forwarding: the away report covers it
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
    // Gems are rare, so earning one gets a moment: a big gem pops up in the
    // middle of the screen with a chime, then floats away.
    bus.on('gems', (e) => {
      const b = document.createElement('div');
      b.className = 'gem-burst';
      b.setAttribute('role', 'status');
      b.innerHTML = `${icon('gem', 48)}<b>+${e.n} gem${e.n > 1 ? 's' : ''}</b><span>for ${esc(e.why)}</span>`;
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 2800);
      HC.audio.play('discover');
    });
    bus.on('built', (b) => {
      toast(b.label + ' is finished!', 'good');
      HC.audio.play('bell');
    });
    bus.on('buildStart', () => (dirty = true));
    bus.on('hiveFull', (i) => toastOnce('full' + i, 60, 'Hive ' + (i + 1) + ' is full. Tap it to collect.'));
    bus.on('walkout', () => toastOnce('walkout', 20, 'A customer got tired of waiting and walked out.', 'bad'));
    bus.on('staffQuit', (st) => toast(st.name + " quit: you couldn't pay the morning wages.", 'bad'));
    // Daily events (see sim.js updateDay / updateAnnouncements).
    bus.on('rush', () => {
      toast('Lunch rush! Customers are pouring in.', 'good');
      HC.audio.play('bell');
    });
    bus.on('nightfall', () => {
      toast('Night falls. The shop closes and the bees go to sleep.');
      // Warn in time if there isn't enough put aside for the morning wages.
      const due = f().wagesDue(S());
      if (due > S().coins) toast('Heads up: wages in the morning are about ₵' + fmt(due) + ". Keep enough coins, or someone will quit.", 'bad');
    });
    bus.on('morning', () => toast('Good morning! The shop is open.', 'good'));
    bus.on('special', (g) => toast("Today's special: " + g.name + ' sells for ' + Math.round((D.EVENTS.special.priceMult - 1) * 100) + '% more.', 'good'));
    // A regular paid (see regularPaid in customers.js).
    bus.on('regular', (e) => {
      if (e.heart) toast(`${e.r.name} found their ${D.good[e.r.fav].name}! ♥ ${e.hearts}/5` + (e.gift && e.gift.coins ? ' They left a thank-you gift!' : ''), 'good');
      else if (!e.gotFav) toastOnce('reg-' + e.r.id, 120, `${e.r.name} couldn't find their ${D.good[e.r.fav].name} today.`, 'bad');
    });
    bus.on('criticArrived', () => {
      toast('A food critic just walked in!', 'good');
      HC.audio.play('bell');
    });
    bus.on('critic', (e) => {
      if (e.good) toast('The critic loved it! Reputation up, +' + D.EVENTS.critic.reward + ' gems.', 'good');
      else toast(!e.bought ? 'The critic left without buying anything. Bad review.' : e.full / Math.max(1, e.of) < 0.75 ? 'The critic found too many empty shelves. Bad review.' : 'The critic waited too long in line. Bad review.', 'bad');
      HC.audio.play(e.good ? 'discover' : 'fail');
    });
    bus.on('wagesPaid', (n) => toastOnce('wages', 5, 'Paid ₵' + fmt(n) + ' in wages this morning.'));
    bus.on('season', (se) => {
      toast(se.name + ' has arrived. ' + se.desc, 'good');
      HC.audio.play('bell');
    });
    bus.on('festival', (e) => {
      say(['What a festival! The town awarded you ' + e.gain + ' ribbons and ' + D.GEMS.festival + ' gems.', 'You have ' + e.total + ' ribbons now, so every sale earns ' + e.total * 10 + '% more. Time to build it all again!']);
    });

    // Don't rebuild the page under someone who is typing (rename, import).
    const typingNow = () => {
      const a = document.activeElement;
      return a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.type !== 'checkbox';
    };
    // Four times a second: full redraw if needed, otherwise just live values.
    setInterval(() => {
      if (drag.active) return; // don't rebuild the page under a bee being dragged
      if (dirty && !typingNow()) render();
      else {
        refreshLive();
        updateBadges();
      }
      updateSpotlight();
    }, 250);
    setInterval(checkHints, 1000);
    // The keeper's errand list changes often; redraw the strip when it does.
    let lastErrands = -1;
    setInterval(() => {
      const n = HC.workers.keeperJobs.length;
      if ((n > 0) !== (lastErrands > 0)) dirty = true;
      lastErrands = n;
    }, 500);
    render();
  }

  HC.ui = {
    init, render, toast, say, offlineModal, setTab,
    markDirty: () => (dirty = true),
    get tab() { return tab; },
  };
})();
