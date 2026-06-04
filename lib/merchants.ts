/* Merchant intelligence: map a real-world merchant to the category its
 * purchases actually CODE as, plus the coding quirks that trip people up.
 * Deterministic and curated — the LLM's coarse intent is only a fallback.
 * The category here is the source of truth for "which card", the note is the
 * caveat we surface so the pick is trustworthy. */

import type { Category } from "./recommend";

export type MerchantHit = { merchant: string; category: Category; note?: string };

type Rule = { keys: string[]; category: Category; note?: string };

/* Order matters — first match wins, so put specific names before generic ones. */
const RULES: Rule[] = [
  // Warehouse clubs: code as wholesale, NOT groceries, on almost every card.
  { keys: ["costco"], category: "other", note: "Costco codes as wholesale (not groceries) and takes Visa only." },
  { keys: ["sam's club", "sams club", "samsclub", "bj's", "bjs wholesale"], category: "other", note: "Warehouse clubs code as wholesale, not groceries, on most cards." },

  // Superstores: usually excluded from the grocery bonus.
  { keys: ["walmart", "target"], category: "other", note: "Superstores like this are excluded from grocery bonuses on most cards." },

  // Grocery, with the Amazon nuance.
  { keys: ["whole foods"], category: "groceries", note: "Amazon-owned — on Amazon/Prime cards it may code as Amazon, not grocery." },
  { keys: ["trader joe", "kroger", "safeway", "publix", "aldi", "wegmans", "h-e-b", "heb", "albertsons", "ralphs", "supermarket", "grocery", "groceries"], category: "groceries" },

  // Grocery DELIVERY often codes as "other", not grocery.
  { keys: ["instacart", "shipt", "amazon fresh"], category: "groceries", note: "Delivery services sometimes code as the app, not as a grocery store." },

  // Gas — Costco gas is the exception that DOES code as gas.
  { keys: ["costco gas"], category: "gas", note: "Costco gas codes as a gas station (unlike Costco warehouse)." },
  { keys: ["shell", "chevron", "exxon", "mobil", "bp ", "marathon gas", "speedway", "wawa gas", "gas station", "fuel", "fill up", "fill the tank"], category: "gas" },

  // Dining — fast food / coffee count as dining on most cards.
  { keys: ["uber eats", "doordash", "grubhub", "postmates"], category: "dining", note: "Food delivery usually codes as dining." },
  { keys: ["mcdonald", "chipotle", "starbucks", "dunkin", "taco bell", "chick-fil-a", "subway", "burger", "pizza", "cafe", "coffee", "restaurant", "dining", "diner", "bar & grill", "steakhouse", "brunch", "lunch", "dinner"], category: "dining" },

  // Streaming.
  { keys: ["netflix", "spotify", "hulu", "disney+", "disney plus", "hbo", "max ", "youtube premium", "apple music", "apple tv", "peacock", "paramount", "streaming", "subscription"], category: "streaming" },

  // Rideshare: Uber/Lyft rides usually code as travel.
  { keys: ["uber", "lyft"], category: "travel", note: "Rideshare usually codes as travel (Uber Eats is dining)." },

  // Travel.
  { keys: ["airline", "flight", "delta", "united", "american airlines", "southwest", "jetblue", "hotel", "marriott", "hilton", "hyatt", "airbnb", "expedia", "booking.com", "rental car", "hertz", "avis"], category: "travel" },

  // Online / general retail.
  { keys: ["amazon", "ebay", "etsy", "best buy", "online"], category: "online" },
];

/* Normalize and match. Returns null when nothing curated matches so the caller
 * can fall back to the model's intent classification. */
export function resolveMerchant(query: string): MerchantHit | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  for (const rule of RULES) {
    const hit = rule.keys.find((k) => q.includes(k));
    if (hit) return { merchant: hit, category: rule.category, note: rule.note };
  }
  return null;
}
