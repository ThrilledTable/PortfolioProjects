// Static game data: goods, bee species, breeding recipes, upgrades, customers.
// Tuning lives here so balance changes never touch the simulation code.
(function () {
  const HC = window.HC;

  // Goods are ordered by tier. `kind` picks the pixel icon shape.
  const GOODS = [
    { id: 'wildflower', name: 'Wildflower Honey', price: 5, kind: 'jar', fill: '#f8c838', lid: '#c8642a' },
    { id: 'clover', name: 'Clover Honey', price: 14, kind: 'jar', fill: '#f2e27c', lid: '#4c9a3c' },
    { id: 'candle', name: 'Beeswax Candle', price: 40, kind: 'candle', fill: '#f6e6b2', lid: '#a86a32' },
    { id: 'orange', name: 'Orange Blossom Honey', price: 110, kind: 'jar', fill: '#f59a24', lid: '#f4ecd8' },
    { id: 'lavender', name: 'Lavender Honey', price: 300, kind: 'jar', fill: '#c6a0e8', lid: '#6a48a8' },
    { id: 'jelly', name: 'Royal Jelly', price: 850, kind: 'pot', fill: '#fff2cc', lid: '#d8a020' },
    { id: 'moon', name: 'Moonlight Honey', price: 2400, kind: 'vial', fill: '#98aef0', lid: '#2a2a58' },
    { id: 'golden', name: 'Golden Nectar', price: 7000, kind: 'vial', fill: '#ffd23a', lid: '#b07a10' },
    { id: 'crystal', name: 'Crystal Comb', price: 20000, kind: 'comb', fill: '#a4eef0', lid: '#2a7890' },
    { id: 'star', name: 'Starlight Honey', price: 60000, kind: 'jar', fill: '#fff0a0', lid: '#5a3aa0' },
  ];
  GOODS.forEach((g, i) => (g.tier = i));

  // `secs` = seconds per unit at 100% vigor. Value/sec roughly doubles per tier.
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
      id: 'waxwing', name: 'Waxwing Bee', good: 'candle', secs: 14, tier: 2, rarity: 'Uncommon',
      body: '#f2e2b0', stripe: '#8a6a3a', wing: '#fff6e0', mark: 'drop',
      flavor: 'Builds comb so neat the shop sells the wax. The hive smells like a candle shop.',
      hint: 'Something waxy comes from a meadow bee and a clover bee.',
    },
    {
      id: 'citrus', name: 'Citrus Bee', good: 'orange', secs: 18, tier: 3, rarity: 'Uncommon',
      body: '#f89a28', stripe: '#5a2a10', wing: '#fff0dc', mark: 'flower',
      flavor: 'Always smells faintly of orange peel. Customers ask where it goes on holiday.',
      hint: 'A clover bee and a waxwing, left alone together, get zesty.',
    },
    {
      id: 'scout', name: 'Scout Bee', good: 'clover', secs: 24, tier: 3, rarity: 'Uncommon',
      body: '#e8c85a', stripe: '#3a5a8a', wing: '#e6f2ff', mark: 'band',
      aura: { customers: 0.06 },
      flavor: 'Flies laps around town telling everyone about the shop. Each one in a hive brings in 6% more customers.',
      hint: 'A homebody meadow bee paired with a well-travelled citrus bee.',
    },
    {
      id: 'lavender', name: 'Lavender Bee', good: 'lavender', secs: 24, tier: 4, rarity: 'Rare',
      body: '#b890e0', stripe: '#3a2458', wing: '#f2eaff', mark: 'flower',
      flavor: 'Calm, a little dreamy. Its hive is the quietest in the garden.',
      hint: 'Pair a waxwing with a citrus bee.',
    },
    {
      id: 'nurse', name: 'Nurse Bee', good: 'wildflower', secs: 20, tier: 4, rarity: 'Rare',
      body: '#f4d4dc', stripe: '#b04a6a', wing: '#fff0f4', mark: 'cross',
      aura: { hive: 0.2 },
      flavor: 'Barely makes honey itself. Keeps every hive-mate fed and fussed over: +20% output for the whole hive.',
      hint: 'Humble meadow stock raised beside royalty.',
    },
    {
      id: 'royal', name: 'Royal Bee', good: 'jelly', secs: 30, tier: 5, rarity: 'Rare',
      body: '#f0c030', stripe: '#6a1a2a', wing: '#fff4e0', mark: 'crown',
      flavor: 'Expects to be addressed properly. Produces royal jelly and a lot of opinions.',
      hint: 'A lavender bee and a waxwing, if the mood is right.',
    },
    {
      id: 'moonmoth', name: 'Moonmoth Bee', good: 'moon', secs: 38, tier: 6, rarity: 'Epic',
      body: '#7a8ad8', stripe: '#1e1a40', wing: '#d8d0ff', mark: 'moon',
      nightBonus: 0.6,
      flavor: 'Sleeps through the afternoon. Works 60% harder after dark.',
      hint: 'Lavender dreams plus citrus warmth, sometime after sunset.',
    },
    {
      id: 'golden', name: 'Golden Bee', good: 'golden', secs: 48, tier: 7, rarity: 'Epic',
      body: '#ffd84a', stripe: '#a8781a', wing: '#fff8d0', mark: 'gem',
      flavor: 'Glints in direct sunlight. Nobody knows where it finds the nectar.',
      hint: 'Royalty courting the moon.',
    },
    {
      id: 'crystal', name: 'Crystal Bee', good: 'crystal', secs: 60, tier: 8, rarity: 'Legendary',
      body: '#96e6f0', stripe: '#2a6a80', wing: '#f0ffff', mark: 'gem',
      flavor: 'Builds comb that rings like glass when you tap it.',
      hint: 'Gold and moonlight, crystallised.',
    },
    {
      id: 'star', name: 'Starlight Bee', good: 'star', secs: 75, tier: 9, rarity: 'Legendary',
      body: '#fff2a8', stripe: '#5a3aa0', wing: '#fffbe0', mark: 'star',
      flavor: 'Appears on clear nights. Old keepers say it followed a comet down.',
      hint: 'Crystal clarity and a golden heart.',
    },
  ];

  // Unordered pairs. `p` is the chance the egg is the new species; otherwise it
  // takes after one of the parents.
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

  const TRAITS = {
    diligent: { name: 'Diligent', desc: '+15% output', prod: 0.15 },
    nightowl: { name: 'Night Owl', desc: '+50% output at night', night: 0.5 },
    earlybird: { name: 'Early Bird', desc: '+25% output by day', day: 0.25 },
    lucky: { name: 'Lucky', desc: 'Triples sparkle chance for its eggs', lucky: 3 },
    charming: { name: 'Charming', desc: '+3% customers while in a hive', customers: 0.03 },
  };

  // Shop-wide upgrades. cost = base * growth^level.
  const UPGRADES = [
    { id: 'shelf', name: 'Extra Shelf', base: 80, growth: 4.2, max: 7, desc: () => 'Adds a shelf for another product.' },
    { id: 'samples', name: 'Tasting Samples', base: 120, growth: 2.5, max: 10, desc: () => 'Customers buy 10% more items.' },
    { id: 'sign', name: 'Painted Sign', base: 150, growth: 2.3, max: 20, desc: () => '+15% customer visits.' },
    { id: 'labels', name: 'Fancy Labels', base: 200, growth: 2.15, max: 25, desc: () => '+8% sale prices.' },
    { id: 'register', name: 'Brass Register', base: 300, growth: 2.6, max: 8, desc: () => 'Checkout 12% faster.' },
    { id: 'flowers', name: 'Flower Beds', base: 250, growth: 2.3, max: 20, desc: () => '+8% honey from every bee.' },
    { id: 'storage', name: 'Bigger Storehouse', base: 100, growth: 2.25, max: 20, desc: () => '+60% storage per product.' },
    { id: 'cart', name: 'Honey Cart', base: 1500, growth: 3, max: 8, desc: (lv) => 'Sells storehouse overflow at ' + (lv ? 20 + lv * 5 : 20) + '% price instead of wasting it.' },
    { id: 'beebox', name: 'Bigger Bee Box', base: 400, growth: 2.8, max: 10, desc: () => '+4 bee box spaces.' },
    { id: 'nursery', name: 'Nursery Cradle', base: 3000, growth: 12, max: 2, desc: () => '+1 breeding slot.' },
  ];

  const HIVE_COSTS = [0, 200, 1200, 8000, 120000, 1500000];
  const HIVE_MAX_LEVEL = 5;

  // `offset` controls what a customer can afford relative to the best product
  // on display: offset 0 can afford the top shelf, 3 only goods three tiers down.
  const CUSTOMERS = [
    { id: 'villager', name: 'Villager', weight: 50, offset: 3, units: [1, 2], hat: null },
    { id: 'hiker', name: 'Hiker', weight: 20, offset: 2, units: [2, 3], hat: 'cap', shirt: ['#4a8a3a', '#2e5e26'] },
    { id: 'chef', name: 'Chef', weight: 12, offset: 1, units: [1, 3], hat: 'chef', shirt: ['#f4f0e8', '#c8c0b0'] },
    { id: 'noble', name: 'Noble', weight: 5, repWeight: 3, offset: 0, units: [1, 2], hat: 'tophat', shirt: ['#6a3a8a', '#44245e'] },
    { id: 'collector', name: 'Collector', weight: 1, repWeight: 1.5, offset: 0, units: [1, 1], mult: 1.5, hat: 'beret', shirt: ['#2a6a6a', '#1a4444'] },
  ];

  const HAIR = [
    ['#6a3e1e', '#4a2a12'], ['#2a2222', '#161010'], ['#e8c060', '#b89040'],
    ['#c0502a', '#8a3418'], ['#d8d0c8', '#a8a098'], ['#8a5a8a', '#5e3a5e'],
  ];
  const SHIRTS = [
    ['#3a8ab0', '#266080'], ['#c84a4a', '#8e2e2e'], ['#e08a3a', '#a85e22'],
    ['#5a6ab8', '#3a4888'], ['#d86aa0', '#a04878'], ['#7a9a4a', '#56702e'],
  ];
  const SKIN = [['#f8c898', '#d89868'], ['#e0a878', '#b87c50'], ['#b07850', '#86563a'], ['#f4d4b8', '#d8ac88']];

  const BEE_NAMES = [
    'Bumble', 'Waggle', 'Pollen', 'Clementine', 'Hexa', 'Juniper', 'Marigold', 'Buzz', 'Nectarine',
    'Dandelion', 'Comfrey', 'Poppy', 'Fennel', 'Sorrel', 'Basil', 'Tansy', 'Yarrow', 'Thistle', 'Zinnia',
    'Hazel', 'Pip', 'Mabel', 'Otto', 'Figaro', 'Beatrix', 'Honeydew', 'Sage', 'Wren', 'Clover', 'Aster',
    'Biscuit', 'Nutmeg', 'Saffron', 'Quince', 'Ginger', 'Tulip', 'Rosie', 'Barnaby', 'Fizz', 'Dot',
  ];

  const REQUESTERS = [
    'Mrs. Pemberton', 'The Bakery on Elm', 'Coach Reyes', 'Old Man Hollis', 'Town Hall', 'The Tea Room',
    'Dr. Okafor', 'Harbor Inn', 'Little Library', 'Farmer Quill', 'Miss Delacroix', 'The Candle Guild',
  ];

  const TIPS = [
    'Customers only buy what is on a shelf. Keep your best products stocked.',
    'Richer customers show up as your reputation grows.',
    'Breeding two bees of the same species can raise vigor.',
    'Nurse Bees boost every bee in their hive.',
    'Moonmoth Bees and Night Owls do their best work after dark.',
    'The Honey Cart turns storehouse overflow into coins.',
    'Seasons change every four days. Tap the season in the status bar to see what it does.',
    'Golden drips appear on hives now and then. Tap one for a bonus.',
  ];

  // Each season lasts SEASON_DAYS in-game days and brings one twist.
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

  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

  HC.data = {
    SEASONS, GOODS, SPECIES, RECIPES, TRAITS, UPGRADES, HIVE_COSTS, HIVE_MAX_LEVEL, CUSTOMERS,
    HAIR, SHIRTS, SKIN, BEE_NAMES, REQUESTERS, TIPS,
    good: byId(GOODS),
    species: byId(SPECIES),
    upgrade: byId(UPGRADES),
    customer: byId(CUSTOMERS),
    DAY_LENGTH: 480, // seconds per in-game day
    SEASON_DAYS: 4,
    OFFLINE_CAP: 8 * 3600,
    FESTIVAL_AT: 1e7,
    SAVE_KEY: 'honeycomb-corner-save-v1',
  };

  HC.data.recipeFor = function (a, b) {
    return RECIPES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || null;
  };
})();
