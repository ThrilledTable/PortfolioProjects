# Honeycomb Corner

A cozy pixel-art idle game prototype. You keep bees in a garden, carry their honey into your little shop, and sell it to the townsfolk who walk in. Along the way you breed new species, hire staff, and decorate.

It combines the proven bee-factory idle loop with the look and feel of a GBA-era town shop. All art, music and characters are original and drawn in code. Nothing is borrowed from any existing game.

**Play:** open `index.html` in a browser, or the single-file build `dist/honeycomb-corner.html`. There's no install and no build step.

**New to the code?** Read [docs/HOW-THE-CODE-WORKS.md](docs/HOW-THE-CODE-WORKS.md). It's written for non-coders and includes a cookbook of common changes.

## Install on a phone

Serve the folder from any static host (GitHub Pages works) and open it in a phone browser, then choose **Add to Home Screen**. The game ships a web manifest, icons and a service worker, so it installs like an app and plays offline. The same folder is ready to wrap with Capacitor for the App Store and Play Store.

## The loop

```
bees fill their hive ─► shopkeeper walks out, collects ─► storehouse ─► shelves
        ▲                                                                │
        │                     customers queue at the register ◄─────────┘
        │                     (someone must be there to take payment)
        └── hives · timed upgrades · staff · breeding · candle machine ◄── coins
```

