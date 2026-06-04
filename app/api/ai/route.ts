import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/* OpenRouter via the OpenAI-compatible v1 endpoint. Key stays server-side.
 * Lazy-init so `next build` doesn't fail when env vars are absent. */
let _ai: OpenAI | null = null;
function ai(): OpenAI {
  if (_ai) return _ai;
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  _ai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: key,
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_REFERRER || "http://localhost:3000",
      "X-Title": "PointsPilot",
    },
  });
  return _ai;
}
const DEPLOYMENT = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

/* Supabase (service role, server only) — used as a lookup cache. Optional. */
const supa =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

const CACHE_DAYS = 30;
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);

/* ---- Tavily web search (LLM-ready results) ---- */
async function webSearch(query: string) {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
    }),
  });
  if (!r.ok) throw new Error(`Tavily ${r.status}`);
  return r.json() as Promise<{ answer?: string; results: { title: string; url: string; content: string }[] }>;
}

/* ---- intent classification (no search needed) ---- */
async function classify(text: string) {
  const c = await ai().chat.completions.create({
    model: DEPLOYMENT,
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Classify this shopping intent into one category and a 4-6 word summary.
Categories: travel, groceries, dining, streaming, gas, online, other.
Message: "${text}"
Respond ONLY as JSON: {"category":"...","summary":"..."}`,
    }],
  });
  return JSON.parse(c.choices[0]?.message?.content || "{}");
}

/* ---- card lookup: search the live web, then extract structured rewards ---- */
async function cardLookup(query: string) {
  const k = keyOf(query);

  // 1. cache hit?
  if (supa) {
    const { data } = await supa.from("card_cache").select("*").eq("key", k).maybeSingle();
    if (data) {
      const ageDays = (Date.now() - new Date(data.fetched_at).getTime()) / 86400000;
      if (ageDays < CACHE_DAYS) return { ...data.payload, cached: true };
    }
  }

  // 2. live search
  const year = new Date().getFullYear();
  const search = await webSearch(`${query} credit card rewards rates earning categories ${year}`);
  const context = (search.results || [])
    .map((r) => `SOURCE: ${r.title} (${r.url})\n${r.content}`)
    .join("\n\n---\n\n");
  const sources = (search.results || []).slice(0, 4).map((r) => ({ title: r.title, url: r.url }));

  // 3. extract structured rewards grounded in the search results
  const c = await ai().chat.completions.create({
    model: DEPLOYMENT,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Using ONLY the web results below, extract the current reward profile for the card the user named.
- If a multiplier isn't stated, use 1. Do not invent rates.
- "annualFee" = the card's annual fee in US dollars (0 if no annual fee / "$0").
- "caps" = for any category whose bonus rate ONLY applies up to an annual spending limit, give {"limit": dollars-per-year, "postRate": multiplier-after-the-cap}. Example: Amex Gold 4x groceries up to $25,000/yr then 1x -> "groceries":{"limit":25000,"postRate":1}. Omit categories with no cap. Only include caps actually stated in the sources.
- "perks" = up to 5 short bullets (≤ 10 words each) describing concrete benefits: monthly/annual credits, free subscriptions (DashPass, Uber One, Walmart+, ShopRunner, etc.), lounge access, travel insurance, statement credits, anniversary points. Only include perks actually stated in the sources.
- "offer" = current welcome / signup bonus if stated (e.g. "90,000 pts after $6k spend in 6 months"), else null.
- "redemptions" = up to 3 short bullets describing notable redemption sweet spots (transfer partners, travel portal multipliers), only if mentioned.

CARD: "${query}"
WEB RESULTS:
${context || "(no results found)"}

Respond ONLY as JSON:
{
  "name": "",
  "issuer": "",
  "currency": "",
  "cpp": 1.0,
  "annualFee": 0,
  "rewards": {"dining":0,"travel":0,"streaming":0,"groceries":0,"gas":0,"online":0,"other":0},
  "caps": {},
  "note": "one short line",
  "perks": [],
  "offer": null,
  "redemptions": []
}`,
    }],
  });
  const payload = { ...JSON.parse(c.choices[0]?.message?.content || "{}"), sources, asOf: new Date().toISOString().slice(0, 10) };

  // 4. cache it
  if (supa) await supa.from("card_cache").upsert({ key: k, payload, fetched_at: new Date().toISOString() });

  return payload;
}

