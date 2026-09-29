# Honeycomb Corner: design notes and path to the app stores

## Positioning

| | Idle Bee Factory Tycoon (incumbent) | Honeycomb Corner |
|---|---|---|
| Presentation | Abstract factory, machines and numbers | A small-town shop with customers who walk in and buy |
| Depth | Unlock more bee types by paying | 12 species found through breeding, plus vigor, traits and sparkles |
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

## Balance targets (from `tools/balance.js`)

An optimal bot reaches the milestones below. Humans are expected to take 1.5–2× longer.

| Milestone | Bot time |
|---|---|
| First Clover Bee | about 4 min |
| First new species (Waxwing) | about 7–11 min |
| Lavender | about 35 min |
| Royal | about 80 min |
| Starlight (last species) | about 2–2.3 h |
| First festival available (₵10M) | about 1.5 h |

The idle curve is intentionally short for a prototype. For a store release, stretch the late game by roughly 3–5×, mostly through breed times and hive costs in `js/data.js` and `js/sim.js`.

## Roadmap to a store build

1. **Playtest** the Artifact or a GitHub Pages build with 5–10 people and note where they get stuck. The goals chain is the first thing to tune.
2. **Wrap with Capacitor.** The folder is already a PWA with a manifest, icons and a service worker. Add native storage (Capacitor Preferences) alongside localStorage, since iOS can evict web storage.
3. **Add an analytics hook** (first session length, day-1 return, goal step reached). One `track(event)` call in `HC.bus` handlers would cover it.
4. **Content pass**: more species (aim for 24+), named regular customers, and one more seasonal event per season.
5. **Store assets**: record screenshots and video from the canvas, which has native pixel-perfect framing.

## IP guardrails

The look borrows the *era* of handheld RPG town shops, not any franchise. Keep avoiding:
- "Poké-" or "-mon" naming, creature balls, a "-dex" name for the guide (it's the *Field Guide*)
- Blue-roofed shops, or anything resembling a franchise mart
- Silhouettes or palettes that resemble existing creatures
