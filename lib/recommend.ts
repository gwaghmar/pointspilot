/* The recommendation logic, centralized so it's correct and testable.
 * Ranking is deterministic math — the AI only supplies the reward DATA and a
 * recommendation; the USER makes the final call. Every function here returns
 * the full picture (not just a winner) so the UI can show where each choice
 * leads. Keep this pure: no I/O, no React, no network. */

export type Category = "dining" | "travel" | "streaming" | "groceries" | "gas" | "online" | "other";
export const CATEGORIES: Category[] = ["dining", "travel", "streaming", "groceries", "gas", "online", "other"];

/* A bonus rate that only applies up to an annual spend limit, then drops. */
export type CategoryCap = { limit: number; postRate: number };

export type Source = { title: string; url: string };

export type Card = {
  id: string;
  name: string;
  issuer: string;
  cur: string;
  cpp: number;                       // cents-per-point value
  color: string;
  points: number;                    // current balance
  r: Record<string, number>;         // category -> earn multiplier
  /* Extended (optional so older saved profiles still load) */
  annualFee?: number;
  caps?: Record<string, CategoryCap>;
  note?: string;
  sources?: Source[];
  asOf?: string | null;
  perks?: string[];
  offer?: string | null;
  redemptions?: string[];
  edited?: boolean;                  // user corrected the data — don't clobber on re-lookup
};

export const rateFor = (c: Card, cat: string) => c.r[cat] ?? 1;
export const annualFeeOf = (c: Card) => c.annualFee ?? 0;
export const capFor = (c: Card, cat: string): CategoryCap | undefined => c.caps?.[cat];

/* ---- per-purchase / per-category value ---------------------------------- */

export type ValueBreakdown = {
  card: Card;
  rate: number;          // headline bonus multiplier
  cpp: number;
  valuePct: number;      // rate * cpp — effective % back at the bonus rate
  cap?: CategoryCap;     // present if this category has an annual cap
  capBinds: boolean;     // true when annualSpend exceeds the cap
  effectivePct: number;  // blended % once cap + spend are considered (== valuePct if no cap binds)
  spend?: number;        // the annual spend used for the blend, if any
  rewardUsd?: number;    // annual reward $ at that spend (gross, before fee)
};

/* Effective value of swiping a card in a category. If `annualSpend` is given
 * and the category is capped, blends bonus + post-cap rate across the spend. */
export function valueFor(card: Card, cat: string, annualSpend?: number): ValueBreakdown {
  const rate = rateFor(card, cat);
  const cpp = card.cpp;
  const valuePct = rate * cpp;
  const cap = capFor(card, cat);

  if (annualSpend === undefined || annualSpend <= 0) {
    return { card, rate, cpp, valuePct, cap, capBinds: false, effectivePct: valuePct };
  }

  if (!cap || annualSpend <= cap.limit) {
    return {
      card, rate, cpp, valuePct, cap,
      capBinds: false, effectivePct: valuePct,
      spend: annualSpend, rewardUsd: (rate * annualSpend * cpp) / 100,
    };
  }

  // Spend exceeds the cap: bonus up to the limit, base/post rate beyond it.
  const bonusReward = (rate * cap.limit * cpp) / 100;
  const postReward = (cap.postRate * (annualSpend - cap.limit) * cpp) / 100;
  const rewardUsd = bonusReward + postReward;
  const effectivePct = annualSpend > 0 ? (rewardUsd / annualSpend) * 100 : valuePct;
  return { card, rate, cpp, valuePct, cap, capBinds: true, effectivePct, spend: annualSpend, rewardUsd };
}

/* Best card for a category. Ranks by the marginal value of the swipe
 * (effective %, cap-aware) — the annual fee is sunk for cards you already
 * hold, so it does NOT change which card to swipe (see netAnnualValue for the
 * "should I get this card" question). Returns the FULL ranked field, each item
 * still shaped like a Card plus the breakdown, so the UI can show everything. */
export type RankedCard = Card & {
  rate: number;
  value: number;         // effectivePct — kept as `value` for backward-compat
  valuePct: number;      // headline (uncapped) %
  breakdown: ValueBreakdown;
};

export function bestForCategory(cards: Card[], cat: string, annualSpend?: number): RankedCard[] {
  return cards
    .map((c): RankedCard => {
      const b = valueFor(c, cat, annualSpend);
      return { ...c, rate: b.rate, value: b.effectivePct, valuePct: b.valuePct, breakdown: b };
    })
    .sort((a, b) => b.value - a.value || annualFeeOf(a) - annualFeeOf(b));
}

