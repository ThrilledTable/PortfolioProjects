# Gem store: a sketch, not built yet

This is a plan for selling gems, to be decided with playtest data, not
before. Nothing here is in the game.

## Why wait for data

Two numbers decide whether a gem store will earn money or just annoy people.
The playtest notes (`js/track.js`, sent with "Send feedback") collect both:

| Signal | What it tells us | Where |
|---|---|---|
| `gemStarved` / `gemStarvedOnGoals` | How often, and at which goal, players tapped "Finish" without enough gems: the moment a purchase would happen | track.js |
| `gemSkips`, `gemsSpentOnSkips` | Whether players value skipping enough to spend the gems they earn | track.js |
| `cameBackNextDay`, `avgSessionMinutes` | Whether they stay long enough for a store to matter | track.js |
| "When did it get boring or feel slow?" | Whether timers already feel like a wall (bad) or like anticipation (good) | feedback form |

**Rule of thumb:** if most testers are gem-starved before goal 10, the timers
are too aggressive for a first impression and will cost reviews. The target
is players *wanting* to skip in the mid game while still enjoying the wait.

## The shape of a store (draft)

- **Three or four bundles** at standard store price points (Apple and Google
  set the tiers), with more gems per dollar in bigger bundles.
- **One "starter pack"**, offered once after the player's first gem-starved
  moment: a few gems plus a cosmetic. It usually converts better than a
  plain bundle.
- **Supporter pack** (one-off): the second builder, plus a cosmetic set.
  This is where the locked "Second builder" in the Store would come from.
- **Never:** gem-only progression, paid-only species, or pop-ups interrupting
  play. Gems stay earnable through play (milestones, rare species, critics,
  festivals), which the game already does.

## What would need building

1. In-app purchases through the stores (required for digital items). For the
   Capacitor app, a plugin such as RevenueCat's handles both stores.
2. A "Gem shop" section at the top of the Store tab (bundles + restore
   purchases).
3. Server-side receipt checking, if gems should be safe from save editing.
   Optional for a first release.
4. A gentle, one-time prompt at the first gem-starved moment ("Short on
   gems? The gem shop has bundles"). Not repeated.

## Naming check

A quick web search (September 2026) found no game, app or trademark named
"Honeycomb Corner"; nearby names are the *Honeycombs* tile game and the
"HONEYCOMB" fitness trademark, which are different fields. That is not a
legal clearance. Before committing to the name, search the USPTO trademark
database (tmsearch.uspto.gov) and both app stores, or ask a trademark lawyer.
