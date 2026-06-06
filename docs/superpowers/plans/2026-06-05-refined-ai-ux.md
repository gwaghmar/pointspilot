# Refined AI UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the refined PointsPilot cockpit UI into the real Next.js app and make AI visible as a trusted assistant layer across recommendations, wallet data, savings, and phased roadmap.

**Architecture:** Add a small pure `lib/ux-insights.ts` helper for saved-money estimates, wallet source confidence, and AI phase copy, then consume it from `app/app/page.tsx`. Keep recommendation decisions in `lib/recommend.ts`; AI remains data extraction and explanation, while TypeScript ranks cards.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Node test runner through `tsx`, existing CSS in `app/globals.css`.

---

### Task 1: Add Test Harness And UX Insight Tests

**Files:**
- Modify: `package.json`
- Create: `tests/ux-insights.test.ts`

- [ ] **Step 1: Add a test script and `tsx` dev dependency**

Add:

```json
"test": "tsx tests/ux-insights.test.ts"
```

and add:

```json
"tsx": "^4.20.5"
```

to `devDependencies`.

- [ ] **Step 2: Write the failing test**

Create `tests/ux-insights.test.ts`:

```ts
import assert from "node:assert/strict";
import { AI_PHASES, estimateAnnualSaved, sourceConfidence } from "../lib/ux-insights";
import type { Card } from "../lib/recommend";

const cards: Card[] = [
  {
    id: "gold",
    name: "Amex Gold",
    issuer: "American Express",
    cur: "Points",
    cpp: 1,
    color: "#214dff",
    points: 0,
    r: { dining: 4, travel: 1, streaming: 1, groceries: 1, gas: 1, online: 1, other: 1 },
    sources: [{ title: "Issuer", url: "https://example.com" }],
    asOf: "2026-06-01",
  },
];

assert.equal(estimateAnnualSaved(cards, ["Dining"], { dining: 12000 }), 300);
assert.equal(sourceConfidence(cards).label, "High confidence");
assert.equal(AI_PHASES.length, 4);
assert.equal(AI_PHASES[0].title, "AI recommendations and proof");
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `../lib/ux-insights` does not exist.

### Task 2: Implement Pure UX Insight Helpers

**Files:**
- Create: `lib/ux-insights.ts`
- Test: `tests/ux-insights.test.ts`

- [ ] **Step 1: Implement the minimal helper module**

Create `lib/ux-insights.ts` with:

```ts
import { bestForCategory, type Card } from "./recommend";

export const AI_PHASES = [
  {
    phase: "Phase 1",
    title: "AI recommendations and proof",
    status: "Live in v1",
    body: "Chat detects merchant, category, amount, and trip intent, then shows ranked proof.",
  },
  {
    phase: "Phase 2",
    title: "AI wallet refresh",
    status: "Next",
    body: "Refresh rates, fees, caps, offers, perks, and sources without overwriting user edits.",
  },
  {
    phase: "Phase 3",
    title: "AI savings intelligence",
    status: "Next",
    body: "Explain missed rewards, quantify annual gaps, and keep card suggestions transparent.",
  },
  {
    phase: "Phase 4",
    title: "AI personalization",
    status: "Later",
    body: "Learn preferred point values, travel style, risk tolerance, and favorite merchants.",
  },
] as const;

const BASELINE_CASHBACK_PCT = 1.5;

export function estimateAnnualSaved(cards: Card[], uses: string[], spend?: Record<string, number>): number {
  if (!cards.length || !spend) return 0;
  const cats = uses.length ? uses.map((u) => u.toLowerCase()).filter((u) => u !== "other") : Object.keys(spend);
  const saved = cats.reduce((sum, cat) => {
    const annualSpend = spend[cat] || 0;
    if (annualSpend <= 0) return sum;
    const best = bestForCategory(cards, cat, annualSpend)[0];
    if (!best) return sum;
    const appReward = annualSpend * (best.value / 100);
    const baselineReward = annualSpend * (BASELINE_CASHBACK_PCT / 100);
    return sum + Math.max(0, appReward - baselineReward);
  }, 0);
  return Math.round(saved);
}

export function sourceConfidence(cards: Card[]) {
  const sourceCount = cards.reduce((sum, card) => sum + (card.sources?.length || 0), 0);
  const sourcedCards = cards.filter((card) => (card.sources?.length || 0) > 0).length;
  const editedCards = cards.filter((card) => card.edited).length;
  const label = sourceCount >= 3 || sourcedCards >= 2 ? "High confidence" : sourceCount > 0 ? "Medium confidence" : "Needs sources";
  return { label, sourceCount, sourcedCards, editedCards };
}

export function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npm test`

Expected: PASS.

### Task 3: Add Refined App Shell, Everyday View, And AI Surfaces

**Files:**
- Modify: `app/app/page.tsx`
- Modify: `app/globals.css`
- Test: `npm test`, `npm run typecheck`

- [ ] **Step 1: Import helpers**

In `app/app/page.tsx`, import:

```ts
import { AI_PHASES, estimateAnnualSaved, formatMoney, sourceConfidence } from "@/lib/ux-insights";
```

- [ ] **Step 2: Add the Everyday view**

Change `type View` to include `"everyday"`, default `Workspace` state to `"everyday"`, and add `EverydayView` that shows category tabs, recommended card, ranking rows, AI reasoning, source confidence, and edit-data actions.

- [ ] **Step 3: Add saved-money metric**

In `Workspace`, compute:

```ts
const annualSaved = estimateAnnualSaved(data.cards, data.uses, data.spend);
const confidence = sourceConfidence(data.cards);
```

Show `Money saved using PointsPilot` in the sidebar and `Saved with app` in the top bar.

- [ ] **Step 4: Add AI proof panels**

Add reusable UI blocks in `ChatView`, `RecCard`, `CardsView`, `GapsView`, and `ProfileView`:

```tsx
<div className="ai-card">
  <span className="ai-kicker">AI checked the math</span>
  <p>AI detects context and sources data. PointsPilot ranks cards with deterministic TypeScript.</p>
</div>
```

Use screen-specific copy for wallet refresh, missed rewards, and personalization.

- [ ] **Step 5: Add polished CSS**

Update `app/globals.css` with refined off-white/navy/blue/green tokens, striped wordmark styling, topbar saved pill, Everyday layout, AI cards, source confidence, phase cards, and mobile layout rules.

- [ ] **Step 6: Verify**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

### Task 4: Browser Verification

**Files:**
- No source files expected.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`.

- [ ] **Step 2: Open the real app**

Open `http://localhost:3000/app` in the in-app browser.

- [ ] **Step 3: Inspect desktop and mobile**

Verify the page renders without overlap, the Everyday view is first, the blue striped wordmark appears, saved-money appears after monthly spend/profile data, and AI phase/proof cards are visible.
