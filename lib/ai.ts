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

async function call(mode: string, text: string) {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, text }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}

export async function aiClassify(text: string) {
  try { return await call("classify", text); }
  catch { return { category: kwClass(text), summary: text.slice(0, 40) }; }
}

export function normalize(obj: any) {
  return {
    id: (obj.issuer + obj.name + Math.random()).slice(0, 18),
    name: obj.name, issuer: obj.issuer,
    cur: obj.currency || obj.cur || "Points",
    cpp: obj.cpp || 1, color: hashColor(obj.name || "x"), points: 0,
    r: { dining:1, travel:1, streaming:1, groceries:1, gas:1, online:1, other:1, ...(obj.rewards || obj.r || {}) },
    note: obj.note || "",
    sources: obj.sources || [],   // [{title,url}] — show these in the UI
    asOf: obj.asOf || null,       // date the rates were pulled
  };
}

export async function aiCardLookup(query: string) {
  try { return normalize(await call("cardLookup", query)); }
  catch { return normalize({ name: query, issuer: "Card", currency: "Points", cpp: 1, rewards: {}, note: "Lookup failed — try again" }); }
}

export async function aiTripExtract(text: string): Promise<Record<string, string>> {
  try { return await call("tripExtract", text); }
  catch { return {}; }
}

export async function aiSpendExtract(text: string): Promise<{ amount?: number | null; merchantQuery?: string }> {
  try { return await call("spendExtract", text); }
  catch { return {}; }
}