- **Hives fill up.** Each hive holds a limited amount of honey (16 jars, +12 per level). When it's full, its bees stop working until someone collects.
- **You carry the honey.** Tap a hive and the shopkeeper walks out through the door, down the garden path, scoops the honey, and carries it to the storeroom. They also carry stock from the storeroom to the shelves.
- **The register needs a person.** Customers can only pay while someone stands at the register. While the shopkeeper is out, the line waits. Customers who wait too long put their items back and walk out, and reputation drops.
- **Guided start.** For the first 15 goals, the button you need flashes with a gold ring and the rest of the page dims (the tab first, if it's on another tab). Counting goals ("Sell 1,000 items") show a progress bar. Turn the guide off in Settings.
- **Helpers with duties.** Hire up to four helpers (Rosa, Theo, Mabel, Otis). Each is paid a base wage every morning **plus 5% of what the shop earned the day before** (miss a payday and someone quits). Nobody is locked into one job: in **Shop → Staff**, tap a duty button to assign each person, including the shopkeeper:
  - **Register:** stays at the register. Two people on the Register ring up faster. At night, restocks the shelves.
  - **Stock shelves:** keeps the shelves full.
  - **Collect honey:** fetches honey from the hives, including while you're away.
  - **Candle Machine:** loads wax and carries candles out.
- **Daily rhythm.** Around midday the **lunch rush** brings customers in about three times faster. Each morning one product becomes **today's special** (+30% price, customers look for it first; starts once you sell two products). On some days a **food critic** visits: stocked shelves and a short wait earn a big reputation boost and gems, otherwise a bad review.
- **Reputation is explained.** Tap the stars in the status bar for every rule that raises or lowers it, and a log of today's changes by reason. A red star floats up in the scene whenever it drops.
- **Move bees by dragging.** In the Apiary tab, long-press a bee and drag it onto another hive, onto another bee (they swap), or into the Bee box.
- **Candles need a machine.** Waxwing Bees make raw Beeswax. The Candle Machine turns it into candles, but someone has to load the wax and carry the candles out.
- **Everything is built over time.** Upgrades, new hives, hive upgrades and the machine are timed builds: under a minute early on, up to 4 hours late in the game. You have one builder, so one thing at a time. Finish early with gems, or pay the builder **overtime** in coins (twice the unfinished share of the build's price). A second builder is planned as an optional paid unlock in a full release.
- **Gems** are earned in-game only: from goals, requests, new species, seasons, festivals and golden drips. Spend them to finish a timer early or buy special cosmetics.
- **Nursery:** pair two bees to raise an egg. The parents rest (no honey) until it hatches. There are 12 species and 10 recipes, plus vigor, traits and rare sparkle variants. A pity timer guarantees a recipe after 4 misses.
- **The town:** townsfolk walk up to the board outside the shop and pin requests, which pay 2.5× market value and sometimes gems. A travelling merchant sometimes parks outside with a rare bee.
- **Night:** the shop closes, no customers come, and most bees go to sleep (Moonmoths and Night Owls keep working). Whoever is on the Register restocks the shelves for the morning.
- **Seasons:** each lasts 4 in-game days (32 minutes) and brings one twist, plus its own grass, flowers and weather.
- **Store:** hats, hair, shirts and aprons for your shopkeeper. Shop and garden decorations that appear in the scene, many with a small bonus. Wallpaper, floors, and hive styles.
- **Style each hive separately:** tap "Style" on a hive in the Apiary tab. (Choosing a style in the Store restyles every hive.)
- **Prices are round numbers** (260, not 264).
- **Hives grow as you upgrade them:** more boxes, a peaked roof, a flower box, then a gold pennant. **Flower Beds** plant visible beds in the garden.
- **Goals:** a chain of 33 goals that teaches the loop and pays coins and gems.
- **Honey Festival** (prestige): after ₵10M earned in a run, start fresh for permanent ribbons (+10% sale prices each) and gems. You keep cosmetics, gems, the Field Guide and one keepsake bee.
- **Away time:** production continues for up to 8 hours; timers keep running beyond that. Hives cap out unless you've hired a Collector. A report shows what happened when you return.

## Pacing

These come from `tools/balance.js`, a bot playing the real game. A human will be slower.

| Milestone | Bot time |
|---|---|
| First Clover Bee, first helper | about 15–27 min |
| First five goals done | about 28–35 min |
| Candle Machine built | about 21–33 min |
| Lavender | about 50–77 min |
| Royal | about 2.1–2.7 h |
| Starlight (last species) | about 3.5–4.0 h |

The bot also prints how much money sits unspent. After playtest 3 it stays around 2–20% of everything earned (it was 60–80% after the first hour).

## Design notes

See [docs/DESIGN.md](docs/DESIGN.md) for positioning, monetisation options and the roadmap to a store build.

- **Resolution:** the scene renders at 240×160, the GBA's native resolution, and scales up with crisp pixels.
- **IP safety:** the goal was the *era* (a pixel town shop, chiptune music, retro text boxes), not anyone's brand. There are no creature balls, no "-dex", no blue-roofed marts and no borrowed silhouettes.
- **Market context:** the leading bee idle game (Green Panda's *Idle Bee Factory Tycoon*, about 39M Android downloads) is an abstract factory with aggressive ads. This prototype tests whether a warmer, character-driven presentation plus real breeding depth stands out.

## Code map

| File | What it does |
|---|---|
| `js/data.js` | All tuning: products, species, recipes, upgrades, staff, Store catalogue, gems |
| `js/state.js` | New game, bee creation, save/load/migrate, export/import |
| `js/nav.js` | Scene layout, walking network and route-finding |
| `js/sim.js` | Formulas, honey production, candle machine, nursery, town, wages, the main update, away-time catch-up |
| `js/customers.js` | Shopper behaviour (queue, patience, walk-outs) and request-pinning townsfolk |
| `js/workers.js` | Shopkeeper and staff jobs as step lists |
| `js/builds.js` | Timed construction and gem skips |
| `js/actions.js` | Every player action |
| `js/goals.js` | The goal chain |
| `js/sprites.js` | Pixel art drawn from code: people, bees, hives, icons, bitmap font |
| `js/render.js` | The scene, y-sorting, lighting, decorations, tap detection |
| `js/ui.js` | Status bar, tabs, pop-ups, tutorial, live values |
| `js/audio.js` | Synthesised chiptune effects and music |
| `js/main.js` | Start-up, fixed-step game loop, autosave |

The rules never touch the page; they post events on `HC.bus`. That's why the whole game runs headlessly under Node for tests and balance runs.

## Dev tools

```bash
node tools/test.js                    # 36 mechanics tests (Node, no browser)
node tools/balance.js 4 1 5           # simulate 4h, 1 run, bot acting every 5s; prints milestones
node tools/smoke.js out/              # headless browser: every flow, audio, festival, away report
node tools/phone-walkthrough.js out/  # tap-only opening minutes at phone size, screenshots
node tools/lategame.js out/           # ~3 simulated hours in the real page, then screenshots
python3 tools/build.py                # bundle into dist/honeycomb-corner.html
node tools/make-icons.js              # regenerate icons/ from the game's own sprites
node tools/sprite-sheet.js out.png    # every bee portrait on one sheet
```

## Ideas for next steps

- Named regular customers with favourite products
- Staff levels (faster walking, bigger baskets)
- Achievements and a daily request streak
- Wrapping the PWA for the app stores with Capacitor