/* ---- whole-card economics (for "is this card worth holding / getting") --- */

/* Gross annual reward across the categories the user spends in, minus the
 * annual fee. `spendByCat` maps category -> annual spend in dollars. */
export function netAnnualValue(card: Card, spendByCat: Record<string, number>): number {
  let gross = 0;
  for (const [cat, spend] of Object.entries(spendByCat)) {
    if (!spend || spend <= 0) continue;
    gross += valueFor(card, cat, spend).rewardUsd ?? 0;
  }
  return gross - annualFeeOf(card);
}

/* The ceiling: the most a card can do for the user. Best category, best-case
 * effective %, plus point-balance worth. Welcome-offer/perk value is surfaced
 * separately in the UI (it's free text we don't rank on). */
export type Ceiling = {
  card: Card;
  topCategory: string;
  topRate: number;
  topValuePct: number;     // best effective % across categories
  balanceUsd: number;      // current points balance in dollars
  hasOffer: boolean;
};

export function ceilingFor(card: Card): Ceiling {
  let topCategory = "other";
  let topRate = rateFor(card, "other");
  let topValuePct = topRate * card.cpp;
  for (const cat of CATEGORIES) {
    const v = rateFor(card, cat) * card.cpp;
    if (v > topValuePct) { topValuePct = v; topRate = rateFor(card, cat); topCategory = cat; }
  }
  return {
    card,
    topCategory,
    topRate,
    topValuePct,
    balanceUsd: (card.points * card.cpp) / 100,
    hasOffer: !!card.offer,
  };
}

/* ---- trips ------------------------------------------------------------- */

export type TripPick = {
  pick: Card | undefined;
  why: string;
  /* Optional economics when a fare estimate is known */
  fareUsd?: number;
  balanceUsd?: number;
  outOfPocketUsd?: number;   // cash still owed after applying points
  coversFare?: boolean;
};

/* Best card for a flight, given the trip priority and (optionally) a fare
 * estimate. With a fare, "spend least cash" vs "redeem" become real
 * comparisons instead of "any balance wins". */
export function bestForTrip(cards: Card[], priority: string, fareUsd?: number): TripPick {
  const byEarn = [...cards]
    .map((c) => ({ c, score: valueFor(c, "travel").effectivePct }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
  const byBalance = [...cards].sort((a, b) => b.points - a.points);
  const top = byBalance[0];
  const hasBalance = (top?.points ?? 0) > 0;
  const balanceUsd = top ? (top.points * top.cpp) / 100 : 0;
  const fare = fareUsd && fareUsd > 0 ? fareUsd : undefined;

  if (priority.startsWith("Rack up")) {
    return { pick: byEarn[0], why: "Highest travel earn rate — pay cash here and bank points for later.", fareUsd: fare };
  }

  if (priority.startsWith("Redeem")) {
    if (!hasBalance) return { pick: byEarn[0], why: "No balances set — best transfer card to redeem from.", fareUsd: fare };
    if (fare) {
      const covers = balanceUsd >= fare;
      const oop = Math.max(0, fare - balanceUsd);
      return {
        pick: top, fareUsd: fare, balanceUsd, outOfPocketUsd: oop, coversFare: covers,
        why: covers
          ? `${top.points.toLocaleString()} pts ≈ $${balanceUsd.toFixed(0)} covers the ~$${fare.toFixed(0)} fare outright.`
          : `${top.points.toLocaleString()} pts ≈ $${balanceUsd.toFixed(0)} covers most of it — about $${oop.toFixed(0)} left in cash.`,
      };
    }
    return { pick: top, why: `Most points on hand (${top.points.toLocaleString()}). Redeem these to cover the fare.`, balanceUsd };
  }

  // Spend the least cash
  if (!hasBalance) return { pick: byEarn[0], why: "Lowest out-of-pocket: best travel-value card to offset cost.", fareUsd: fare };
  if (fare) {
    const oop = Math.max(0, fare - balanceUsd);
    return {
      pick: top, fareUsd: fare, balanceUsd, outOfPocketUsd: oop, coversFare: balanceUsd >= fare,
      why: `Lowest out-of-pocket: lean on ${top.points.toLocaleString()} pts (~$${balanceUsd.toFixed(0)}) first${oop > 0 ? `, then ~$${oop.toFixed(0)} cash` : ""}.`,
    };
  }
  return { pick: top, why: "Lowest out-of-pocket: lean on points first, then this card for the rest.", balanceUsd };
}
