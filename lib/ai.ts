/* Drop-in replacements for the inline aiClassify / aiCardLookup.
 * Card lookup now returns live, sourced reward data + an asOf date. */

const COLORS = ["#1A4B8C","#B79A5C","#9E2B25","#1A1A2E","#2B3A55","#3D8168","#1F6FB2","#5B4B8A"];
const hashColor = (s: string) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

const KW: Record<string, string[]> = {
  travel: ["trip","fly","flight","travel","vacation","hotel","weekend","getaway"],
  groceries: ["grocery","groceries","instacart","supermarket","produce"],
  dining: ["dinner","lunch","restaurant","dining","reservation","brunch"],
  streaming: ["streaming","netflix","spotify","subscription","disney","hulu"],
  gas: ["gas","fuel","fill up","petrol"], online: ["amazon","online","shopping"],
};
const kwClass = (t: string) => {
  t = t.toLowerCase();
  for (const [c, w] of Object.entries(KW)) if (w.some((x) => t.includes(x))) return c;
  return "other";
};

async function call(mode: string, text: string, extra?: Record<string, any>) {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, text, ...(extra || {}) }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d) throw new Error("AI service returned an unavailable response.");
  if (d.error) throw new Error(d.error);
  return d;
}

export async function aiAnalyze(text: string, inTrip = false): Promise<any> {
  try { return await call("analyze", text, { inTrip }); }
  catch { return { intent: kwClass(text), summary: text.slice(0, 40) }; }
}

export async function aiClassify(text: string) {
  try { return await call("classify", text); }
  catch { return { category: kwClass(text), summary: text.slice(0, 40) }; }
}

/* Keep only well-formed {limit, postRate} cap entries. */
function normCaps(raw: any): Record<string, { limit: number; postRate: number }> {
  const out: Record<string, { limit: number; postRate: number }> = {};
  if (raw && typeof raw === "object") {
    for (const [cat, v] of Object.entries<any>(raw)) {
      const limit = Number(v?.limit);
      if (limit > 0) out[cat] = { limit, postRate: Number(v?.postRate) || 1 };
    }
  }
  return out;
}

export function normalize(obj: any) {
  if (!obj?.name || !obj?.issuer) {
    throw new Error("Card lookup returned incomplete reward data.");
  }
  return {
    id: (obj.issuer + obj.name + Math.random()).slice(0, 18),
    name: obj.name, issuer: obj.issuer,
    cur: obj.currency || obj.cur || "Points",
    cpp: obj.cpp || 1, color: hashColor(obj.name || "x"), points: 0,
    annualFee: Number(obj.annualFee) >= 0 ? Number(obj.annualFee) || 0 : 0,
    r: { dining:1, travel:1, streaming:1, groceries:1, gas:1, online:1, other:1, ...(obj.rewards || obj.r || {}) },
    caps: normCaps(obj.caps),
    note: obj.note || "",
    sources: obj.sources || [],   // [{title,url}] — show these in the UI
    asOf: obj.asOf || null,       // date the rates were pulled
    perks: Array.isArray(obj.perks) ? obj.perks.filter((p: any) => typeof p === "string" && p.trim()) : [],
    offer: obj.offer || null,
    redemptions: Array.isArray(obj.redemptions) ? obj.redemptions.filter((p: any) => typeof p === "string" && p.trim()) : [],
    edited: false,
  };
}

export async function aiCardLookup(query: string) {
  return normalize(await call("cardLookup", query));
}

export async function aiTripExtract(text: string): Promise<Record<string, string>> {
  try { return await call("tripExtract", text); }
  catch { return {}; }
}

export async function aiSpendExtract(text: string): Promise<{ amount?: number | null; merchantQuery?: string }> {
  try { return await call("spendExtract", text); }
  catch { return {}; }
}

export type NearbyPlace = {
  name: string;
  kind: string;                 // Restaurant | Shopping | Attraction | Hotel | Nightlife
  category: string;             // reward category: dining | travel | online | other
  reservable?: boolean;
  area?: string;
  blurb?: string;
};
export type NearbyResult = { destination: string; places: NearbyPlace[]; sources?: { title: string; url: string }[]; asOf?: string };

const NEARBY_CATS = new Set(["dining", "travel", "online", "other"]);

export async function aiNearby(destination: string): Promise<NearbyResult> {
  try {
    const d = await call("nearby", destination);
    const places: NearbyPlace[] = Array.isArray(d.places)
      ? d.places
          .filter((p: any) => p && typeof p.name === "string" && p.name.trim())
          .map((p: any) => ({
            name: String(p.name).trim(),
            kind: typeof p.kind === "string" ? p.kind : "Place",
            category: NEARBY_CATS.has(p.category) ? p.category : "other",
            reservable: !!p.reservable,
            area: typeof p.area === "string" ? p.area : undefined,
            blurb: typeof p.blurb === "string" ? p.blurb : undefined,
          }))
      : [];
    return { destination: d.destination || destination, places, sources: d.sources || [], asOf: d.asOf };
  } catch {
    return { destination, places: [] };
  }
}
