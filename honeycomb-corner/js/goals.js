// =============================================================================
// goals.js: THE GOAL CHAIN (the guided "what to do next" list)
// -----------------------------------------------------------------------------
// One goal is active at a time and shows in the strip under the game picture.
// When its `check` becomes true, a Claim button appears. Claiming pays the
// coin and gem reward and moves on to the next goal. Tapping the goal text
// shows a hint (the `tip`, or for "discover a species" goals, the Field
// Guide clue for that species).
//
// To add or reorder goals, edit the GOALS list below. Each entry is:
//   text   - what the player sees
//   check  - a test that looks at the save `s` and says whether it's done
//   reward - coins paid when claimed
//   gems   - gems paid when claimed
//   tip    - (optional) hint text
//   guide  - (optional) what to flash on screen so new players know where to tap
//   progress - (optional) for counting goals, shows a filling bar
// =============================================================================
(function () {
  const HC = window.HC;
  const { bus } = HC;
  const f = () => HC.sim.f;
  // A reusable check for "have you discovered species sp?". It also records
  // the species so the hint can show the right Field Guide clue.
  const disc = (sp) => Object.assign((s) => !!s.discovered[sp], { sp });

  // GUIDES (playtest 3): the early goals point at exactly what to press.
  //   guide.tab    which tab the button is on (the tab button flashes first)
  //   guide.sel    the button to flash, as a CSS selector (or a function
  //                that picks one from the save)
  //   guide.scene  flash the game picture instead, with an arrow over a hive
  // PROGRESS: goals with a count show a filling bar, e.g. "412 / 1,000".
  //   progress(s) returns [how many so far, how many needed]
  const GOALS = [
    { text: 'Collect honey from a hive', check: (s) => s.stats.collected > 0, reward: 20, gems: 1,
      guide: { scene: { hive: 0 } },
      tip: 'Tap a hive in the garden. The shopkeeper walks out, scoops up the honey and carries it to the storehouse.' },
    { text: 'Sell 10 items', check: (s) => s.stats.sold >= 10, reward: 30, gems: 1, progress: (s) => [s.stats.sold, 10],
      tip: 'Customers only pay when someone is at the register, so keep the shopkeeper nearby while the line is long.' },
    { text: 'Buy another Meadow Bee', check: (s) => f().beeCount(s) >= 3, reward: 30, gems: 1,
      guide: { tab: 'apiary', sel: '[data-act="buyBee"][data-sp="meadow"]' },
      tip: 'Open the Apiary tab and scroll down to the Bee Market.' },
    { text: 'Build a second hive', check: (s) => s.hives.length >= 2, reward: 60, gems: 1,
      guide: { tab: 'apiary', sel: '[data-act="buildHive"]' },
      tip: 'Apiary tab → "Build hive 2". Building takes a little while.' },
    { text: 'Hire your first helper', check: (s) => Object.keys(s.staff).length >= 1, reward: 80, gems: 1,
      guide: { tab: 'shop', sel: '[data-act="hire"]' },
      tip: 'Shop tab → Staff. Rosa starts on the Register, so customers can pay while you collect honey.' },
    // Moved up from goal 13 (playtest 3): players reassign their first
    // helper almost straight away, so the goal teaches it right then.
    // Any helper (not the shopkeeper) assigned to the Collect honey duty.
    { text: 'Assign a helper to collect honey', check: (s) => Object.values(s.staff).some((x) => x && x.duty === 'collect'), reward: 100, gems: 2,
      guide: { tab: 'shop', sel: (s) => `[data-act="setDuty"][data-who="${Object.keys(s.staff)[0]}"][data-duty="collect"]` },
      tip: 'Shop tab → Staff. Tap "Hives" under your helper. The shopkeeper stays at the register while they bring honey in, even while you are away.' },
    { text: 'Buy a Clover Bee', check: disc('clover'), reward: 100, gems: 1,
      guide: { tab: 'apiary', sel: '[data-act="buyBee"][data-sp="clover"]' } },
    { text: 'Stock two different shelves', check: (s) => new Set(s.shelves.map((x) => x.good).filter(Boolean)).size >= 2, reward: 120, gems: 1,
      // First build the extra shelf, then tap the empty shelf to fill it.
      guide: { tab: 'shop', sel: (s) => (s.shelves.length < 2 ? '[data-act="upgrade"][data-id="shelf"]' : '.shelf-tile:has(.shelf-empty)') },
      tip: 'Build an Extra Shelf in the Shop tab, then tap a shelf to choose what it sells.' },
    { text: 'Hatch an egg in the Nursery', check: (s) => s.stats.bred >= 1, reward: 150, gems: 2,
      guide: { tab: 'nursery', sel: '[data-act="hatch"], [data-act="breed"]' },
      tip: 'Nursery tab → Pick parents. The parents rest while they raise the egg.' },
    { text: 'Discover the Waxwing Bee', check: disc('waxwing'), reward: 250, gems: 2,
      guide: { tab: 'nursery', sel: '[data-act="hatch"], [data-act="breed"]' } },
    { text: 'Build the Candle Machine', check: (s) => !!s.machine, reward: 300, gems: 2,
      guide: { tab: 'shop', sel: '[data-act="buildMachine"]' },
      tip: 'Shop tab → Candle Machine. Waxwings make Beeswax; the machine turns it into candles.' },
    { text: 'Make 10 candles', check: (s) => s.stats.candles >= 10, reward: 400, gems: 2, progress: (s) => [s.stats.candles, 10],
      guide: { tab: 'shop', sel: '[data-act="tendMachine"]' },
      tip: 'Tap the Candle Machine (behind the counter) to have the shopkeeper load wax and unload candles.' },
    { text: 'Fill a request from the board', check: (s) => s.stats.orders >= 1, reward: 300, gems: 2,
      guide: { tab: 'town', sel: '[data-act="deliver"]' },
      tip: 'Townsfolk pin requests on the board outside the shop. Deliver them from the Town tab.' },
    { text: 'Reach 3 stars of reputation', check: (s) => s.rep >= 3, reward: 500, gems: 2, progress: (s) => [Math.floor(s.rep * 10) / 10, 3],
      tip: 'Keep shelves stocked and the line moving. Requests give a big boost.' },
    { text: 'Buy a decoration from the Store', check: (s) => s.stats.decor >= 1, reward: 200, gems: 3,
      guide: { tab: 'store', sel: '.store-card [data-act="buyItem"]:not(.cant)' },
      tip: 'Store tab. Many decorations come with a small bonus.' },
    { text: 'Build a third hive', check: (s) => s.hives.length >= 3, reward: 600, gems: 2 },
    { text: 'Discover the Citrus Bee', check: disc('citrus'), reward: 1000, gems: 2 },
    { text: 'Upgrade any hive to level 3', check: (s) => s.hives.some((h) => h.level >= 2), reward: 1500, gems: 3 },
    { text: 'Discover the Lavender Bee', check: disc('lavender'), reward: 3000, gems: 3 },
    { text: 'Sell 1,000 items', check: (s) => s.stats.sold >= 1000, reward: 5000, gems: 2, progress: (s) => [s.stats.sold, 1000] },
    { text: 'Discover the Scout Bee', check: disc('scout'), reward: 6000, gems: 3 },
    { text: 'Build a fourth hive', check: (s) => s.hives.length >= 4, reward: 8000, gems: 3 },
    { text: 'Discover the Royal Bee', check: disc('royal'), reward: 15000, gems: 3 },
    { text: 'Discover the Moonmoth Bee', check: disc('moonmoth'), reward: 30000, gems: 4 },
    { text: 'Build a fifth hive', check: (s) => s.hives.length >= 5, reward: 40000, gems: 4 },
    { text: 'Discover the Nurse Bee', check: disc('nurse'), reward: 60000, gems: 4 },
    { text: 'Discover the Golden Bee', check: disc('golden'), reward: 120000, gems: 5 },
    { text: 'Reach 4.5 stars of reputation', check: (s) => s.rep >= 4.5, reward: 150000, gems: 3, progress: (s) => [Math.floor(s.rep * 10) / 10, 4.5] },
    { text: 'Hatch a sparkle bee', check: (s) => Object.keys(s.sparkleSeen).length > 0, reward: 250000, gems: 8 },
    { text: 'Build all six hives', check: (s) => s.hives.length >= 6, reward: 400000, gems: 6 },
    { text: 'Discover the Crystal Bee', check: disc('crystal'), reward: 800000, gems: 8 },
    { text: 'Discover the Starlight Bee', check: disc('star'), reward: 3000000, gems: 13 },
    { text: 'Hold a Honey Festival', check: (s) => s.festivals >= 1, reward: 1000, gems: 15 },
  ];

  // GEMS FROM GOALS (playtest 5): only MILESTONE goals pay gems now, so each
  // gem feels earned. Goal number → gems. Every other goal pays coins only
  // (this overrides the `gems` written on each goal above).
  const MILESTONE_GEMS = { 5: 2, 10: 3, 15: 3, 20: 4, 25: 4, 30: 5, 33: 8 };
  GOALS.forEach((g, i) => {
    g.gems = MILESTONE_GEMS[i + 1] || 0;
    g.milestone = !!g.gems;
  });

  // Discovery goals remember their species so the hint can use its clue.
  for (const g of GOALS) if (g.check.sp) g.sp = g.check.sp;

  // How many goals use the flashing guide. After these, players know their
  // way around and the goal bar just shows the text.
  const GUIDED = 15;

  // The goal you're currently on (or null once they're all done).
  function current(s) {
    return GOALS[s.goal || 0] || null;
  }

  // Claim the current goal if it's complete.
  function claim() {
    const s = HC.game;
    const g = current(s);
    if (!g || !g.check(s)) return { ok: false };
    s.goal = (s.goal || 0) + 1;
    HC.sim.earn(s, g.reward);
    if (g.gems) HC.sim.gainGems(s, g.gems, 'a milestone goal'); // celebrated in ui.js
    bus.emit('sfx', 'order');
    bus.emit('goalClaimed', g);
    bus.emit('dirty');
    return { ok: true, msg: 'Goal complete: +₵' + HC.util.fmt(g.reward) + (g.gems ? ' and ' + g.gems + ' 💎' : '') };
  }

  HC.goals = { GOALS, GUIDED, current, claim };
})();
