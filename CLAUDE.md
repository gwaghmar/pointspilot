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
- `app/app/page.tsx` — the *entire* product (`/app`), ~960 lines in one file. Contains the
  onboarding wizard (profile → cards → spend categories), then a dashboard with three views:
  a conversational chat assistant, an everyday-category recommender, and a trip-booking flow.
  All UI state lives here; profile persists via `lib/supabase.ts`.

**`app/api/ai/route.ts` — the only server route.** Keeps all provider keys server-side. POST
body is dispatched by a `mode` field (NOT `action`):
- `classify` — single-category intent of a message (no web search).
- `analyze` — unified extractor: intent + trip fields + spend amount in one call. This is what
  the chat view actually uses.
- `cardLookup` — the grounded-rates flow (below).
- `tripExtract` / `spendExtract` — narrower field extractors.

**`cardLookup` is the heart of the project.** Order matters:
1. Check Supabase `card_cache` by normalized key; return if younger than `CACHE_DAYS = 30`.
2. Tavily web search for current rates (`webSearch`).
3. LLM call with `temperature: 0`, `response_format: json_object`, prompted to extract reward
   profile **using ONLY the search results** — "Do not invent rates." Attaches `sources[]` and
   an `asOf` date.
4. Upsert into `card_cache`.

**`lib/recommend.ts` — deterministic ranking, the source of truth for "which card."** `rateFor`,
`bestForCategory` (multiplier × cpp), and `bestForTrip` (priority-aware: rack-up-points vs.
spend-least-cash vs. redeem-existing-balance). The model never ranks. When changing
recommendation behavior, change it here, not in a prompt.

**`lib/ai.ts` — client-side wrappers** around `/api/ai`. Every wrapper has a **keyword-based
fallback** (`kwClass`) so the UI degrades gracefully when the API errors. `normalize()` reshapes
raw AI JSON into the `Card` shape that the UI and `recommend.ts` expect (fills missing
multipliers with 1, assigns a deterministic brand color, filters perks/redemptions). Anything new
the API returns must be threaded through `normalize()` to reach the UI.

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
- **`lib/seed.ts` is dead reference data.** `SEED_CARDS` is not imported anywhere (the seed `const`
  inside `app/app/page.tsx` is unrelated trip state). Its comment about "before Azure OpenAI is
  wired up" is stale — the project uses OpenRouter (`openai/gpt-4o-mini`), not Azure.
- **Model is swappable** via `OPENROUTER_MODEL`; the README notes you can bump just the
  `cardLookup` call to a larger model if extraction accuracy matters more than cost.
