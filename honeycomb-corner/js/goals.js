// A linear chain of goals that guides the first few hours. Each pays a reward
// when claimed; the current goal shows in a strip under the scene.
(function () {
  const HC = window.HC;
  const { bus } = HC;
  const f = () => HC.sim.f;
  const disc = (sp) => (s) => !!s.discovered[sp];

  const GOALS = [
    { text: 'Buy another Meadow Bee', check: (s) => f().beeCount(s) >= 3, reward: 30 },
    { text: 'Build a second hive', check: (s) => s.hives.length >= 2, reward: 80 },
    { text: 'Buy a Clover Bee', check: disc('clover'), reward: 100 },
    { text: 'Stock two different shelves', check: (s) => new Set(s.shelves.map((x) => x.good).filter(Boolean)).size >= 2, reward: 120 },
    { text: 'Hatch an egg in the Nursery', check: (s) => s.stats.bred >= 1, reward: 150 },
    { text: 'Discover the Waxwing Bee', check: disc('waxwing'), reward: 250 },
    { text: 'Fill a request from the Town board', check: (s) => s.stats.orders >= 1, reward: 300 },
    { text: 'Reach 3 stars of reputation', check: (s) => s.rep >= 3, reward: 500 },
    { text: 'Build a third hive', check: (s) => s.hives.length >= 3, reward: 600 },
    { text: 'Discover the Citrus Bee', check: disc('citrus'), reward: 1000 },
    { text: 'Upgrade any hive to level 3', check: (s) => s.hives.some((h) => h.level >= 2), reward: 1500 },
    { text: 'Discover the Lavender Bee', check: disc('lavender'), reward: 3000 },
    { text: 'Sell 1,000 items', check: (s) => s.stats.sold >= 1000, reward: 5000 },
    { text: 'Discover the Scout Bee', check: disc('scout'), reward: 6000 },
    { text: 'Build a fourth hive', check: (s) => s.hives.length >= 4, reward: 8000 },
    { text: 'Discover the Royal Bee', check: disc('royal'), reward: 15000 },
    { text: 'Discover the Moonmoth Bee', check: disc('moonmoth'), reward: 30000 },
    { text: 'Build a fifth hive', check: (s) => s.hives.length >= 5, reward: 40000 },
    { text: 'Discover the Nurse Bee', check: disc('nurse'), reward: 60000 },
    { text: 'Discover the Golden Bee', check: disc('golden'), reward: 120000 },
    { text: 'Reach 4.5 stars of reputation', check: (s) => s.rep >= 4.5, reward: 150000 },
    { text: 'Hatch a sparkle bee', check: (s) => Object.keys(s.sparkleSeen).length > 0, reward: 250000 },
    { text: 'Build all six hives', check: (s) => s.hives.length >= 6, reward: 400000 },
    { text: 'Discover the Crystal Bee', check: disc('crystal'), reward: 800000 },
    { text: 'Discover the Starlight Bee', check: disc('star'), reward: 3000000 },
    { text: 'Hold a Honey Festival', check: (s) => s.festivals >= 1, reward: 1000 },
  ];

  function current(s) {
    return GOALS[s.goal || 0] || null;
  }

  function claim() {
    const s = HC.game;
    const g = current(s);
    if (!g || !g.check(s)) return { ok: false };
    s.goal = (s.goal || 0) + 1;
    HC.sim.earn(s, g.reward);
    bus.emit('sfx', 'order');
    bus.emit('goalClaimed', g);
    bus.emit('dirty');
    return { ok: true, msg: 'Goal complete: +₵' + HC.util.fmt(g.reward) };
  }

  HC.goals = { GOALS, current, claim };
})();
