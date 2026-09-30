# Honeycomb Corner: design notes and path to the app stores

## Positioning

| | Idle Bee Factory Tycoon (incumbent) | Honeycomb Corner |
|---|---|---|
| Presentation | Abstract factory, machines and numbers | A small-town shop with customers who walk in and buy |
| Depth | Unlock more bee types by paying | 16 species found through breeding, plus vigor, traits and sparkles |
| Session hook | Upgrade taps | Goals, requests, golden drips, a merchant, seasons |
| Monetisation | Heavy interstitial and rewarded ads (the main complaint in reviews) | Undecided; see below |
| Audience | Hypercasual | Cozy and collector players, including adults who grew up on GBA-era games |

Sources for the incumbent: AppBrain (about 39M downloads, 4.7★ from about 480k ratings), Sensor Tower (about 300k downloads a month), and AppGrooves reviews complaining about ads. These are tracker estimates, not official figures.

## What the prototype is testing

1. **Does the shop front end make the idle loop more engaging?** Watch session length and how often players open the Shop tab.
2. **Is breeding the long-term hook?** Watch the Field Guide completion curve, eggs per session and how many players chase sparkles.
3. **Does the presentation stand out in a store listing?** The 240×160 scene is built to look good in screenshots.

## Monetisation options (not implemented)

Ranked by fit with a cozy audience:

1. **Premium price, $2.99–4.99.** The simplest option and fits the tone. It limits reach but avoids the incumbent's main complaint.
2. **Free with a one-time "Supporter" unlock**, e.g. 2× offline earnings, an extra nursery cradle and a cosmetic shop sign.
3. **Cosmetics**: shop wallpaper, hive roof colours, keeper outfits. The renderer already swaps palettes, so this is cheap to add.
4. **Opt-in rewarded ads only**, e.g. "watch to double this golden drip". Never forced interstitials.

**Gems today** are earned in-game only: from goals, requests, species discoveries, seasons, festivals and drips. They are spent on timer skips (1 gem per 2 minutes left) and premium cosmetics. Golden drips are a free bonus and are **not** gated behind ads; if ads were ever added, the only fitting form is an optional "watch to double this drip" button. That economy is already shaped so a gem store could be added later without redesigning anything. The honest recommendation stays options 1 or 2: a paid gem store would push the design toward long timers, which is exactly what makes the incumbent frustrating.

**Builders.** The game has one builder, deliberately: choosing what to build next is a real decision. A second builder is the natural paid unlock (a one-off purchase, not a gem sink), so the prototype shows it locked.

## Keeping it engaging after automation (playtest 2)

Hiring a cashier used to remove the main tension. Now:
- **Limited hands, assignable duties.** Four duties, a keeper and up to four helpers who cost wages. Early on you choose what to cover; later you rebalance as the shop grows (e.g. two on the Register for the rush).
- **A daily rhythm.** Morning: today's special (rearrange shelves). Midday: lunch rush (have shelves full, double up the Register). Some days: a food critic (keep everything stocked). Night: bees sleep and the shop restocks.
- **Readable reputation.** Every change is logged with its reason, so players know what to fix.

## Economy (playtest 3: "too many gems, too much money")

The bot showed that after about 90 minutes, 60–80% of all coins earned sat unspent. Late upgrades take 20–40 minutes each and there's one builder, so money had nowhere to go. Changes:
- **Wages scale with success:** base wage + 5% of yesterday's earnings per helper (up to 20% with four helpers). A dusk warning appears if you can't cover the morning wages.
- **Coin sinks that don't use the builder** (playtest 4): helper training (two tracks of 10 levels per helper) and seasonal specials sold only in their season (₵25K to ₵4M). Shop Expansion adds a builder upgrade for bigger shelves.
- **Builds are never finished with coins.** Long builds are meant to feel long; gems are the only shortcut, which is also where a gem store would earn money. (A short-lived coin "overtime" option was removed.)
- **Fewer gems:** start 10 (was 15), roughly half the gems from goals, species, seasons, requests, drips, the critic and festivals.
- **Steeper hive upgrades** for later hives and levels.

Result: unspent money stays around 5–15% of earnings, with overall pacing about the same. (Part of the original 60–80% came from a bug in the balance bot, which stalled whenever its cheapest option needed the busy builder.)

**Gems are rare (playtest 5).** Only milestone goals (every fifth), uncommon-or-rarer species (1–4 by rarity), a good critic review (2), 1-in-20 requests, 1-in-33 drips and festivals (15) pay gems; you start with 5. The bot earns about 10 in its first hour and 25 by hour two, while a 10-minute build costs 5 gems to skip. Timers were roughly doubled at the same time (`12·cost^0.38`, 45 s to 8 h; eggs ×1.5).

**On a paid gem store.** Playtest 4 chose gems as the way to skip long builds, which makes a gem store the likely business model. The risk to watch: the market leader's reviews complain about monetisation pressure. Keep timers generous enough that waiting stays pleasant, never sell gems-only progression, and keep earning gems through play.

## Balance targets (from `tools/balance.js`)

After the first playtest the loop was deliberately slowed. Honey has to be collected by hand, the register needs a person, upgrades are timed, and the shop closes at night. After the second, most bees also sleep at night, which slowed the early game by roughly a third. An attentive bot now reaches:

| Milestone | Bot time |
|---|---|
| First Clover Bee | about 15–25 min |
| First five goals | about 25–34 min |
| Candle Machine | about 29–50 min |
| Third helper (hands-off collection) | about 30–53 min |
| Starlight (last species) | about 3.8–4.0 h |
| First festival available (₵10M) | about 3 h |

The intended arc is **hands-on early, automated later**. For roughly the first half hour you walk out to the hives yourself and watch the register. Staff then take the chores over, and the game shifts to breeding, building and decorating. Timers were lengthened after playtest 5: about a minute early on, tens of minutes by mid-game, up to 8 hours at the very top.

## Roadmap to a store build

1. **Playtest** the Artifact or a GitHub Pages build with 5–10 people and note where they get stuck. The goals chain is the first thing to tune.
2. **Wrap with Capacitor.** Scaffolded in `native/` (see its README), including native save backup via Capacitor Preferences, since iOS can evict web storage.
3. **Playtest analytics**: done as private notes in `js/track.js`, shared only via "Send feedback" (Netlify Forms on the playtest site). The gem store plan in `docs/GEM-STORE.md` depends on what they show.
4. **Content pass**: done in part (16 species with a seasonal family, six named regulars, two alternating sets of seasonal specials). Still to do: more species (aim for 24+) and one more seasonal event per season.
5. **Store assets**: record screenshots and video from the canvas, which has native pixel-perfect framing.

## IP guardrails

The look borrows the *era* of handheld RPG town shops, not any franchise. Keep avoiding:
- "Poké-" or "-mon" naming, creature balls, a "-dex" name for the guide (it's the *Field Guide*)
- Blue-roofed shops, or anything resembling a franchise mart
- Silhouettes or palettes that resemble existing creatures
