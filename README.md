# Meowle: A Family of Cats

A retro pixel cat family game in plain HTML, CSS and JavaScript. No build step, no dependencies.

## How to play

1. **Choose your cat.** It founds the family, and all of its DNA is the gold **origin DNA**.
2. **Press AGE EVERYONE +1 YEAR.** The year flips over, every cat hops a year older (kitten, young, adult, senior, elder), some die of old age or bad luck, and new litters are born.
3. **Watch the DNA spread and fade.** Each kitten gets one copy of every chromosome from each parent, shuffled by crossing over, so a 50% cat can have 40% or 60% kittens, and after a few generations some get none.
4. **The game ends** when no living cat carries any origin DNA, or when you press END & TREE. Then look at the **family tree** of every cat that ever lived. Click any cat to see its chromosomes, parents and kittens.

## The core loop

- **Purr meter:** every new kitten arrives in a wobbling basket. Tap (or press space) when the paw is in the gold. PERFECT and GREAT build a run-long combo that multiplies fish, raises the pitch and speeds the meter up; a MISS breaks it. Better timing makes shiny kittens likelier. Each reveal shows the coat's rarity (common to legendary) with its own flash and fanfare.
- **Love letters:** pick a mate for a queen (3 strays or an unrelated family tom). Her litter next year is guaranteed. With the Gene Scanner you see the coat odds and how much origin DNA the kittens will carry.
- **Orders:** people ask for coats (Calico ♀, Blue tabby van…) or for cats with lots of origin DNA. Adopting one out pays fish and legacy, but the cat takes its DNA with it.
- **Legacy:** every year the origin DNA in the yard adds to your legacy score. At the end it pays out as fish and is compared to your best.
- **Shop and Catdex (kept forever):** 8 upgrades (Gene Scanner, Love Letters, Bigger Yard, Steady Paws, Fish Magnet, Order Board, Vet Visits, Lucky Bell) and a Catdex of all 22 coats and their shiny versions. New coats and first shinies pay bonus fish.
- **▶ AUTO** ages the family hands-free, but auto reveals earn half fish and no combo.

## The genetics

- 18 chromosome pairs (named like real cat chromosomes, A1 to F2) plus XX or XY, 12 chunks each.
- **Mothers** pass a recombined X and their mitochondria to every kitten, but have at most two litters a year and stop around 12.
- **Fathers** pass their X whole to daughters and their Y whole to sons, and can sire litters with roaming queens until about 16.
- Coat genes sit on the chromosomes: Orange on X (so calicos and torties are girls), tabby on A3, white spotting on B1, dilute on C1.
- Yearly death risk rises with age. Mates are mostly strays (which dilutes the origin DNA); close relatives never pair. The yard feeds about 28 cats, so crowding means fewer kittens.

## Files

| File | What it is |
|---|---|
| `index.html` | Page structure |
| `style.css` | Retro pixel look and the aging, birth and death animations |
| `script.js` | Genetics, life cycle, purr meter, orders, shop, Catdex, pixel cat sprites, sound (Web Audio), family tree |

Saves live in `localStorage`: the current family in `meowle-cats-v2`, fish, upgrades, Catdex and bests in `meowle-meta-v1`.
