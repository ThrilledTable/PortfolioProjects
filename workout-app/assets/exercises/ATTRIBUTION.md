# Exercise photos

Source: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) — an
open exercise dataset released under the [Unlicense](https://unlicense.org/),
a public-domain dedication. No attribution is required; this file exists so the
provenance is on record rather than because the licence demands it.

Each exercise here has two frames, usually the start and end of the movement.
Images were downscaled to 560px wide and re-encoded at quality 82, which cut
them from 6.1MB to 3.3MB with no visible loss at the size the app renders them.

## A caveat worth recording

The Unlicense covers the dataset **as published**. Whether the original
photographer's rights were the publisher's to dedicate is not something this
project verified — the dataset is widely used on that basis, but it is not the
same as a chain of title. If that matters more later than it does now, the
drawn diagrams in `src/components/FormFigure.tsx` still cover every exercise
and carry no such question.

## Mapping

`src/data/exerciseImages.ts` maps exercise names to these folders. It is
hand-checked, not name-matched. The dataset contains many similarly named
entries, and automatic matching produced confidently wrong pairings — a
**row** for a shrug, a **clean pull** for a pull-up, a **crunch** for a cable
row, and a **guillotine press** for a plain bench press. Each mapping was
confirmed against the source entry's equipment and primary muscle.

46 of the 47 seed exercises are mapped. `Barbell Bent Over Shrug` is
deliberately left out: the dataset has no bent-over shrug, and a standing
shrug photo would misrepresent the position. It falls back to the diagram.
