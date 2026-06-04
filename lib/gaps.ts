/* Wallet gap analysis: "what card should I get next?". For each category the
 * user cares about, find the catalog card that most improves their effective
 * return over what they already hold — fee- and offer-aware. Deterministic:
 * the AI never decides which card to recommend. */

import { CATEGORIES, bestForCategory, rateFor, type Card } from "./recommend";
import { CATALOG } from "./catalog";

export type Gap = {
  category: string;
  currentBestName: string | null;
  currentValuePct: number;
  suggestion: Card;
  suggestionRate: number;
  suggestionValuePct: number;
  deltaPct: number;            // improvement in effective % back
  estAnnualGain?: number;      // $ gain at the user's stated annual spend, if known
  annualFee: number;
  offer: string | null;
};

const MIN_DELTA = 0.25;        // ignore trivial improvements (< 0.25% back)

/* uses: the user's selected category labels (e.g. ["Dining","Travel"]).
 * spend: optional annual spend per category in dollars. */
export function analyzeWallet(cards: Card[], uses: string[], spend?: Record<string, number>): Gap[] {
  const owned = new Set(cards.map((c) => c.name.trim().toLowerCase()));
  const cats = Array.from(new Set(uses.map((u) => u.toLowerCase()))).filter((c) =>
    (CATEGORIES as string[]).includes(c),
  );

  const gaps: Gap[] = [];
  for (const cat of cats) {
    const current = bestForCategory(cards, cat)[0];
    const currentValuePct = current ? current.value : 0;

    const candidate = CATALOG
      .filter((c) => !owned.has(c.name.trim().toLowerCase()))
      .map((c) => ({ c, vp: rateFor(c, cat) * c.cpp }))
      .filter((x) => x.vp > currentValuePct + MIN_DELTA)
      .sort((a, b) => b.vp - a.vp)[0];

    if (!candidate) continue;

    const deltaPct = candidate.vp - currentValuePct;
    const annualSpend = spend?.[cat];
    const estAnnualGain = annualSpend && annualSpend > 0 ? (deltaPct / 100) * annualSpend : undefined;

    gaps.push({
      category: cat,
      currentBestName: current?.name ?? null,
      currentValuePct,
      suggestion: candidate.c,
      suggestionRate: rateFor(candidate.c, cat),
      suggestionValuePct: candidate.vp,
      deltaPct,
      estAnnualGain,
      annualFee: candidate.c.annualFee ?? 0,
      offer: candidate.c.offer ?? null,
    });
  }

  // Biggest opportunity first: by estimated $ gain when we have spend, else by % delta.
  return gaps.sort((a, b) => (b.estAnnualGain ?? b.deltaPct) - (a.estAnnualGain ?? a.deltaPct));
}
