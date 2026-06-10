/* Card visual identity.
 *
 * Hybrid model: a real card image is used when one exists for the card, and a
 * faithfully *rendered* card front (issuer gradient + network badge + chip) is
 * used for everything else. Because the app lets users type ANY card, the
 * rendered front is the universal default — it never looks fake and works for
 * store cards and obscure co-brands the same as the headline products.
 *
 * To light up a real image: drop a file at `public/cards/<slug>.png` (or .jpg /
 * .webp / .svg) and add the slug → path mapping to CARD_ART below. The UI
 * (<CardArt> in app/app/page.tsx) loads it and falls back to the render on any
 * load error, so a missing or broken file is never shown.
 */

export function cardSlug(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* slug → public path. Empty until real bitmaps are added to public/cards/ so
 * we never render a broken <img>. See TOP_CARDS for the intended fill set. */
export const CARD_ART: Record<string, string> = {
  // "amex-gold": "/cards/amex-gold.png",
  // "chase-sapphire-reserve": "/cards/chase-sapphire-reserve.png",
};

export function cardArtUrl(name: string): string | null {
  return CARD_ART[cardSlug(name)] ?? null;
}

export type CardNetwork = "amex" | "visa" | "mastercard" | "discover" | null;

/* Network is only shown when we can identify it from the name/issuer — we never
 * guess (Chase/Citi/Cap One all issue on multiple networks). */
export function cardNetwork(name: string, issuer: string): CardNetwork {
  const t = `${name} ${issuer}`.toLowerCase();
  if (t.includes("american express") || /\bamex\b/.test(t)) return "amex";
  if (t.includes("discover")) return "discover";
  if (t.includes("mastercard") || t.includes("world elite")) return "mastercard";
  if (t.includes("visa")) return "visa";
  return null;
}

/* Issuer/tier-accurate gradient for the rendered front. Falls back to a
 * gradient derived from the deterministic brand color when the issuer is
 * unknown, so every card still gets a distinct, premium-looking face. */
const ISSUER_GRADIENTS: { match: RegExp; from: string; to: string; ink?: "light" | "dark" }[] = [
  { match: /platinum/, from: "#d9dde3", to: "#9aa3ad", ink: "dark" },
  { match: /(amex|american express).*gold|gold.*(amex|american express)/, from: "#caa765", to: "#9c7b3c" },
  { match: /sapphire|chase/, from: "#1c3f7c", to: "#0d2350" },
  { match: /american express|amex/, from: "#2e4a6b", to: "#16263b" },
  { match: /capital one|venture|savor|quicksilver/, from: "#9e2b25", to: "#5c1714" },
  { match: /citi|costco/, from: "#1f6fb2", to: "#114a78" },
  { match: /discover/, from: "#e8772e", to: "#b8531a" },
  { match: /wells fargo/, from: "#b8242f", to: "#7a161d" },
  { match: /bank of america|bofa/, from: "#c0202e", to: "#0a2a5e" },
  { match: /apple/, from: "#e6e7ea", to: "#bcc0c7", ink: "dark" },
  { match: /(^|\s)(gold)(\s|$)/, from: "#caa765", to: "#9c7b3c" },
];

export function cardFace(name: string, issuer: string, fallbackColor: string): { from: string; to: string; ink: "light" | "dark" } {
  const t = `${name} ${issuer}`.toLowerCase();
  for (const g of ISSUER_GRADIENTS) {
    if (g.match.test(t)) return { from: g.from, to: g.to, ink: g.ink ?? "light" };
  }
  return { from: lighten(fallbackColor, 0.12), to: darken(fallbackColor, 0.22), ink: "light" };
}

function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))); }
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0];
}
function toHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("");
}
function darken(hex: string, amt: number) { const [r, g, b] = parseHex(hex); return toHex([r * (1 - amt), g * (1 - amt), b * (1 - amt)]); }
function lighten(hex: string, amt: number) { const [r, g, b] = parseHex(hex); return toHex([r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt]); }

/* The intended real-image fill set (top ~50 by US popularity). Add bitmaps to
 * public/cards/<slug>.png and register them in CARD_ART above. */
export const TOP_CARDS = [
  "Amex Platinum", "Amex Gold", "Amex Green", "Amex Blue Cash Preferred", "Amex Blue Cash Everyday",
  "Chase Sapphire Reserve", "Chase Sapphire Preferred", "Chase Freedom Unlimited", "Chase Freedom Flex", "Chase Ink Business Preferred",
  "Capital One Venture X", "Capital One Venture", "Capital One Savor", "Capital One Quicksilver", "Capital One VentureOne",
  "Citi Double Cash", "Citi Premier", "Citi Custom Cash", "Citi Costco Anywhere", "Citi AAdvantage Platinum",
  "Discover it Cash Back", "Discover it Miles", "Wells Fargo Active Cash", "Wells Fargo Autograph", "Bank of America Customized Cash",
  "Bank of America Travel Rewards", "Bank of America Premium Rewards", "Apple Card", "U.S. Bank Altitude Reserve", "U.S. Bank Cash+",
  "Amex Hilton Honors", "Amex Hilton Honors Surpass", "Amex Marriott Bonvoy Brilliant", "Amex Delta SkyMiles Gold", "Amex Delta SkyMiles Platinum",
  "Chase United Explorer", "Chase Marriott Bonvoy Boundless", "Chase IHG One Rewards Premier", "Chase Southwest Rapid Rewards Priority", "Chase Amazon Prime Visa",
  "Capital One SavorOne", "Citi Rewards+", "Discover it Student", "Target RedCard", "Costco Anywhere Visa",
  "PayPal Cashback Mastercard", "Synchrony Amazon Store Card", "Best Buy Visa", "Delta SkyMiles Reserve", "Hilton Honors Aspire",
];
