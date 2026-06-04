import type { Card } from "./recommend";

/* Demo seed: realistic public reward profiles. Used so the app is testable
 * before Azure OpenAI is wired up. */
export const SEED_CARDS: (Card & { sources: { title: string; url: string }[]; asOf: string })[] = [
  {
    id: "amex-gold",
    name: "American Express Gold",
    issuer: "American Express",
    cur: "Membership Rewards",
    cpp: 2.0,
    color: "#b29469",
    points: 84200,
    r: { dining: 4, groceries: 4, travel: 3, streaming: 1, gas: 1, online: 1, other: 1 },
    sources: [
      { title: "AmEx Gold — Card Benefits", url: "https://www.americanexpress.com/us/credit-cards/card/gold-card/" },
    ],
    asOf: "2026-06-04",
  } as any,
  {
    id: "chase-sapphire-preferred",
    name: "Chase Sapphire Preferred",
    issuer: "Chase",
    cur: "Ultimate Rewards",
    cpp: 1.25,
    color: "#1a3a6e",
    points: 51800,
    r: { dining: 3, travel: 2, streaming: 3, groceries: 3, gas: 1, online: 3, other: 1 },
    sources: [
      { title: "Chase Sapphire Preferred — Benefits", url: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred" },
    ],
    asOf: "2026-06-04",
  } as any,
  {
    id: "capital-one-venture-x",
    name: "Capital One Venture X",
    issuer: "Capital One",
    cur: "Venture Miles",
    cpp: 1.85,
    color: "#0e2a3e",
    points: 38500,
    r: { dining: 2, travel: 5, streaming: 2, groceries: 2, gas: 2, online: 2, other: 2 },
    sources: [
      { title: "Venture X — Benefits", url: "https://www.capitalone.com/credit-cards/venture-x/" },
    ],
    asOf: "2026-06-04",
  } as any,
  {
    id: "citi-double-cash",
    name: "Citi Double Cash",
    issuer: "Citi",
    cur: "ThankYou Points",
    cpp: 1.0,
    color: "#2a2a2a",
    points: 12600,
    r: { dining: 2, travel: 2, streaming: 2, groceries: 2, gas: 2, online: 2, other: 2 },
    sources: [
      { title: "Citi Double Cash — Benefits", url: "https://www.citi.com/credit-cards/citi-double-cash-credit-card" },
    ],
    asOf: "2026-06-04",
  } as any,
  {
    id: "chase-freedom-unlimited",
    name: "Chase Freedom Unlimited",
    issuer: "Chase",
    cur: "Ultimate Rewards",
    cpp: 1.25,
    color: "#2c5e3a",
    points: 7300,
    r: { dining: 3, travel: 5, streaming: 1.5, groceries: 1.5, gas: 1.5, online: 1.5, other: 1.5 },
    sources: [
      { title: "Freedom Unlimited — Benefits", url: "https://creditcards.chase.com/cash-back-credit-cards/freedom/unlimited" },
    ],
    asOf: "2026-06-04",
  } as any,
];