/* ---- unified analyzer: intent + trip fields + spend in ONE call ---- */
async function analyze(text: string, inTrip: boolean) {
  const c = await ai().chat.completions.create({
    model: DEPLOYMENT,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `You're a credit-card concierge. The user said: "${text}"
${inTrip ? "(They are currently mid-flight in a trip-booking dialog. Treat their message as either an answer to the next question or a richer description of the trip.)" : ""}

Return a single JSON object. Always include "intent". Include any other field ONLY if the user clearly stated it.

Schema:
{
  "intent": "travel" | "groceries" | "dining" | "streaming" | "gas" | "online" | "other",
  "summary": "4-6 word summary of what they want",
  // Travel fields (omit any not stated):
  "to": "city or airport code",
  "from": "city or airport code",
  "dates": "their phrasing",
  "rt": "round" | "one",
  "travelers": "1" | "2" | "3" | "4+",
  "cabin": "Basic" | "Economy" | "Business" | "First",
  "bag": "yes" | "no",
  "seat": "yes" | "no",
  "time": "Morning" | "Afternoon" | "Evening" | "No preference",
  "loyalty": "program name or none",
  "priority": "Spend the least cash" | "Rack up the most points" | "Redeem existing points",
  // Non-travel fields:
  "amount": number-in-dollars,
  "merchantQuery": "search term"
}

Examples:
"book a one-way to LAX next Fri in business, no bag" -> {"intent":"travel","summary":"flight to LAX","to":"LAX","rt":"one","dates":"next Friday","cabin":"Business","bag":"no"}
"spend $200 at whole foods" -> {"intent":"groceries","summary":"$200 at Whole Foods","amount":200,"merchantQuery":"Whole Foods"}
"netflix subscription" -> {"intent":"streaming","summary":"Netflix subscription","merchantQuery":"Netflix subscription"}`,
    }],
  });
  return JSON.parse(c.choices[0]?.message?.content || "{}");
}

/* ---- natural-language trip extractor ---- */
async function tripExtract(text: string) {
  const c = await ai().chat.completions.create({
    model: DEPLOYMENT,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `Extract structured trip-booking details the user explicitly mentioned. Return JSON containing ONLY the keys the user clearly stated — omit anything not mentioned.

Acceptable values:
- to / from: city name or 3-letter airport code
- dates: keep their phrasing
- rt: "round" if round-trip, "one" if one-way
- travelers: "1" | "2" | "3" | "4+"
- cabin: "Basic" | "Economy" | "Business" | "First"
- bag: "yes" | "no"
- seat: "yes" | "no" (whether they want to pick their own seat)
- time: "Morning" | "Afternoon" | "Evening" | "No preference"
- loyalty: airline program name, or "none"
- priority: "Spend the least cash" | "Rack up the most points" | "Redeem existing points"

Message: "${text}"

Respond with ONLY the keys the user stated. Examples:
"Book a trip to Miami for 2 people next weekend" -> {"to":"Miami","travelers":"2","dates":"next weekend"}
"one-way to LAX in business, no bag" -> {"to":"LAX","rt":"one","cabin":"Business","bag":"no"}`,
    }],
  });
  return JSON.parse(c.choices[0]?.message?.content || "{}");
}

/* ---- non-travel spend extractor (amount, normalized merchant query) ---- */
async function spendExtract(text: string) {
  const c = await ai().chat.completions.create({
    model: DEPLOYMENT,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 150,
    messages: [{
      role: "user",
      content: `Extract spend details from the user's shopping message. Return JSON with whatever is stated:
{"amount": number-in-dollars-or-null, "merchantQuery": "short search term they'd type"}

Message: "${text}"
Example: "Spend $200 at Whole Foods" -> {"amount":200,"merchantQuery":"Whole Foods groceries"}
Example: "Weekly groceries" -> {"amount":null,"merchantQuery":"weekly groceries"}`,
    }],
  });
  return JSON.parse(c.choices[0]?.message?.content || "{}");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, text, inTrip } = body;
    if (mode === "classify")    return NextResponse.json(await classify(text));
    if (mode === "cardLookup")  return NextResponse.json(await cardLookup(text));
    if (mode === "tripExtract") return NextResponse.json(await tripExtract(text));
    if (mode === "spendExtract")return NextResponse.json(await spendExtract(text));
    if (mode === "analyze")     return NextResponse.json(await analyze(text, !!inTrip));
    return NextResponse.json({ error: "unknown mode" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
