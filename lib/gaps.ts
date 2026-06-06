import { CATEGORIES, bestForCategory, type Card } from "./recommend";

export type WalletCoverage = {
  category: string;
  currentBestName: string | null;
  currentValuePct: number;
};

export function summarizeWalletCoverage(cards: Card[], uses: string[]): WalletCoverage[] {
  const cats = Array.from(new Set(uses.map((u) => u.toLowerCase()))).filter((c) =>
    (CATEGORIES as string[]).includes(c),
  );

  return cats.map((category) => {
    const current = bestForCategory(cards, category)[0];
    return {
      category,
      currentBestName: current?.name ?? null,
      currentValuePct: current?.value ?? 0,
    };
  });
}
