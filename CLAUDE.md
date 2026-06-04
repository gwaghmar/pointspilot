# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PointsPilot answers "which of my cards should I use for this purchase / trip?" The defining
idea: **the AI supplies DATA, the code makes the DECISION.** An LLM doesn't know current reward
rates and will hallucinate them, so live rates come from a web search that the model only
*reformats* into JSON, and the actual ranking is plain TypeScript. See `README.md` for the full
pitch, service signup, and deploy steps.

## Commands

```bash
npm run dev        # dev server at localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```

There is **no lint script and no test suite** — `typecheck` is the only automated gate. Run it
before considering a change done.

## Architecture

Next.js 14 App Router, React 18, TypeScript. Three moving parts: two client pages, one server
API route, and a deterministic ranking library.

**Pages**
- `app/page.tsx` — marketing landing page (`/`). Self-contained, rotating example reel.
- `app/app/page.tsx` — the *entire* product (`/app`), one file. Onboarding wizard (profile →
  cards → spend categories), then a dashboard with four views: a conversational chat assistant,
  an everyday-category recommender, a "Get more" gap analyzer, and a Profile (with a spend
  editor). The chat routes to either a category rec or a trip flow that includes
  destination-aware nearby rewards + reservations. All UI state lives here; profile persists via
  `lib/supabase.ts`.

**`app/api/ai/route.ts` — the only server route.** Keeps all provider keys server-side. POST
body is dispatched by a `mode` field (NOT `action`):
- `classify` — single-category intent of a message (no web search).
- `analyze` — unified extractor: intent + trip fields + spend amount in one call. This is what
  the chat view actually uses.
- `cardLookup` — the grounded-rates flow (below).
- `nearby` — destination-aware: one cached Tavily search per destination, LLM structures notable
  dining/shopping/attractions into reward categories. Cached in `card_cache` under a `nearby:`
  key prefix.
- `tripExtract` / `spendExtract` — narrower field extractors.

**`cardLookup` is the heart of the project.** Order matters:
1. Check Supabase `card_cache` by normalized key; return if younger than `CACHE_DAYS = 30`.
2. Tavily web search for current rates (`webSearch`).
3. LLM call with `temperature: 0`, `response_format: json_object`, prompted to extract reward
   profile **using ONLY the search results** — "Do not invent rates." Now also extracts
   `annualFee` and per-category `caps` (`{limit, postRate}`). Attaches `sources[]` and an `asOf`.
4. Upsert into `card_cache`.

**`lib/recommend.ts` — deterministic ranking, the source of truth for "which card."** The AI
supplies data + a recommendation; the **user decides** — every function returns the full field,
not just a winner. Key exports: `valueFor` (cap-aware blended effective %), `bestForCategory`
(ranks by marginal per-swipe value — the annual fee is sunk for cards you hold, so it does NOT
change which card to swipe), `netAnnualValue` (fee-aware, for "should I get this card"),
`ceilingFor` (the max a card can do), `bestForTrip` (fare-aware when a fare is known). The model
never ranks. Change recommendation behavior here, not in a prompt.

**`lib/merchants.ts` — merchant intelligence.** `resolveMerchant(query)` maps real merchants to
the category their purchases actually CODE as, with coding-quirk notes (warehouse clubs →
wholesale not groceries, superstores excluded from grocery bonus, fast food → dining). This wins
over the model's coarse intent for ranking; the LLM is only the fallback.

**`lib/catalog.ts` + `lib/gaps.ts` — "Get more" gap analysis.** `CATALOG` is a curated candidate
set of well-known cards (fees, caps, offers). `analyzeWallet(cards, uses, spend)` finds, per
used category, the catalog card that most beats the user's current best — fee-aware and
$-quantified when spend estimates exist. (`catalog.ts` replaces the old dead `seed.ts`.)

**`lib/reservations.ts` — booking handoffs + agent seam.** `buildReservationUrl` pre-fills an
OpenTable deep link (restaurant, date, time, party). `toAgentTask` is the typed contract a future
browser-automation agent would consume to actually confirm — auto-booking isn't possible from a
web app alone (OpenTable/Resy have no open booking API).

**`lib/ai.ts` — client-side wrappers** around `/api/ai`. Every wrapper has a **keyword-based
fallback** (`kwClass`) so the UI degrades gracefully when the API errors. `normalize()` reshapes
raw AI JSON into the `Card` shape (fills missing multipliers with 1, deterministic brand color,
filters perks/redemptions, threads `annualFee`/`caps`, sets `edited: false`). Anything new the
API returns must be threaded through `normalize()` to reach the UI. `aiNearby` shapes `nearby`
results.

**Spend estimates (`AppData.spend`).** Optional per-category annual spend, set in the Profile
spend editor (entered as $/mo, stored ×12). This is what makes caps *bind*, net-value compare
fairly, and "Get more" quantify gains in dollars. Everything degrades gracefully without it.

**`lib/supabase.ts` — no-auth persistence.** Profiles are keyed by a random `deviceId()` stored
in `localStorage`. Two tables (`supabase/schema.sql`): `profiles` and `card_cache`, both with RLS
**disabled** for the MVP.

## Gotchas

- **Lazy client init.** The OpenAI/OpenRouter client (`route.ts`) and the browser Supabase client
  (`lib/supabase.ts`) are lazy-initialized and return `null`/throw only when actually called, so
  `next build` succeeds with no env vars set. Preserve this — don't init clients at module top
  level.
- **Two Supabase key sets.** Server route uses `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (service
  role, for the cache). The browser uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (for profiles). Both pairs must be set; see `.env.local.example` (six vars total, plus the
  OpenRouter/Tavily keys).
- **README ↔ code drift.** The README's API section documents an `action` field with
  `merchant`/`cardName` bodies; the actual route uses `mode` + `text`. Trust the code.
- **Two card sources, don't confuse them.** `lib/catalog.ts` is a *curated candidate* list used
  only by the gap analyzer (`analyzeWallet`) — static, not live. The user's actual wallet always
  comes from live `cardLookup`/`normalize`. Adding a suggested card runs a real lookup.
- **`edited` guard.** A user-corrected card (via the inline `CardEditor`) sets `edited: true`.
  Don't overwrite an edited card's numbers on a re-lookup.
- **Model is swappable** via `OPENROUTER_MODEL`; the README notes you can bump just the
  `cardLookup` call to a larger model if extraction accuracy matters more than cost.
