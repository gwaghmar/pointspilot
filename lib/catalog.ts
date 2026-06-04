import type { Card } from "./recommend";

/* Candidate catalog: well-known cards used by the gap analyzer to answer
 * "what should I get next". Rates/fees/offers are realistic public figures and
 * deliberately conservative; they are CANDIDATES the deterministic engine
 * ranks against your wallet, not live-looked-up data. Update as products
 * change. `points` is always 0 (you don't hold these yet). */

type CatalogCard = Card & { annualFee: number; offer: string | null };

const mk = (c: Omit<CatalogCard, "points">): CatalogCard => ({ ...c, points: 0 });

export const CATALOG: CatalogCard[] = [
  mk({
    id: "cat-amex-gold", name: "American Express Gold", issuer: "American Express",
    cur: "Membership Rewards", cpp: 2.0, color: "#b29469", annualFee: 325,
    r: { dining: 4, groceries: 4, travel: 3, streaming: 1, gas: 1, online: 1, other: 1 },
    caps: { groceries: { limit: 25000, postRate: 1 } },
    offer: "60,000 pts after $6k spend in 6 months",
  }),
  mk({
    id: "cat-csp", name: "Chase Sapphire Preferred", issuer: "Chase",
    cur: "Ultimate Rewards", cpp: 2.0, color: "#1a3a6e", annualFee: 95,
    r: { dining: 3, travel: 5, streaming: 3, groceries: 3, gas: 1, online: 1, other: 1 },
    offer: "60,000 pts after $5k spend in 3 months",
  }),
  mk({
    id: "cat-venturex", name: "Capital One Venture X", issuer: "Capital One",
    cur: "Venture Miles", cpp: 1.85, color: "#0e2a3e", annualFee: 395,
    r: { dining: 2, travel: 5, streaming: 2, groceries: 2, gas: 2, online: 2, other: 2 },
    offer: "75,000 miles after $4k spend in 3 months",
  }),
  mk({
    id: "cat-bluecash", name: "Blue Cash Preferred", issuer: "American Express",
    cur: "Cash Back", cpp: 1.0, color: "#1f6fb2", annualFee: 95,
    r: { dining: 1, groceries: 6, streaming: 6, gas: 3, travel: 1, online: 1, other: 1 },
    caps: { groceries: { limit: 6000, postRate: 1 } },
    offer: "$250 back after $3k spend in 6 months",
  }),
  mk({
    id: "cat-autograph", name: "Wells Fargo Autograph", issuer: "Wells Fargo",
    cur: "Rewards Points", cpp: 1.0, color: "#9e2b25", annualFee: 0,
    r: { dining: 3, travel: 3, streaming: 3, groceries: 1, gas: 3, online: 1, other: 1 },
    offer: "20,000 pts after $1k spend in 3 months",
  }),
  mk({
    id: "cat-freedom-unlimited", name: "Chase Freedom Unlimited", issuer: "Chase",
    cur: "Ultimate Rewards", cpp: 1.25, color: "#2c5e3a", annualFee: 0,
    r: { dining: 3, travel: 5, streaming: 1.5, groceries: 1.5, gas: 1.5, online: 1.5, other: 1.5 },
    offer: "Extra 1.5% on everything (up to $20k) the first year",
  }),
  mk({
    id: "cat-double-cash", name: "Citi Double Cash", issuer: "Citi",
    cur: "ThankYou Points", cpp: 1.0, color: "#2a2a2a", annualFee: 0,
    r: { dining: 2, travel: 2, streaming: 2, groceries: 2, gas: 2, online: 2, other: 2 },
    offer: null,
  }),
  mk({
    id: "cat-amex-plat", name: "Amex Platinum", issuer: "American Express",
    cur: "Membership Rewards", cpp: 2.0, color: "#1a1a2e", annualFee: 695,
    r: { dining: 1, groceries: 1, travel: 5, streaming: 1, gas: 1, online: 1, other: 1 },
    offer: "80,000 pts after $8k spend in 6 months",
  }),
];
