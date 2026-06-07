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
npm test           # tsx tests/ux-insights.test.ts
```

There is **no lint script**. Two gates: `typecheck` and `npm test`. Run both before considering a
change done.

**`npm test` is not a unit suite — it's a single assertion-based guardrail** (`tests/ux-insights.test.ts`)
that exercises a few `lib/ux-insights.ts` functions and then `readFileSync`s the real source/CSS/README
to enforce *production posture*: no emoji glyphs in UI source, README uses the committed
`docs/assets/tech-stack.png` (not GitHub-rendered Mermaid), no demo/MVP/"no-auth" language, auth +
rate-limit symbols are present, `lib/catalog.ts` does **not** exist, and specific CSS selectors/layout
values are intact. Editing UI copy, CSS, the README diagram, auth, or the rate limiter can break this
test by design — update the assertions deliberately, don't paper over them.

## Architecture

Next.js 16 App Router, React 18, TypeScript. Three moving parts: two client pages, one server
API route, and a deterministic ranking library.

**Pages**
- `app/page.tsx` — marketing landing page (`/`). Self-contained, rotating example reel.
- `app/app/page.tsx` — the *entire* product (`/app`), one file. An `AuthPanel` gates persistence
  (anonymous users still get a working local draft). Onboarding wizard (profile → cards → spend
  categories), then a dashboard with four views: a conversational chat assistant, an
  everyday-category recommender, a "Get more" gap analyzer, and a Profile (with a spend editor).
  The chat routes to either a category rec or a trip flow that includes destination-aware nearby
  rewards + reservations. All UI state lives here; profile persists via `lib/supabase.ts`.

**`app/api/ai/route.ts` — the only server route.** Keeps all provider keys server-side. Every
request first passes `checkRateLimit` and input validation (see below). POST body is dispatched by
a `mode` field (NOT `action`); only modes in `allowedModes` are accepted:
- `classify` — single-category intent of a message (no web search).
- `analyze` — unified extractor: intent + trip fields + spend amount in one call. This is what
  the chat view actually uses.
- `cardLookup` — the grounded-rates flow (below).
- `nearby` — destination-aware: one cached Tavily search per destination, LLM structures notable
  dining/shopping/attractions into reward categories. Cached in `card_cache` under a `nearby:`
  key prefix.
- `tripExtract` / `spendExtract` — narrower field extractors.

**Request hardening (`route.ts`).** Before dispatch: `checkRateLimit` throttles per client (IP
hashed via SHA-256) to `AI_RATE_LIMIT_PER_MINUTE` (default 30) over a 60s window — backed by the
Supabase `api_rate_limits` table, with an in-memory `Map` fallback (`memoryRateLimit`) when Supabase
is absent or errors; over-limit returns 429 with `Retry-After`. `mode` must be in `allowedModes`,
`text` is required and capped at `AI_MAX_TEXT_CHARS` (default 2000, else 413). `publicError` returns
the raw error message in dev but a generic string in production so provider details never leak.

**`cardLookup` is the heart of the project.** Order matters:
1. Check Supabase `card_cache` by normalized key; return if younger than `CACHE_DAYS = 30`.
2. Tavily web search for current rates (`webSearch`).
3. LLM call with `temperature: 0`, `response_format: json_object`, prompted to extract reward
   profile **using ONLY the search results** — "Do not invent rates." Also extracts `annualFee`
   and per-category `caps` (`{limit, postRate}`), plus `perks`, `offer`, and `redemptions`.
   Attaches `sources[]` and an `asOf`.
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

**`lib/gaps.ts` — "Get more" gap analysis.** `summarizeWalletCoverage(cards, uses)` returns, per
used category, the user's current best card and its effective value % (from `bestForCategory`).
There is **no static candidate catalog** — an earlier `lib/catalog.ts`/`analyzeWallet` design was
removed (the test asserts `catalog.ts` must not exist). Suggesting a card means running a real
`cardLookup`, not reading a hard-coded list.

**`lib/ux-insights.ts` — dashboard framing + headline numbers.** `estimateAnnualSaved(cards, uses,
spend)` quantifies dollars saved vs a 1.5% flat-cashback baseline (needs spend estimates).
`sourceConfidence(cards)` derives a "High/Medium/Needs sources" label from how many cards carry
`sources[]`. `AI_PHASES` is the roadmap copy shown in-app; `formatMoney` is a `$`-rounding helper.
Consumed throughout `app/app/page.tsx`.

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
fairly, "Get more" quantify gains, and `estimateAnnualSaved` produce a real number. Everything
degrades gracefully without it.

**`lib/supabase.ts` — Supabase Auth + persistence.** Real auth: `signUp` / `signIn`
(`signInWithPassword`) / `signOut`, surfaced by `AuthPanel` in `app/app/page.tsx`. A signed-in
user's profile is stored in the `profiles` table keyed by `user_id` (`auth.users`). Anonymous
users (or when Supabase env vars are absent) fall back to a **local draft** in `localStorage`
under `pp_profile_draft` — treat anonymous state as an ephemeral draft, not a durable account.
Schema in `supabase/schema.sql`: `profiles`, `card_cache`, and `api_rate_limits`, with **RLS
enabled** and per-user policies on `profiles` (and an authenticated-read policy on `card_cache`).

## Gotchas

- **Lazy client init.** The OpenAI/OpenRouter client (`route.ts`) and the browser Supabase client
  (`lib/supabase.ts`) are lazy-initialized and return `null`/throw only when actually called, so
  `next build` succeeds with no env vars set. Preserve this — don't init clients at module top
  level.
- **Two Supabase key sets.** Server route uses `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (service
  role, for the cache + rate-limit table). The browser uses `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (for auth + profiles, governed by RLS). Both pairs plus the
  OpenRouter and Tavily keys must be set; see `.env.local.example` for the full list (including the
  optional `AI_MAX_TEXT_CHARS`, `AI_RATE_LIMIT_PER_MINUTE`, `OPENROUTER_MODEL`, `OPENROUTER_REFERRER`).
- **README ↔ code drift.** The README's API section documents an `action` field with
  `merchant`/`cardName` bodies; the actual route uses `mode` + `text`. Trust the code.
- **The card catalog is gone.** Don't reintroduce a hard-coded card list (e.g. `lib/catalog.ts`) —
  the gap analyzer (`lib/gaps.ts`) only summarizes the user's *own* wallet, and the production
  guardrail test fails if `catalog.ts` exists. The wallet always comes from live `cardLookup`/`normalize`.
- **`edited` guard.** A user-corrected card (via the inline `CardEditor`) sets `edited: true`.
  Don't overwrite an edited card's numbers on a re-lookup.
- **Production-posture test.** Many "obvious" edits (UI emoji, demo/MVP wording, README diagram,
  CSS layout numbers, removing auth/rate-limit code) will fail `npm test` on purpose — adjust the
  assertions in `tests/ux-insights.test.ts` intentionally when the change is real.
- **Model is swappable** via `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`); the README notes you
  can bump just the `cardLookup` call to a larger model if extraction accuracy matters more than cost.
- **Planning docs** live in `docs/superpowers/plans/`; `docs/assets/tech-stack.png` is the README
  diagram the test requires to stay committed.
