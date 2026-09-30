// =============================================================================
// data.js: THE GAME'S RULEBOOK
// -----------------------------------------------------------------------------
// This file holds numbers and lists only: what products exist, what each
// bee species does, how much upgrades cost, what the Store sells, and so on.
// None of it "runs" by itself; the other files read from it.
//
// If you want to rebalance the game (make something cheaper, slower, more
// valuable), this is almost always the file to change.
//
// A few terms you'll see everywhere:
//   id      - a short internal name the code uses, e.g. 'meadow'. Never shown
//             to players; changing one breaks existing saves, so leave them.
//   name    - what the player sees, e.g. 'Meadow Bee'. Safe to change.
//   tier    - a rank from 0 (cheapest) upward. Higher tier = more valuable.
//   ₵ coins - the everyday money. Gems (💎) are the rare "speed-up" currency.
// =============================================================================
(function () {
  // Every file shares one global object called HC ("Honeycomb Corner").
  // Each file adds its own piece to it; this one adds HC.data.
  const HC = window.HC;

  // ---------------------------------------------------------------------------
  // PRODUCTS ("goods")
  // Listed from cheapest to most valuable. `price` is the base sale price in
  // coins before bonuses. `kind` picks which little pixel icon is drawn
  // (jar, candle, pot, vial, comb, block). `fill` and `lid` are icon colours.
  // `raw: true` means it can't go on a shelf: it's an ingredient (Beeswax is
  // turned into candles by the Candle Machine).
  // ---------------------------------------------------------------------------
  const GOODS = [
    { id: 'wildflower', name: 'Wildflower Honey', price: 5, kind: 'jar', fill: '#f8c838', lid: '#c8642a' },
    { id: 'clover', name: 'Clover Honey', price: 14, kind: 'jar', fill: '#f2e27c', lid: '#4c9a3c' },
    { id: 'wax', name: 'Beeswax', price: 8, kind: 'block', fill: '#f0dc98', lid: '#b8964a', raw: true },
    { id: 'candle', name: 'Beeswax Candle', price: 45, kind: 'candle', fill: '#f6e6b2', lid: '#a86a32' },
    { id: 'orange', name: 'Orange Blossom Honey', price: 110, kind: 'jar', fill: '#f59a24', lid: '#f4ecd8' },
    { id: 'lavender', name: 'Lavender Honey', price: 300, kind: 'jar', fill: '#c6a0e8', lid: '#6a48a8' },
    { id: 'jelly', name: 'Royal Jelly', price: 850, kind: 'pot', fill: '#fff2cc', lid: '#d8a020' },
    { id: 'moon', name: 'Moonlight Honey', price: 2400, kind: 'vial', fill: '#98aef0', lid: '#2a2a58' },
    { id: 'golden', name: 'Golden Nectar', price: 7000, kind: 'vial', fill: '#ffd23a', lid: '#b07a10' },
    { id: 'crystal', name: 'Crystal Comb', price: 20000, kind: 'comb', fill: '#a4eef0', lid: '#2a7890' },
    { id: 'star', name: 'Starlight Honey', price: 60000, kind: 'jar', fill: '#fff0a0', lid: '#5a3aa0' },
  ];
  // Give every product its tier number automatically from its position in
  // the list (first = 0). Raw ingredients share the tier of what they become.
  GOODS.forEach((g, i) => (g.tier = i));

  // ---------------------------------------------------------------------------
  // BEE SPECIES
  //   good   - which product this bee makes
  //   secs   - seconds to make one unit at 100% vigor (lower = faster)
  //   rarity - label shown in the Field Guide
  //   body/stripe/wing - colours of its portrait
  //   mark   - a small detail painted on the portrait (leaf, crown, moon...)
  //   shape  - body size, wing style and stripe pattern for its silhouette
  //   aura   - a special effect while it lives in a hive (see Scout and Nurse)
  //   flavor - the description in the Field Guide once discovered
  //   hint   - the clue shown before it's discovered
  // ---------------------------------------------------------------------------
  const SPECIES = [
    {
      id: 'meadow', name: 'Meadow Bee', good: 'wildflower', secs: 8, tier: 0, rarity: 'Common',
      body: '#f8c838', stripe: '#3a2a18', wing: '#e6f2ff', mark: null,
      flavor: 'The first bee most keepers meet. Cheerful, reliable, and not picky about flowers.',
      hint: 'Sold at the Bee Market.',
    },
    {
      id: 'clover', name: 'Clover Bee', good: 'clover', secs: 10, tier: 1, rarity: 'Common',
      body: '#b4dc64', stripe: '#2e4a20', wing: '#e6f2ff', mark: 'leaf',
      flavor: 'Hums a little lower than other bees. Swears three-leaf clover tastes better.',
      hint: 'Sold at the Bee Market once the shop is known around town.',
    },
    {
      id: 'waxwing', name: 'Waxwing Bee', good: 'wax', secs: 12, tier: 2, rarity: 'Uncommon',
      body: '#f2e2b0', stripe: '#8a6a3a', wing: '#fff6e0', mark: 'drop',
      shape: { rx: 5, ry: 3.7, wing: 'small', stripes: 'double' },
      flavor: 'Builds comb so neat you could frame it. Its Beeswax becomes candles in the Candle Machine.',
      hint: 'Something waxy comes from a meadow bee and a clover bee.',
    },
    {
      id: 'citrus', name: 'Citrus Bee', good: 'orange', secs: 18, tier: 3, rarity: 'Uncommon',
      body: '#f89a28', stripe: '#5a2a10', wing: '#fff0dc', mark: 'flower',
      shape: { stripes: 'triple' },
      flavor: 'Always smells faintly of orange peel. Customers ask where it goes on holiday.',
      hint: 'A clover bee and a waxwing, left alone together, get zesty.',
    },
    {
      id: 'scout', name: 'Scout Bee', good: 'clover', secs: 24, tier: 3, rarity: 'Uncommon',
      body: '#e8c85a', stripe: '#3a5a8a', wing: '#e6f2ff', mark: 'band',
      aura: { customers: 0.06 },
      shape: { rx: 5.2, ry: 2.7, wing: 'long', stripes: 'single' },
      flavor: 'Flies laps around town telling everyone about the shop. Each one in a hive brings in 6% more customers.',
      hint: 'A homebody meadow bee paired with a well-travelled citrus bee.',
    },
    {
      id: 'lavender', name: 'Lavender Bee', good: 'lavender', secs: 24, tier: 4, rarity: 'Rare',
      body: '#b890e0', stripe: '#3a2458', wing: '#f2eaff', mark: 'flower',
      shape: { stripes: 'triple', wing: 'round' },
      flavor: 'Calm, a little dreamy. Its hive is the quietest in the garden.',
      hint: 'Pair a waxwing with a citrus bee.',
    },
    {
      id: 'nurse', name: 'Nurse Bee', good: 'wildflower', secs: 20, tier: 4, rarity: 'Rare',
      body: '#f4d4dc', stripe: '#b04a6a', wing: '#fff0f4', mark: 'cross',
      aura: { hive: 0.2 },
      shape: { rx: 4.4, ry: 3.6, wing: 'small', stripes: 'single' },
      flavor: 'Barely makes honey itself. Keeps every hive-mate fed and fussed over: +20% output for the whole hive.',
      hint: 'Humble meadow stock raised beside royalty.',
    },
    {
      id: 'royal', name: 'Royal Bee', good: 'jelly', secs: 30, tier: 5, rarity: 'Rare',
      body: '#f0c030', stripe: '#6a1a2a', wing: '#fff4e0', mark: 'crown',
      shape: { rx: 5.3, ry: 3.8, stripes: 'triple' },
      flavor: 'Expects to be addressed properly. Produces royal jelly and a lot of opinions.',
      hint: 'A lavender bee and a waxwing, if the mood is right.',
    },
    {
      id: 'moonmoth', name: 'Moonmoth Bee', good: 'moon', secs: 38, tier: 6, rarity: 'Epic',
      body: '#7a8ad8', stripe: '#1e1a40', wing: '#d8d0ff', mark: 'moon',
      nightBonus: 0.6,
      shape: { wing: 'moth', stripes: 'spots', feathery: true },
      flavor: 'Sleeps through the afternoon. Works 60% harder after dark.',
      hint: 'Lavender dreams plus citrus warmth, sometime after sunset.',
    },
    {
      id: 'golden', name: 'Golden Bee', good: 'golden', secs: 48, tier: 7, rarity: 'Epic',
      body: '#ffd84a', stripe: '#a8781a', wing: '#fff8d0', mark: 'gem',
      shape: { rx: 5, ry: 3.5, stripes: 'single', wing: 'long' },
      flavor: 'Glints in direct sunlight. Nobody knows where it finds the nectar.',
      hint: 'Royalty courting the moon.',
    },
    {
      id: 'crystal', name: 'Crystal Bee', good: 'crystal', secs: 60, tier: 8, rarity: 'Legendary',
      body: '#96e6f0', stripe: '#2a6a80', wing: '#f0ffff', mark: 'gem',
      shape: { wing: 'angular', stripes: 'triple' },
      flavor: 'Builds comb that rings like glass when you tap it.',
      hint: 'Gold and moonlight, crystallised.',
    },
    {
      id: 'star', name: 'Starlight Bee', good: 'star', secs: 75, tier: 9, rarity: 'Legendary',
      body: '#fff2a8', stripe: '#5a3aa0', wing: '#fffbe0', mark: 'star',
      shape: { rx: 5.2, ry: 3.4, wing: 'angular', stripes: 'spots' },
      flavor: 'Appears on clear nights. Old keepers say it followed a comet down.',
      hint: 'Crystal clarity and a golden heart.',
    },
  ];

  // ---------------------------------------------------------------------------
  // BREEDING RECIPES
  // Pairing species `a` with species `b` in the Nursery has a `p` chance
  // (0.5 = 50%) of hatching species `out`. Otherwise the egg takes after one
  // of its parents. Order doesn't matter: a+b is the same as b+a.
  // ---------------------------------------------------------------------------
  const RECIPES = [
    { a: 'meadow', b: 'clover', out: 'waxwing', p: 0.5 },
    { a: 'clover', b: 'waxwing', out: 'citrus', p: 0.45 },
    { a: 'meadow', b: 'citrus', out: 'scout', p: 0.4 },
    { a: 'waxwing', b: 'citrus', out: 'lavender', p: 0.4 },
    { a: 'meadow', b: 'royal', out: 'nurse', p: 0.4 },
    { a: 'lavender', b: 'waxwing', out: 'royal', p: 0.35 },
    { a: 'lavender', b: 'citrus', out: 'moonmoth', p: 0.35 },
    { a: 'royal', b: 'moonmoth', out: 'golden', p: 0.3 },
    { a: 'moonmoth', b: 'golden', out: 'crystal', p: 0.25 },
    { a: 'crystal', b: 'golden', out: 'star', p: 0.2 },
  ];

  // ---------------------------------------------------------------------------
  // TRAITS: a personality some bees are born with. Each gives a small bonus.
  // ---------------------------------------------------------------------------
  const TRAITS = {
    diligent: { name: 'Diligent', desc: '+15% output', prod: 0.15 },
    nightowl: { name: 'Night Owl', desc: '+50% output at night', night: 0.5 },
    earlybird: { name: 'Early Bird', desc: '+25% output by day', day: 0.25 },
    lucky: { name: 'Lucky', desc: 'Triples sparkle chance for its eggs', lucky: 3 },
    charming: { name: 'Charming', desc: '+3% customers while in a hive', customers: 0.03 },
  };

  // ---------------------------------------------------------------------------
  // SHOP UPGRADES
  // Price of the next level = base × growth^(current level).
  // Example: Painted Sign at level 2 costs 150 × 2.3 × 2.3 ≈ 794 coins.
  // Every upgrade also takes real time to build (see buildTime in sim.js).
  // `desc(level)` is the one-line explanation shown to the player.
  // ---------------------------------------------------------------------------
  const UPGRADES = [
    { id: 'shelf', name: 'Extra Shelf', base: 80, growth: 4.2, max: 7, desc: () => 'Adds a shelf for another product.' },
    // Bigger Basket affects EVERYONE who carries things: the shopkeeper and
    // every helper (collecting honey, restocking, the candle machine).
    { id: 'basket', name: 'Bigger Basket', base: 150, growth: 2.4, max: 10, desc: (lv) => 'You and all your helpers carry 8 more jars per trip (now ' + (12 + 8 * lv) + ', next ' + (20 + 8 * lv) + '). Fewer trips for collecting, restocking and the candle machine.' },
    { id: 'samples', name: 'Tasting Samples', base: 120, growth: 2.5, max: 10, desc: () => 'Customers buy 10% more items.' },
    { id: 'sign', name: 'Painted Sign', base: 150, growth: 2.3, max: 20, desc: () => '+15% customer visits.' },
    { id: 'labels', name: 'Fancy Labels', base: 200, growth: 2.15, max: 25, desc: () => '+8% sale prices.' },
    { id: 'register', name: 'Brass Register', base: 300, growth: 2.6, max: 8, desc: () => 'Checkout 12% faster.' },
    { id: 'flowers', name: 'Flower Beds', base: 250, growth: 2.3, max: 20, desc: () => '+8% honey from every bee. Plants a new bed in the garden.' },
    { id: 'storage', name: 'Bigger Storehouse', base: 100, growth: 2.25, max: 20, desc: () => '+60% storage per product.' },
    { id: 'cart', name: 'Honey Cart', base: 1500, growth: 3, max: 8, desc: (lv) => 'Sells storehouse overflow at ' + (lv ? 20 + lv * 5 : 20) + '% price instead of wasting it.' },
    { id: 'beebox', name: 'Bigger Bee Box', base: 400, growth: 2.8, max: 10, desc: () => '+4 spaces for spare bees.' },
    { id: 'nursery', name: 'Nursery Cradle', base: 3000, growth: 12, max: 2, desc: () => '+1 breeding slot.' },
    // Playtest 4: a bigger shop. Each level knocks through a wall so every
    // shelf holds 3 more items (6 → 9 → 12...), so shelves empty less often.
    { id: 'expand', name: 'Shop Expansion', base: 2500, growth: 6, max: 6, desc: (lv) => 'Every shelf holds 3 more items (now ' + (6 + 3 * lv) + ', next ' + (9 + 3 * lv) + ').' },
  ];

  // Cost of building hive number 1, 2, 3... (the first one is free).
  const HIVE_COSTS = [0, 200, 1200, 8000, 120000, 1500000];
  const HIVE_MAX_LEVEL = 5;

  // ---------------------------------------------------------------------------
  // CANDLE MACHINE
  // Waxwing bees make raw Beeswax. The machine turns 1 Beeswax into 1 Candle.
  // Someone has to carry wax to it and carry the candles back to the
  // storehouse (the shopkeeper when you tap it, or a hired Candle Maker).
  // ---------------------------------------------------------------------------
  const MACHINE = {
    buildCost: 600,
    // Each upgrade level: holds more wax and works faster.
    upgradeBase: 1500, upgradeGrowth: 3.2, maxLevel: 5,
    capacity: (lv) => 10 + 6 * lv, // wax it can hold at once
    secsPerCandle: (lv) => 8 * Math.pow(0.82, lv),
  };

  // ---------------------------------------------------------------------------
  // STAFF: helpers you can hire, one after another in this order.
  // Helpers aren't tied to one job: each one is ASSIGNED A DUTY (see DUTIES
  // below) that you can change at any time in the Shop tab. You can even give
  // the shopkeeper a duty.
  //   hire  one-off fee to take them on
  //   wage  base pay every morning, PLUS each helper takes a share
  //         (WAGE_SHARE) of what the shop earned the day before. So wages grow
  //         as the shop gets richer. If you can't pay, the priciest helper quits.
  //   duty  the duty they start on when hired (you can change it)
  //   look  how they're drawn in the scene
  // ---------------------------------------------------------------------------
  const STAFF = [
    {
      id: 'rosa', name: 'Rosa', hire: 250, wage: 40, duty: 'register',
      look: { hair: ['#2a2222', '#161010'], skin: ['#e0a878', '#b87c50'], shirt: ['#c84a4a', '#8e2e2e'], hat: null, apron: '#f4ecd8' },
    },
    {
      id: 'theo', name: 'Theo', hire: 600, wage: 80, duty: 'stock',
      look: { hair: ['#e8c060', '#b89040'], skin: ['#f4d4b8', '#d8ac88'], shirt: ['#3a8ab0', '#266080'], hat: 'cap', apron: null },
    },
    {
      id: 'mabel', name: 'Mabel', hire: 1200, wage: 150, duty: 'collect',
      look: { hair: ['#c0502a', '#8a3418'], skin: ['#f8c898', '#d89868'], shirt: ['#7a9a4a', '#56702e'], hat: 'straw', apron: null },
    },
    {
      id: 'otis', name: 'Otis', hire: 3000, wage: 300, duty: 'candles',
      look: { hair: ['#8a5a8a', '#5e3a5e'], skin: ['#b07850', '#86563a'], shirt: ['#e08a3a', '#a85e22'], hat: null, apron: '#6a4a2a' },
    },
  ];

  // ---------------------------------------------------------------------------
  // DUTIES: the jobs anyone (helpers or the shopkeeper) can be assigned to.
  //   home   where they wait when there's nothing to do (a spot in nav.js)
  //   needs  the duty only works once you own that thing
  //   face   which way they face while waiting
  // Several people can share a duty. Two people on the Register ring
  // customers up faster (one scans, one bags), which helps in the lunch rush.
  // At night the shop is closed, so anyone on the Register restocks the
  // shelves instead.
  // ---------------------------------------------------------------------------
  const DUTIES = [
    { id: 'register', name: 'Register', short: 'Register', home: 'DESK', face: 'down', desc: 'Stays at the register so customers can pay. At night, restocks the shelves.' },
    { id: 'stock', name: 'Stock shelves', short: 'Shelves', home: 'STORE', face: 'left', desc: 'Carries goods from the storehouse to any shelf running low.' },
    { id: 'collect', name: 'Collect honey', short: 'Hives', home: 'LANE3', face: 'right', desc: 'Walks the garden and brings honey in from hives that are filling up.' },
    { id: 'candles', name: 'Candle Machine', short: 'Candles', home: 'MACH', face: 'up', needs: 'machine', desc: 'Loads wax into the Candle Machine and carries candles to the storehouse.' },
  ];

  // ---------------------------------------------------------------------------
  // REPUTATION: every way it goes up or down, in one place. The Reputation
  // window (tap the stars) lists these, and a log of today's changes.
  //   amt   how much it changes (on a 0-5 star scale)
  //   text  the explanation shown to the player
  // "served" is smaller the closer you are to 5 stars, and decorations with a
  // reputation bonus make it bigger.
  // ---------------------------------------------------------------------------
  const REP = {
    served: { amt: 0.02, text: 'A customer paid and left happy', good: true },
    order: { amt: 0.15, text: 'You delivered a request from the board', good: true },
    criticGood: { amt: 0.35, text: 'A food critic loved the shop', good: true },
    special: { amt: 0.01, text: "Extra for selling today's special", good: true },
    empty: { amt: -0.04, text: 'A customer found nothing they could buy (empty shelves, or nothing in their price range)' },
    walkout: { amt: -0.06, text: 'A customer gave up waiting in line and walked out' },
    criticBad: { amt: -0.25, text: 'A food critic was unimpressed' },
    away: { amt: -0.01, text: 'While you were away, a customer found empty shelves' },
  };

  // ---------------------------------------------------------------------------
  // DAILY EVENTS (all in fractions of a day; 0 = 6am, 0.25 = noon, 0.7 = dusk)
  //   RUSH     the lunch rush: customers arrive much faster for a while
  //   SPECIAL  each morning one product becomes "today's special": it sells
  //            for 30% more and customers look for it first. Starts once you
  //            sell at least two different products.
  //   CRITIC   a food critic visits on some days. They judge how well stocked
  //            the shelves are and how long they wait in line.
  // ---------------------------------------------------------------------------
  const EVENTS = {
    rush: { from: 0.2, to: 0.3, spawnMult: 0.35 },
    special: { priceMult: 1.3, pickWeight: 4, minGoods: 2 }, // only once you sell 2+ products
    critic: { chance: 0.6, earliest: 0.08, latest: 0.6, reward: 2 },
  };

  // ---------------------------------------------------------------------------
  // CUSTOMERS. `weight` is how common they are (bigger = more common).
  // `repWeight` makes them more common as your reputation grows.
  // `offset` limits what they can afford: 0 can buy your best product,
  // 3 can only afford things three tiers below your best.
  // `units` is how many items they buy, e.g. [1, 3] = one to three.
  // ---------------------------------------------------------------------------
  const CUSTOMERS = [
    { id: 'villager', name: 'Villager', weight: 50, offset: 3, units: [1, 2], hat: null },
    { id: 'hiker', name: 'Hiker', weight: 20, offset: 2, units: [2, 3], hat: 'cap', shirt: ['#4a8a3a', '#2e5e26'] },
    { id: 'chef', name: 'Chef', weight: 12, offset: 1, units: [1, 3], hat: 'chef', shirt: ['#f4f0e8', '#c8c0b0'] },
    { id: 'noble', name: 'Noble', weight: 5, repWeight: 3, offset: 0, units: [1, 2], hat: 'tophat', shirt: ['#6a3a8a', '#44245e'] },
    { id: 'collector', name: 'Collector', weight: 1, repWeight: 1.5, offset: 0, units: [1, 1], mult: 1.5, hat: 'beret', shirt: ['#2a6a6a', '#1a4444'] },
    // The food critic never turns up at random: sim.js sends one on some days.
    { id: 'critic', name: 'Food Critic', weight: 0, offset: 0, units: [1, 1], mult: 2, hat: 'tophat', shirt: ['#2a2a3a', '#16161e'] },
  ];

  // Colour pairs [main, shadow] used to dress random customers.
  const HAIR = [
    ['#6a3e1e', '#4a2a12'], ['#2a2222', '#161010'], ['#e8c060', '#b89040'],
    ['#c0502a', '#8a3418'], ['#d8d0c8', '#a8a098'], ['#8a5a8a', '#5e3a5e'],
  ];
  const SHIRTS = [
    ['#3a8ab0', '#266080'], ['#c84a4a', '#8e2e2e'], ['#e08a3a', '#a85e22'],
    ['#5a6ab8', '#3a4888'], ['#d86aa0', '#a04878'], ['#7a9a4a', '#56702e'],
  ];
  const SKIN = [['#f8c898', '#d89868'], ['#e0a878', '#b87c50'], ['#b07850', '#86563a'], ['#f4d4b8', '#d8ac88']];

  // ---------------------------------------------------------------------------
  // THE STORE: cosmetics and decorations.
  //   cat   - which Store section it appears in
  //   cost  - { coins: n } or { gems: n }; items with `free: true` cost nothing
  //   default - owned (and worn/placed) from the start
  //   bonus - optional small perk while it's placed:
  //             customers: +x visits, prod: +x honey, rep: +x reputation gain
  //   colors - for wardrobe items, the colours the keeper is drawn with
  // Decorations appear in the scene at a fixed spot (drawn in render.js).
  // ---------------------------------------------------------------------------
  const CATALOG = [
    // Keeper hats
    { id: 'hat-bandana', cat: 'hat', name: 'Bandana', default: true, value: 'bandana' },
    { id: 'hat-none', cat: 'hat', name: 'No hat', free: true, value: null },
    { id: 'hat-straw', cat: 'hat', name: 'Straw Hat', cost: { coins: 150 }, value: 'straw' },
    { id: 'hat-cap', cat: 'hat', name: 'Garden Cap', cost: { coins: 300 }, value: 'cap' },
    { id: 'hat-chef', cat: 'hat', name: 'Chef Hat', cost: { coins: 1000 }, value: 'chef' },
    { id: 'hat-tophat', cat: 'hat', name: 'Top Hat', cost: { coins: 2500 }, value: 'tophat' },
    { id: 'hat-beret', cat: 'hat', name: 'Artist Beret', cost: { gems: 8 }, value: 'beret' },
    { id: 'hat-crown', cat: 'hat', name: 'Flower Crown', cost: { gems: 15 }, value: 'crown' },
    // Keeper hair colours
    { id: 'hair-brown', cat: 'hair', name: 'Chestnut', default: true, colors: ['#6a3e1e', '#4a2a12'] },
    { id: 'hair-black', cat: 'hair', name: 'Ink', free: true, colors: ['#2a2222', '#161010'] },
    { id: 'hair-blonde', cat: 'hair', name: 'Honey Blonde', free: true, colors: ['#e8c060', '#b89040'] },
    { id: 'hair-red', cat: 'hair', name: 'Copper', free: true, colors: ['#c0502a', '#8a3418'] },
    { id: 'hair-silver', cat: 'hair', name: 'Silver', cost: { gems: 5 }, colors: ['#e0e0e8', '#a8a8b8'] },
    { id: 'hair-pink', cat: 'hair', name: 'Rose', cost: { gems: 10 }, colors: ['#f08ab0', '#c05a80'] },
    // Keeper shirts
    { id: 'shirt-cream', cat: 'shirt', name: 'Cream', default: true, colors: ['#f4f0e0', '#d0c8b0'] },
    { id: 'shirt-sky', cat: 'shirt', name: 'Sky', cost: { coins: 200 }, colors: ['#8ac8f0', '#5a98c0'] },
    { id: 'shirt-rose', cat: 'shirt', name: 'Rose', cost: { coins: 200 }, colors: ['#f0a0b8', '#c07088'] },
    { id: 'shirt-leaf', cat: 'shirt', name: 'Leaf', cost: { coins: 200 }, colors: ['#8ac860', '#5a9838'] },
    { id: 'shirt-night', cat: 'shirt', name: 'Midnight', cost: { gems: 6 }, colors: ['#3a3a6a', '#24244a'] },
    { id: 'shirt-royal', cat: 'shirt', name: 'Royal Purple', cost: { gems: 12 }, colors: ['#8a4ab8', '#62308a'] },
    // Keeper aprons
    { id: 'apron-honey', cat: 'apron', name: 'Honey', default: true, colors: ['#e8a020'] },
    { id: 'apron-berry', cat: 'apron', name: 'Berry', cost: { coins: 150 }, colors: ['#c8445a'] },
    { id: 'apron-mint', cat: 'apron', name: 'Mint', cost: { coins: 150 }, colors: ['#6ac8a0'] },
    { id: 'apron-denim', cat: 'apron', name: 'Denim', cost: { coins: 400 }, colors: ['#4a6a9a'] },
    { id: 'apron-gold', cat: 'apron', name: 'Gold Leaf', cost: { gems: 10 }, colors: ['#ffd23a'] },
    // Shop walls and floors (only one of each is used at a time)
    { id: 'wall-planks', cat: 'wall', name: 'Oak Planks', default: true },
    { id: 'wall-honeycomb', cat: 'wall', name: 'Honeycomb Paper', cost: { coins: 1500 } },
    { id: 'wall-stripes', cat: 'wall', name: 'Mint Stripes', cost: { gems: 8 } },
    { id: 'wall-rose', cat: 'wall', name: 'Rose Damask', cost: { gems: 12 } },
    { id: 'floor-checker', cat: 'floor', name: 'Cream Checker', default: true },
    { id: 'floor-wood', cat: 'floor', name: 'Warm Boards', cost: { coins: 1200 } },
    { id: 'floor-tiles', cat: 'floor', name: 'Blue Tiles', cost: { gems: 10 } },
    // Shop decorations (each has its own spot; you can own and place them all)
    { id: 'deco-table', cat: 'shopDecor', name: 'Honey Display Table', default: true, bonus: { customers: 0.03 } },
    { id: 'deco-plant', cat: 'shopDecor', name: 'Potted Fern', default: true },
    { id: 'deco-rug', cat: 'shopDecor', name: 'Welcome Rug', default: true },
    { id: 'deco-chalk', cat: 'shopDecor', name: 'Chalkboard Menu', cost: { coins: 400 }, bonus: { customers: 0.05 } },
    { id: 'deco-lights', cat: 'shopDecor', name: 'String Lights', cost: { coins: 800 }, bonus: { rep: 0.1 } },
    { id: 'deco-mural', cat: 'shopDecor', name: 'Bee Mural', cost: { gems: 12 }, bonus: { customers: 0.05 } },
    // Garden decorations
    { id: 'deco-bench', cat: 'gardenDecor', name: 'Garden Bench', cost: { coins: 500 }, bonus: { customers: 0.03 } },
    { id: 'deco-gnome', cat: 'gardenDecor', name: 'Beekeeper Gnome', cost: { gems: 5 }, bonus: { prod: 0.02 } },
    { id: 'deco-lanterns', cat: 'gardenDecor', name: 'Garden Lanterns', cost: { coins: 1500 }, bonus: { rep: 0.05 } },
    { id: 'deco-pond', cat: 'gardenDecor', name: 'Lily Pond', cost: { coins: 8000 }, bonus: { prod: 0.05 } },
    { id: 'deco-fountain', cat: 'gardenDecor', name: 'Stone Fountain', cost: { gems: 20 }, bonus: { prod: 0.05 } },
    // SEASONAL SPECIALS (playtest 4): big, pricey decorations that can only be
    // BOUGHT during their season (you keep them forever once bought). They
    // soak up spare coins in the mid and late game.
    { id: 'deco-blossom', cat: 'seasonal', season: 'spring', name: 'Blossom Tree Planter', cost: { coins: 25000 }, bonus: { customers: 0.08 } },
    { id: 'deco-lemonade', cat: 'seasonal', season: 'summer', name: 'Lemonade Stand', cost: { coins: 150000 }, bonus: { customers: 0.1 } },
    { id: 'deco-pumpkins', cat: 'seasonal', season: 'autumn', name: 'Pumpkin Patch', cost: { coins: 800000 }, bonus: { prod: 0.08 } },
    { id: 'deco-tree', cat: 'seasonal', season: 'winter', name: 'Holiday Tree', cost: { coins: 4000000 }, bonus: { rep: 0.15 } },
    // Hive styles (one at a time; changes how every hive looks)
    { id: 'hive-classic', cat: 'hiveStyle', name: 'Classic Boxes', default: true },
    { id: 'hive-painted', cat: 'hiveStyle', name: 'Painted Cottage', cost: { coins: 2000 } },
    { id: 'hive-skep', cat: 'hiveStyle', name: 'Straw Skep', cost: { gems: 15 } },
    { id: 'hive-royal', cat: 'hiveStyle', name: 'Royal Gilded', cost: { gems: 40 } },
  ];

  // The Store's sections, in display order. `pick` = only one can be used at
  // a time (like a hat); otherwise every owned item can be placed at once.
  const STORE_SECTIONS = [
    { cat: 'hat', name: 'Hats', pick: true },
    { cat: 'hair', name: 'Hair', pick: true },
    { cat: 'shirt', name: 'Shirts', pick: true },
    { cat: 'apron', name: 'Aprons', pick: true },
    { cat: 'shopDecor', name: 'Shop decorations', pick: false },
    { cat: 'gardenDecor', name: 'Garden decorations', pick: false },
    { cat: 'wall', name: 'Wallpaper', pick: true },
    { cat: 'floor', name: 'Floors', pick: true },
    { cat: 'hiveStyle', name: 'Hive styles', pick: true },
    { cat: 'seasonal', name: 'Seasonal specials', pick: false },
  ];

  // ---------------------------------------------------------------------------
  // HELPER TRAINING (playtest 4): spend coins to train each helper. Training
  // is instant (it doesn't use the builder) and each helper has two tracks:
  //   speed   walks 15% faster per level
  //   basket  carries 6 more jars per trip per level (on top of Bigger Basket)
  // Price of the next level = base × growth^(current level), rounded.
  // ---------------------------------------------------------------------------
  const TRAINING = {
    speed: { name: 'Quick feet', per: 0.15, base: 400, growth: 3, max: 10 },
    basket: { name: 'Strong arms', per: 6, base: 500, growth: 3, max: 10 },
  };

  // ---------------------------------------------------------------------------
  // GEMS: the rare currency. You earn them from goals, requests, festivals,
  // new species and golden drips, and spend them to finish timers early or
  // on special Store items. These are the amounts for each source.
  // ---------------------------------------------------------------------------
  // Gems are RARE on purpose (playtest 5: "tough but rewarding"). You still
  // earn them by playing, but only at notable moments:
  //   - milestone goals (every fifth goal; see goals.js)
  //   - discovering an uncommon-or-rarer species (rarer = more gems)
  //   - a glowing review from the food critic
  //   - the odd request (1 in 20) or golden drip (1 in 33)
  //   - holding a Honey Festival
  // Seasons no longer give gems. Earning one gets a little celebration (ui.js).
  const GEMS = {
    start: 5,
    // Gems for discovering a species, by its rarity.
    newSpecies: { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 },
    seasonChange: 0,
    festival: 15,
    orderChance: 0.05, orderMin: 1, orderMax: 1,
    dripChance: 0.03,
    secsPerGem: 120, // skipping a timer costs 1 gem per 2 minutes left
    // Extra builders are NOT sold for gems: you get one builder. A second
    // builder is planned as a paid unlock in the full version (see DESIGN.md).
  };

  const BEE_NAMES = [
    'Bumble', 'Waggle', 'Pollen', 'Clementine', 'Hexa', 'Juniper', 'Marigold', 'Buzz', 'Nectarine',
    'Dandelion', 'Comfrey', 'Poppy', 'Fennel', 'Sorrel', 'Basil', 'Tansy', 'Yarrow', 'Thistle', 'Zinnia',
    'Hazel', 'Pip', 'Mabel', 'Otto', 'Figaro', 'Beatrix', 'Honeydew', 'Sage', 'Wren', 'Aster',
    'Biscuit', 'Nutmeg', 'Saffron', 'Quince', 'Ginger', 'Tulip', 'Rosie', 'Barnaby', 'Fizz', 'Dot',
    'Acorn', 'Bramble', 'Buttercup', 'Chamomile', 'Cricket', 'Daisy', 'Elder', 'Fern', 'Gus', 'Heather',
    'Iris', 'Jasper', 'Kiwi', 'Lupin', 'Maple', 'Nettle', 'Olive', 'Peony', 'Primrose', 'Rhubarb',
    'Rowan', 'Sprout', 'Sunny', 'Toffee', 'Umber', 'Violet', 'Willow', 'Yuzu', 'Zest', 'Bean',
    'Caramel', 'Doodle', 'Ember', 'Flick', 'Goldie', 'Hum', 'Inkwell', 'Jam', 'Kip', 'Lark',
    'Muffin', 'Nibs', 'Oats', 'Pepper', 'Quill', 'Rusk', 'Scone', 'Truffle', 'Waffles', 'Ziggy',
  ];

  // Who pins requests on the board outside the shop.
  const REQUESTERS = [
    'Mrs. Pemberton', 'The Bakery on Elm', 'Coach Reyes', 'Old Man Hollis', 'Town Hall', 'The Tea Room',
    'Dr. Okafor', 'Harbor Inn', 'Little Library', 'Farmer Quill', 'Miss Delacroix', 'The Candle Guild',
  ];

  // ---------------------------------------------------------------------------
  // REGULARS (playtest 6): named townsfolk who come back to the shop. Each has
  // a favourite product. When they visit and find it on a shelf, they buy it,
  // tip 25% and gain a friendship heart. Hearts unlock rewards (REGULAR_GIFTS).
  // A regular only starts visiting once you've made their favourite product.
  //   fav   their favourite product
  //   blurb a line about them, shown in the Town tab
  //   look  how they're drawn (hair, skin, shirt, hat)
  // ---------------------------------------------------------------------------
  const REGULARS = [
    { id: 'pemberton', name: 'Mrs. Pemberton', fav: 'wildflower', blurb: 'Has a spoonful in her tea every morning, and opinions about everything else.',
      look: { hair: ['#d8d0c8', '#a8a098'], skin: ['#f4d4b8', '#d8ac88'], shirt: ['#d86aa0', '#a04878'], hat: null } },
    { id: 'reyes', name: 'Coach Reyes', fav: 'clover', blurb: 'Swears clover honey is why the under-tens won the county cup.',
      look: { hair: ['#2a2222', '#161010'], skin: ['#b07850', '#86563a'], shirt: ['#3a8ab0', '#266080'], hat: 'cap' } },
    { id: 'hollis', name: 'Old Man Hollis', fav: 'candle', blurb: 'Reads by candlelight. Claims electricity is a passing fad.',
      look: { hair: ['#d8d0c8', '#a8a098'], skin: ['#e0a878', '#b87c50'], shirt: ['#7a9a4a', '#56702e'], hat: 'straw' } },
    { id: 'okafor', name: 'Dr. Okafor', fav: 'orange', blurb: 'Prescribes orange blossom honey for sore throats. Buys it for herself too.',
      look: { hair: ['#2a2222', '#161010'], skin: ['#86563a', '#6a4028'], shirt: ['#f4f0e8', '#c8c0b0'], hat: null } },
    { id: 'delacroix', name: 'Miss Delacroix', fav: 'lavender', blurb: 'Runs the tea room. Her lavender scones are famous two towns over.',
      look: { hair: ['#8a5a8a', '#5e3a5e'], skin: ['#f8c898', '#d89868'], shirt: ['#5a6ab8', '#3a4888'], hat: 'beret' } },
    { id: 'quill', name: 'Farmer Quill', fav: 'jelly', blurb: 'Feeds royal jelly to his prize pumpkins. Nobody asks.',
      look: { hair: ['#c0502a', '#8a3418'], skin: ['#f4d4b8', '#d8ac88'], shirt: ['#e08a3a', '#a85e22'], hat: 'straw' } },
  ];
  // What a regular gives you as your friendship grows (at that many hearts).
  //   coins  a thank-you worth this many of their favourite item at full price
  //   gems   rare, so only at full friendship
  const REGULAR_GIFTS = { 3: { coins: 20 }, 5: { gems: 2 } };
  const REGULAR_CHANCE = 0.12; // chance a new customer is a regular (if one is due)

  // Random tips the shopkeeper says when you tap them.
  const TIPS = [
    'Hives stop making honey when they are full. Tap a hive to send me out to collect it.',
    'Customers can only pay when someone is at the register. Hire a helper and put them on the Register duty.',
    'Richer customers show up as your reputation grows.',
    'Bees raising an egg in the Nursery take a break from making honey.',
    'At night the shop closes and most bees sleep. It is the perfect time to restock the shelves.',
    'The lunch rush starts around 11am. Fill the shelves before it hits.',
    'Tap the stars in the status bar to see exactly what raises and lowers your reputation.',
    'Long-press a bee in the Apiary tab and drag it onto another hive to move it.',
    'Moonmoth Bees and Night Owls keep working after dark while everyone else sleeps.',
    'Breeding two bees of the same species can raise vigor.',
    'Nurse Bees boost every bee in their hive.',
    'Waxwing Beeswax needs the Candle Machine before it can be sold as candles.',
    'Upgrades take time to build. Gems can finish them instantly.',
    'Seasons change every four days. Tap the season in the status bar to see what it does.',
    'Golden drips appear on hives now and then. Tap one for a bonus.',
  ];

  // ---------------------------------------------------------------------------
  // SEASONS: each lasts SEASON_DAYS in-game days and brings one twist.
  // `grass` is the garden's colours that season.
  // ---------------------------------------------------------------------------
  const SEASONS = [
    { id: 'spring', name: 'Spring', desc: 'Everything blooms: +20% honey from every bee.', prod: 0.2,
      grass: ['#72c458', '#5eae4a', '#8cd870', '#4e9e3e'], pad: '#8ab04a' },
    { id: 'summer', name: 'Summer', desc: 'Tourists in town: +25% customer visits.', customers: 0.25,
      grass: ['#6cbc54', '#5aa848', '#86d06c', '#4a9a3c'], pad: '#8ab04a' },
    { id: 'autumn', name: 'Autumn', desc: 'Harvest season: eggs hatch 30% faster.', breed: 0.3,
      grass: ['#a8b048', '#8e9a3a', '#c8b858', '#7a8a30'], pad: '#b0a050' },
    { id: 'winter', name: 'Winter', desc: 'Cozy demand: +20% prices, candles +50%. Bees slow down 10%.', price: 0.2, prod: -0.1, candle: 0.5,
      grass: ['#e8eef4', '#d4dce8', '#f8fbff', '#c0cad8'], pad: '#c8d0dc' },
  ];

  // Helper: turns a list into a lookup table by id, so the code can write
  // D.good.clover instead of searching the list every time.
  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

  HC.data = {
    SEASONS, GOODS, SPECIES, RECIPES, TRAITS, UPGRADES, HIVE_COSTS, HIVE_MAX_LEVEL, CUSTOMERS,
    HAIR, SHIRTS, SKIN, BEE_NAMES, REQUESTERS, REGULARS, REGULAR_GIFTS, REGULAR_CHANCE, TIPS, MACHINE, STAFF, TRAINING, DUTIES, REP, EVENTS, CATALOG, STORE_SECTIONS, GEMS,
    good: byId(GOODS),
    species: byId(SPECIES),
    upgrade: byId(UPGRADES),
    customer: byId(CUSTOMERS),
    staff: byId(STAFF),
    duty: byId(DUTIES),
    regular: byId(REGULARS),
    item: byId(CATALOG),
    DAY_LENGTH: 480, // real seconds in one in-game day (8 minutes)
    WAGE_SHARE: 0.05, // each helper's cut of yesterday's earnings (5%), on top of their base wage
    SEASON_DAYS: 4,
    OFFLINE_CAP: 8 * 3600, // bees and shop keep going for at most 8h while you're away
    FESTIVAL_AT: 1e7, // coins earned in one run before a Honey Festival is possible
    SAVE_KEY: 'honeycomb-corner-save-v1',
  };

  // Look up the recipe for a pair of species (in either order), or null.
  HC.data.recipeFor = function (a, b) {
    return RECIPES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || null;
  };
})();
