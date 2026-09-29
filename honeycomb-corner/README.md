# Honeycomb Corner

A cozy pixel-art idle game prototype. You keep bees in a garden, breed new species and run a honey shop where townsfolk walk in and buy what's on your shelves.

It combines the proven bee-factory idle loop with the look and feel of a GBA-era town shop. All art, music and characters are original and drawn in code. Nothing is borrowed from any existing game.

**Play:** open `index.html` in a browser, or the single-file build `dist/honeycomb-corner.html`. There's no install and no build step.

## Install on a phone

Serve the folder from any static host (GitHub Pages works) and open it in a phone browser, then choose **Add to Home Screen**. The game ships a web manifest, icons and a service worker, so it installs like an app and plays offline. The same folder is ready to wrap with Capacitor for the App Store and Play Store.

## The loop

```
bees gather ─► jars in the storehouse ─► shelves ─► customers buy ─► coins
     ▲                                                                 │
     └── new hives · upgrades · breeding rarer bees ◄──────────────────┘
```

- **Apiary**: up to 6 hives. Each can be upgraded to 8 bees and +75% output. Buy Meadow and Clover bees at the Bee Market.
- **Shop**: up to 8 shelves, each stocking one product. Customers walk in, browse, queue at the register and pay. Richer customers (chefs, nobles, collectors) show up as reputation grows, and they can afford pricier goods.
- **Nursery**: pair two bees to raise an egg. Different species can hatch something new; there are 10 recipes across 12 species. Same-species pairs pass on and slowly improve **vigor**. Eggs can roll a **trait** (Diligent, Night Owl, Lucky…). About 1 in 80 hatch as a **sparkle**, with double output and a rose-gold coat. A pity timer guarantees a recipe after 4 misses.
- **Town**: timed requests pay 2.5× market value plus reputation. A travelling merchant sometimes parks outside selling a rare bee, occasionally one you haven't discovered.
- **Honey Festival** (prestige): after ₵10M earned in a run, reset for permanent ribbons (+10% sale prices each). You keep the Field Guide and one keepsake bee.
- **Day/night cycle**: an 8-minute day. Moonmoth Bees and Night Owls work harder after dark, and the shop's lamps come on.
- **Seasons**: each lasts 4 in-game days (32 minutes). Spring gives +20% output, summer +25% customers, and in autumn eggs hatch 30% faster. Winter brings +20% prices and +50% on candles, but bees slow down 10%. Each season has its own grass, flowers and weather.
- **Golden drips**: a drop appears on a hive every minute or two. Tap it within 12 seconds for about 30 seconds' worth of income.
- **Goals**: a chain of 26 goals with rewards guides the first few hours.
- **Idle**: production and sales continue while you're away, at 60% speed for up to 8 hours. A report shows what happened when you return.

Special bees add composition choices. Nurse Bees give +20% to every bee in their hive, and Scout Bees bring in +6% more customers.

## Design notes

- **Resolution:** the scene renders at 240×160, the GBA's native resolution, and scales up with crisp pixels. In-scene numbers use a hand-made 3×5 bitmap font.
- **IP safety:** the goal was the *era* (a pixel town shop, chiptune music, retro text boxes), not anyone's brand. The shop has an orange roof and a honey theme; there are no creature balls, no "-dex", and no borrowed silhouettes.
- **Pacing** comes from `tools/balance.js`, which plays the real simulation headlessly with a greedy bot. Current bot timings are clover at about 4 min, waxwing about 8, lavender about 35, royal about 80, golden about 90 and starlight about 130. A human should take roughly 1.5–2× longer. A goal chain of 26 steps guides the whole arc.
- **Market context:** the leading bee idle game (Green Panda's *Idle Bee Factory Tycoon*, about 39M Android downloads) is an abstract factory with aggressive ads. This prototype tests whether a warmer, character-driven presentation plus real breeding depth stands out.

## Code map

| File | What it does |
|---|---|
| `js/data.js` | All tuning: goods, species, recipes, traits, upgrades, customers |
| `js/state.js` | New game, bee factory, save/load/migrate, export/import |
| `js/sim.js` | Formulas, production, customer AI and pathing, nursery, orders, merchant, offline catch-up |
| `js/actions.js` | Player actions (buy, breed, move, deliver, festival) |
| `js/sprites.js` | Pixel art from code and tiny grids: characters, bees, icons, hive, bitmap font |
| `js/render.js` | Canvas scene, y-sorted actors, lighting, hit-testing |
| `js/ui.js` | HUD, tab panels, modals, tutorial text box, live bindings |
| `js/audio.js` | WebAudio chiptune SFX and music loop |
| `js/main.js` | Boot, fixed-step loop, autosave, away-time catch-up |

The sim never touches the DOM; it emits events on `HC.bus`, which is why it runs headlessly under Node for balance testing.

## Dev tools

```bash
node tools/balance.js 4 2 [5]    # simulate 4h of play, 2 runs, bot acting every [5]s; prints milestones
node tools/test.js               # mechanics tests (Node, no browser)
node tools/smoke.js out/         # Playwright: flows, audio, festival, away report; fails on console errors
node tools/phone-walkthrough.js out/  # tap-only opening minutes at 390x844, screenshots each step
python3 tools/build.py           # bundle into dist/honeycomb-corner.html
node tools/make-icons.js         # regenerate icons/ from the game's own sprites
```

## Ideas for next steps

- Seasons, with flower types that favour certain species
- Hive decorations and shop cosmetics (a non-intrusive monetisation path)
- Customer regulars with names and preferences
- Achievements and a daily request streak
- Touch-and-drag bee management
- Wrapping the PWA for the app stores with Capacitor
