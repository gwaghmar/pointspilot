# Real card art

Drop card-front images here to replace the rendered placeholder for a given
card, then register the slug in `lib/cardArt.ts` (`CARD_ART`).

- **Filename:** `<slug>.png` (or `.jpg` / `.webp` / `.svg`). The slug is produced
  by `cardSlug(name)` in `lib/cardArt.ts` — lowercase, non-alphanumerics → `-`.
  e.g. `Amex Gold` → `amex-gold.png`, `Chase Sapphire Reserve` →
  `chase-sapphire-reserve.png`.
- **Aspect:** ~1.586:1 (ISO/IEC 7810 ID-1, like a real card). ~640×404 px is plenty.
- The UI loads the image and **falls back to the rendered card on any load
  error**, so a missing/broken file is never shown.

`TOP_CARDS` in `lib/cardArt.ts` lists the intended fill set (top ~50 US cards).

> Note: card art is the issuer's trademark/IP. Use official press/brand assets
> with permission for production; the rendered fallback ships by default.
