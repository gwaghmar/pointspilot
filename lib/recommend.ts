/* The recommendation logic, centralized so it's correct and testable.
 * Ranking is deterministic math — the AI only supplies the reward DATA,
 * never the decision. That keeps recommendations reliable. */

export type Card = {
  id: string; name: string; issuer: string; cur: string; cpp: number;
  color: string; points: number; r: Record<string, number>;
};

export const rateFor = (c: Card, cat: string) => c.r[cat] ?? 1;

/* Best card for an everyday category: multiplier x point value. */
export function bestForCategory(cards: Card[], cat: string) {
  return [...cards]
    .map((c) => ({ ...c, rate: rateFor(c, cat), value: rateFor(c, cat) * c.cpp }))
    .sort((a, b) => b.value - a.value);
}

/* Best card for a flight, given the trip priority. */
export function bestForTrip(cards: Card[], priority: string) {
  const byEarn = [...cards].map((c) => ({ ...c, score: rateFor(c, "travel") * c.cpp })).sort((a, b) => b.score - a.score);
  const byBalance = [...cards].sort((a, b) => b.points - a.points);
  const hasBalance = byBalance[0]?.points > 0;

  if (priority.startsWith("Rack up"))
    return { pick: byEarn[0], why: "Highest travel earn rate — pay cash here and bank points for later." };

  if (priority.startsWith("Redeem"))
    return hasBalance
      ? { pick: byBalance[0], why: `Most points on hand (${byBalance[0].points.toLocaleString()}). Redeem these to cover the fare.` }
      : { pick: byEarn[0], why: "No balances set — best transfer card to redeem from." };

  // Spend the least cash
  return hasBalance
    ? { pick: byBalance[0], why: "Lowest out-of-pocket: lean on points first, then this card for the rest." }
    : { pick: byEarn[0], why: "Lowest out-of-pocket: best travel-value card to offset cost." };
}
