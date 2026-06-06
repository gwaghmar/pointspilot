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
  const label = sourceCount >= 3 || sourcedCards >= 1 ? "High confidence" : sourceCount > 0 ? "Medium confidence" : "Needs sources";
  return { label, sourceCount, sourcedCards, editedCards };
}

export function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}
