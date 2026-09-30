# How the code works (for non-coders)

This guide explains Honeycomb Corner's code in plain English: what each file is for, what happens when you tap something, and how to make common changes yourself. Every code file also has comments explaining what it does.

## The big picture

The game is a web page. A browser opens `index.html`, which loads 15 JavaScript files in order. Together they do four jobs:

| Job | Files | Analogy |
|---|---|---|
| **Remember** your game | `state.js` | The save file |
| **Decide** what happens | `data.js`, `sim.js`, `customers.js`, `workers.js`, `builds.js`, `goals.js`, `actions.js`, `nav.js` | The rulebook, the clock, and the people |
| **Show** it | `sprites.js`, `render.js`, `ui.js`, `style.css`, `audio.js` | The stage, the costumes, the programme |
| **Run** it | `main.js`, `util.js` | The stage manager |

The rules never touch the screen directly. When something happens they post a note on a shared message board (the *bus* in `util.js`), such as "a sale happened". The screen and speakers react to those notes. This separation is why the tests in `tools/` can run the whole game with no screen at all.

## What each file does

| File | In one sentence |
|---|---|
| `js/util.js` | Small helpers (random numbers, number formatting like 12.3K) and the message board. |
| `js/data.js` | **All the numbers and lists**: products, bee species, recipes, upgrade prices, staff, Store items, gem rewards, seasons. Most balance changes happen here. |
| `js/state.js` | Creates a new game, creates bees, saves and loads, and upgrades old saves to the current format. |
| `js/nav.js` | The map: named spots in the scene (register, storeroom, each hive, each shelf) joined by walkable paths, and the route-finder. |
| `js/sim.js` | The rules and formulas, and the `update` that moves time forward 20 times a second: bees make honey, the machine makes candles, eggs hatch, wages are paid, and so on. Also the fast-forward for time you spent away. |
| `js/customers.js` | Shoppers (walk in → browse → queue → pay → leave, or storm out if nobody's at the register) and the townsfolk who pin requests on the board. |
| `js/workers.js` | The shopkeeper and helpers. Each has a **duty** (Register, Shelves, Hives, Candles) and works through to-do lists of steps like "walk to Hive 2", "scoop honey", "walk to storeroom". |
| `js/builds.js` | Upgrade timers: pay now, wait, then the upgrade applies. Gems finish a timer early. |
| `js/actions.js` | Everything a button can do: buy a bee, hire staff, start an upgrade, deliver a request, buy a hat... |
| `js/goals.js` | The goal chain shown under the picture. |
| `js/sprites.js` | All the pixel art, drawn by code: people, bees, hives, icons, the tiny number font. |
| `js/render.js` | Paints the scene 60 times a second, and works out what you tapped. |
| `js/ui.js` | The menus, tabs, pop-ups, messages and tutorial text box. |
| `js/audio.js` | Chiptune sound effects and music, synthesised live. |
| `js/track.js` | Keeps private playtest notes (sessions, goal times, gem use) that "Send feedback" can include. |
| `js/main.js` | Loads your save, fast-forwards time you were away, runs the game loop and autosaves. |
| `css/style.css` | Colours, fonts and layout of the menus. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Let the game install to a phone's home screen and play offline. |

## Following one tap through the code

What happens when you tap a hive that has honey in it:

1. **`ui.js` → `onCanvasTap`** turns the tap's position into game-picture pixels.
2. **`render.js` → `hitTest`** says the tap landed on hive 0.
3. **`actions.js` → `collect(0)`** checks the hive has honey, then asks the workers system to queue the errand.
4. **`workers.js` → `orderCollect`** adds "collect hive 0" to the shopkeeper's errand list.
5. On the next update, the idle shopkeeper picks the errand up. **`collectJob`** builds the steps: walk to hive 0, scoop honey, walk to the storeroom, unload, walk back.
6. **`nav.js` → `route`** works out the walking path (out the door, along the street, up the garden path).
7. Each update moves the shopkeeper a little along the path (`moveAlong`), and **`render.js`** draws them there.
8. At the hive, **`sim.js` → `takeFromHive`** moves honey into their basket. At the storeroom, **`addToStore`** moves it into the storehouse.
9. While the shopkeeper is out, **`customers.js`** has shoppers wait in line, because `cashierPresent()` is false. If one waits too long, they walk out.
10. Later a customer pays: **`earn`** adds the coins, and a `'sale'` note on the bus makes **`audio.js`** play the coin sound.

## What your save file holds

Everything in `state.js → newGame()`. The main pieces:

- `coins`, `gems`, `rep` (reputation)
- `hives`: for each one, its level, the bees living in it, and the honey stored in it
- `bees`: every bee's species, name, vigor, trait and sparkle
- `store`: the storehouse. `shelves`: what each shelf sells and holds
- `up`: upgrade levels. `builds`: timers in progress
- `staff`: who's hired. `machine`: the Candle Machine
- `cos`: cosmetics you own, wear and have placed
- `time` (time of day) and `clock` (used by timers)

Walking customers, where the shopkeeper is standing, and floating "+45" numbers are **not** saved. They live in `HC.sim.rt` ("runtime") and simply restart on reload.

The save lives in the browser (`localStorage`). **Menu → Export save** turns it into a code you can paste on another device.

## Common changes: a cookbook

All of these are edits to `js/data.js` unless noted. After a change, run the checks in the next section.

**Change a product's price.** Find it in `GOODS` and edit `price`.

**Make an upgrade cheaper or pricier.** In `UPGRADES`: `base` is the first level's price, and `growth` multiplies it each level (2.3 means each level costs 2.3× the previous one). `max` is the top level.

**Make timers shorter or longer.** In `js/sim.js`, find `buildTime`. `12 * cost^0.38` sets the curve; change the `12` to scale every timer, or the `8 * 3600` to cap the longest one (in seconds). Breeding times are `breedTime`, just below `breedCost`.

**Change how much honey a hive holds.** In `js/sim.js`: `honeyCap: (h) => 16 + 12 * h.level`. That's 16 jars at level 1, plus 12 per level.

**Change staff wages or hiring fees.** In `STAFF`: `hire` and `wage`. Duties are in `DUTIES` just below.

**Change the helpers' share of earnings.** `WAGE_SHARE` near the bottom of `data.js` (0.05 = 5% each).

**Change helper training.** `TRAINING` in `data.js`: `per` is the bonus per level, `base` and `growth` set the prices, `max` the top level.

**Add a seasonal special.** Copy one of the `cat: 'seasonal'` lines in `CATALOG`, set its `season`, then add a drawing in `render.js` (see "Seasonal specials" there), a line in `drawActors` and an entry in `THUMB_BOX`.

**Change which goals flash a guide.** In `js/goals.js`, each goal's `guide` says which tab and button to flash; `GUIDED` is how many goals use it. `progress` adds a progress bar to a counting goal.

**Change how prices are rounded.** `nice` in `js/util.js`.

**Change the regulars.** `REGULARS` in `data.js`: name, favourite product, blurb and look. `REGULAR_GIFTS` sets what they give at each heart count, and `REGULAR_CHANCE` how often a customer is a regular.

**Add a seasonal bee.** Give a species a `season` (see the seasonal family in `SPECIES`); it works 80% harder then. The 1.8 is in `sim.js → beeRate`.

**Change reputation rules.** `REP` lists every reason reputation changes and by how much. The Reputation window reads it directly, so the explanation always matches.

**Change the lunch rush, today's special or the food critic.** `EVENTS`: times are fractions of a day (0 = 6am, 0.25 = noon). `spawnMult` 0.35 means customers arrive in 35% of the usual time; `priceMult` 1.3 means +30%.

**Change gem rewards.** The `GEMS` block: starting gems, gems per new species (by rarity), per festival, the chance a request or drip pays a gem, and how many seconds one gem skips (`secsPerGem`). Goal gems are `MILESTONE_GEMS` in `js/goals.js` (goal number → gems).

**Add a Store item.** Copy a line in `CATALOG` and give it a new `id`, a `name`, a `cat` (which Store section) and a `cost` like `{ coins: 500 }` or `{ gems: 10 }`.
- **Hats** also need a `value` and a drawing in `sprites.js → drawHat`.
- **Hair, shirts and aprons** just need `colors`.
- **Decorations** also need a drawing function and a line in `drawActors` in `render.js`, plus an entry in `THUMB_BOX` for the Store preview.

**Add a bee species.**
1. Add it to `SPECIES`: pick an `id`, colours, `secs` (speed) and a `good`.
2. If it makes a new product, add that to `GOODS`.
3. Add a recipe to `RECIPES` so it can be bred.
4. Optionally add a goal in `goals.js`.

**Add a goal.** In `js/goals.js`, add a line to `GOALS` with `text`, a `check` (for example `(s) => s.hives.length >= 3`), `reward` and `gems`.

**Change the length of a day.** `DAY_LENGTH` (seconds). Night is the last quarter of each day, set in `sim.js → isNight`. Which bees stay awake at night is `nightWorker` just below it.

**Change the shopkeeper's tips.** `TIPS`. **Change tutorial messages:** `HINTS` in `ui.js`.

## Checking your changes

These need Node.js (a free program for running JavaScript outside a browser). Run them from the `honeycomb-corner` folder:

```bash
node tools/test.js            # 41 automatic checks of the rules. Should say "41 passed".
node tools/balance.js 4 1 5   # plays 4 hours with a bot and prints when milestones happen
node tools/smoke.js out/      # opens the real game in a hidden browser, clicks around, saves screenshots
python3 tools/build.py        # bundles everything into one file: dist/honeycomb-corner.html
```

If `test.js` reports a failure, it names the rule that broke. That's usually a sign a change went further than intended.

## Glossary

- **Function**: a named set of instructions, like `collect(i)`. It's called ("run") by other code.
- **Object**: a bundle of named values, like a bee `{ name: 'Pip', sp: 'meadow', vigor: 1.05 }`.
- **`s`**: short for the save ("state"). Most functions take it as their first input.
- **`HC`**: the shared object every file attaches itself to (`HC.sim`, `HC.data`...).
- **Bus / event**: the message board. `emit('sale')` posts a note; `on('sale', ...)` listens for it.
- **Tick / update**: one small step of game time (0.05 seconds).
- **Canvas**: the pixel-drawing surface the scene is painted on.
- **Cache**: a saved copy kept so something doesn't have to be redone (sprites, offline files).
- **Runtime**: things that exist while the page is open but aren't saved.
