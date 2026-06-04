"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { aiClassify, aiCardLookup, aiTripExtract, aiSpendExtract } from "@/lib/ai";
import { bestForCategory, bestForTrip, rateFor, type Card } from "@/lib/recommend";
import { loadProfile, saveProfile } from "@/lib/supabase";
import { SEED_CARDS } from "@/lib/seed";

type Profile = { name: string; email: string; phone: string; address: string; airport: string };
type AppData = { profile: Profile; cards: Card[]; uses: string[] };

const USE_OPTIONS = ["Travel", "Groceries", "Dining", "Streaming", "Gas", "Online", "Other"];
const CAT_LABEL: Record<string, string> = {
  travel: "Travel", groceries: "Groceries", dining: "Dining",
  streaming: "Streaming", gas: "Gas", online: "Online", other: "Everyday",
};
const MERCHANT: Record<string, { name: string; href: (q?: string) => string }> = {
  groceries: { name: "Instacart", href: () => "https://www.instacart.com/" },
  dining:    { name: "OpenTable", href: () => "https://www.opentable.com/" },
  streaming: { name: "Netflix",   href: () => "https://www.netflix.com/signup" },
  gas:       { name: "GasBuddy",  href: () => "https://www.gasbuddy.com/" },
  online:    { name: "Amazon",    href: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q || "")}` },
  other:     { name: "Search",    href: (q) => `https://www.google.com/search?q=${encodeURIComponent(q || "")}` },
};

const TRIP_PRIORITIES = [
  "Spend the least cash",
  "Rack up the most points",
  "Redeem existing points",
] as const;
type TripPriority = (typeof TRIP_PRIORITIES)[number];

type Trip = Partial<{
  rt: "round" | "one";
  to: string; from: string;
  dates: string;
  travelers: string;
  loyalty: string;
  time: string;
  cabin: string;
  bag: "yes" | "no";
  seat: "yes" | "no";
  priority: TripPriority;
}>;

type Msg =
  | { id: string; from: "bot" | "user"; kind: "text"; text: string }
  | { id: string; from: "bot"; kind: "chips"; prompt: string; options: string[]; key: keyof Trip | "intent" }
  | { id: string; from: "bot"; kind: "rec"; category: string; query?: string; amount?: number | null }
  | { id: string; from: "bot"; kind: "trip"; trip: Trip };

type View = "chat" | "cards" | "profile";

const mkId = () => Math.random().toString(36).slice(2, 10);

export default function Page() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile().then((p) => { setData(p); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="onb-wrap">
        <span className="spinner" />
      </div>
    );
  }

  if (!data) {
    return <Onboarding onDone={async (d) => { await saveProfile(d); setData(d); }} />;
  }
  return <Workspace data={data} setData={setData} />;
}

/* ============================================================ Onboarding */

function Onboarding({ onDone }: { onDone: (d: AppData) => void }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({ name: "", email: "", phone: "", address: "", airport: "" });
  const [cards, setCards] = useState<Card[]>([]);
  const [uses, setUses] = useState<string[]>([]);

  const canNext =
    (step === 0 && profile.name && profile.email && profile.phone) ||
    (step === 1 && profile.address && profile.airport) ||
    (step === 2 && cards.length > 0) ||
    (step === 3 && uses.length > 0);

  return (
    <div className="onb-wrap">
      <div className="onb-card fade">
        <div className="onb-steps">
          {[0, 1, 2, 3].map((i) => <div key={i} className={`onb-step ${i <= step ? "on" : ""}`} />)}
        </div>

        {step === 0 && (
          <>
            <h2>Welcome to PointsPilot</h2>
            <p className="lead">Tell us a bit about you. We'll never use this for anything other than pre-filling handoffs.</p>
            <Field label="Full name" value={profile.name}  onChange={(v) => setProfile({ ...profile, name: v })} />
            <Field label="Email"     value={profile.email} onChange={(v) => setProfile({ ...profile, email: v })} type="email" />
            <Field label="Phone"     value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} type="tel" />
          </>
        )}

        {step === 1 && (
          <>
            <h2>Booking basics</h2>
            <p className="lead">We pre-fill these on the merchant handoffs.</p>
            <Field label="Home address (deliveries)" value={profile.address} onChange={(v) => setProfile({ ...profile, address: v })} />
            <Field label="Home airport (e.g. JFK)"   value={profile.airport} onChange={(v) => setProfile({ ...profile, airport: v.toUpperCase() })} />
          </>
        )}

        {step === 2 && (
          <CardPicker cards={cards} setCards={setCards} />
        )}

        {step === 3 && (
          <>
            <h2>What will you use it for?</h2>
            <p className="lead">Pick as many as apply.</p>
            <div className="row">
              {USE_OPTIONS.map((u) => {
                const on = uses.includes(u);
                return (
                  <button key={u} className={`chip ${on ? "selected" : ""}`}
                    onClick={() => setUses(on ? uses.filter((x) => x !== u) : [...uses, u])}>
                    {u}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="onb-foot">
          <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</button>
          <div className="spacer" />
          {step < 3 ? (
            <button className="btn btn-primary btn-lg" disabled={!canNext} onClick={() => setStep((s) => Math.min(3, s + 1))}>Continue</button>
          ) : (
            <button className="btn btn-primary btn-lg" disabled={!canNext} onClick={() => onDone({ profile, cards, uses })}>Finish</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ============================================================ Card picker */

function CardPicker({ cards, setCards }: { cards: Card[]; setCards: (c: Card[]) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    const query = q.trim();
    if (!query || busy) return;
    setBusy(true); setErr(null);
    try {
      const card = await aiCardLookup(query);
      setCards([...cards, card]);
      setQ("");
    } catch (e: any) {
      setErr(e?.message || "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  function seed() {
    const existing = new Set(cards.map((c) => c.id));
    const add = SEED_CARDS.filter((c) => !existing.has(c.id));
    setCards([...cards, ...add]);
  }

  return (
    <>
      <h2>Your cards</h2>
      <p className="lead">Type any card — personal, store, or co-brand. We look up live rewards. No keys yet? Use seed for the demo.</p>

      <div className="row" style={{ marginBottom: 12, alignItems: "center" }}>
        <input className="input input-lg" style={{ flex: 1 }}
          placeholder='e.g. "Amex Gold", "Target RedCard"'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn btn-primary btn-lg" onClick={add} disabled={busy || !q.trim()}>
          {busy ? <span className="spinner" /> : "Add card"}
        </button>
        <button className="btn btn-lg" onClick={seed} title="Load demo cards">Seed demo</button>
      </div>

      {err && <div className="tag" style={{ background: "#fdecef", borderColor: "#f3c6cf", color: "#a02a4b", marginBottom: 8 }}>{err}</div>}

      <div className="col">
        {cards.map((c, i) => (
          <CardTile key={c.id + i} card={c}
            onBalance={(n) => { const next = [...cards]; next[i] = { ...c, points: n }; setCards(next); }}
            onRemove={() => setCards(cards.filter((_, j) => j !== i))} />
        ))}
        {!cards.length && <div className="muted" style={{ fontSize: 12, padding: 6 }}>No cards yet — add one or click <b>Seed demo</b>.</div>}
      </div>
    </>
  );
}

function CardTile({ card, onBalance, onRemove, expanded = true }: { card: Card; onBalance: (n: number) => void; onRemove: () => void; expanded?: boolean }) {
  const sources = (card as any).sources as { title: string; url: string }[] | undefined;
  const asOf = (card as any).asOf as string | undefined;
  const balanceUsd = (card.points * card.cpp) / 100;

  // Sort categories by effective % value
  const rows = Object.entries(card.r || {})
    .map(([cat, rate]) => ({ cat, rate: Number(rate) || 1, value: (Number(rate) || 1) * card.cpp }))
    .filter((r) => r.cat !== "other")
    .sort((a, b) => b.value - a.value);
  const otherRate = card.r?.other ?? 1;
  rows.push({ cat: "other", rate: otherRate, value: otherRate * card.cpp });

  const topRow = rows[0];

  return (
    <div className="card-tile-wrap fade">
      <div className="card-tile">
        <div className="swatch" style={{ background: card.color }} />
        <div className="meta">
          <div className="name">{card.name}</div>
          <div className="sub">
            {card.issuer} · <span className="mono">{card.cpp.toFixed(2)}¢/pt</span> · best on <b style={{ color: "var(--fg-1)" }}>{CAT_LABEL[topRow.cat] || topRow.cat}</b> ({topRow.rate.toFixed(1)}×)
          </div>
          {(sources?.length || asOf) && (
            <div className="sources">
              {asOf && <span className="muted" style={{ fontSize: 11 }}>asOf {asOf}</span>}
              {sources?.slice(0, 2).map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer">source {i + 1}</a>
              ))}
            </div>
          )}
        </div>
        <input className="bal" type="number" min={0} placeholder="pts" value={card.points || ""} onChange={(e) => onBalance(Number(e.target.value) || 0)} />
        <button className="remove" onClick={onRemove} aria-label="remove">×</button>
      </div>
      {expanded && (
        <div className="card-breakdown">
          <div className="bd-head">
            <span className="bd-title">Where to use this card</span>
            {card.points > 0 && (
              <span className="bd-balance">
                {card.points.toLocaleString()} pts ≈ <b>${balanceUsd.toFixed(2)}</b>
              </span>
            )}
          </div>
          <div className="bd-grid">
            {rows.map((r) => (
              <div key={r.cat} className={`bd-row ${r === rows[0] ? "best" : ""}`}>
                <span className={`tag tag-cat`} data-cat={r.cat}>{CAT_LABEL[r.cat] || r.cat}</span>
                <span className="bd-rate"><span className="mono">{r.rate.toFixed(1)}×</span></span>
                <span className="bd-value mono">{r.value.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================ Workspace */

function Workspace({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const [view, setView] = useState<View>("chat");

  const totalPoints = data.cards.reduce((s, c) => s + (c.points || 0), 0);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sb-head">
          <div className="logo">P</div>
          <div>
            <div className="ws">PointsPilot</div>
            <div className="ws-sub">{data.profile.name.split(" ")[0] || "you"}'s workspace</div>
          </div>
        </div>

        <div className="sb-section">Workspace</div>
        <SbItem icon="◐" label="Chat"    active={view === "chat"}    onClick={() => setView("chat")} />
        <SbItem icon="□" label="My cards" active={view === "cards"}  onClick={() => setView("cards")} />
        <SbItem icon="○" label="Profile" active={view === "profile"} onClick={() => setView("profile")} />

        <div className="sb-section">At a glance</div>
        <div className="sb-card">
          <div className="sb-stat-row"><span>Cards</span><span className="v">{data.cards.length}</span></div>
          <div className="sb-stat-row"><span>Points balance</span><span className="v gold">{totalPoints.toLocaleString()}</span></div>
          <div className="sb-stat-row"><span>Home airport</span><span className="v">{data.profile.airport || "—"}</span></div>
        </div>

        <div className="sb-foot">
          <div className="sb-user">
            <div className="avatar">{(data.profile.name[0] || "U").toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="who" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.profile.name || "User"}</div>
              <div className="who-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.profile.email}</div>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ width: "100%", marginTop: 4, justifyContent: "flex-start" }}
            onClick={() => { if (confirm("Reset profile?")) { localStorage.removeItem("pp_device"); location.reload(); } }}>
            Reset profile
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="crumb">
            <span className="ws">PointsPilot</span>
            <span className="sep">/</span>
            <span className="page-name">{view === "chat" ? "Chat" : view === "cards" ? "My cards" : "Profile"}</span>
          </div>
          <div className="right">
            {view === "chat" && (
              <>
                <span className="muted" style={{ fontSize: 12 }}>Ask anything</span>
                <span className="kbd">/</span>
              </>
            )}
          </div>
        </div>

        {view === "chat" && <ChatView data={data} />}
        {view === "cards" && <CardsView data={data} setData={setData} />}
        {view === "profile" && <ProfileView data={data} />}
      </div>
    </div>
  );
}

function SbItem({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button className={`sb-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/* ============================================================ Chat view */

const TRIP_SEQ: { key: keyof Trip; prompt: string; options?: string[]; freeform?: boolean }[] = [
  { key: "rt",        prompt: "Round trip or one-way?", options: ["Round trip", "One-way"] },
  { key: "to",        prompt: "Where to? (type the city or airport)", freeform: true },
  { key: "dates",     prompt: "When? (e.g. Jul 12–18)", freeform: true },
  { key: "travelers", prompt: "How many travelers?", options: ["1", "2", "3", "4+"] },
  { key: "loyalty",   prompt: "Airline loyalty / miles? Type the program, or \"none\".", freeform: true },
  { key: "time",      prompt: "Preferred time?", options: ["Morning", "Afternoon", "Evening", "No preference"] },
  { key: "cabin",     prompt: "Cabin?", options: ["Basic", "Economy", "Business", "First"] },
  { key: "bag",       prompt: "Checked bag?", options: ["Yes", "No"] },
  { key: "seat",      prompt: "Choose your own seat?", options: ["Yes", "No"] },
  { key: "priority",  prompt: "What matters most on this trip?", options: [...TRIP_PRIORITIES] },
];

function ChatView({ data }: { data: AppData }) {
  const firstName = data.profile.name.split(" ")[0] || "there";
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: mkId(), from: "bot", kind: "text", text: `What are we buying or booking today?` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  function push(m: Msg) { setMsgs((arr) => [...arr, m]); }

  function nextMissingIdx(t: Trip, start = 0): number {
    for (let i = start; i < TRIP_SEQ.length; i++) {
      const v = t[TRIP_SEQ[i].key];
      if (v === undefined || v === "" || v === null) return i;
    }
    return -1;
  }

  function pushTripQuestion(current: Trip) {
    const i = nextMissingIdx(current);
    if (i === -1) { finalizeTrip(current); return; }
    const q = TRIP_SEQ[i];
    if (q.options) {
      push({ id: mkId(), from: "bot", kind: "chips", prompt: q.prompt, options: q.options, key: q.key });
    } else {
      push({ id: mkId(), from: "bot", kind: "text", text: q.prompt });
    }
  }

  function mergeTrip(base: Trip, patch: Record<string, any>): Trip {
    const out: any = { ...base };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === "") continue;
      out[k] = v;
    }
    if (out.to && !out.from) out.from = data.profile.airport || "";
    return out;
  }

  function answerTrip(key: keyof Trip, value: string) {
    const patch: any = {};
    if (key === "rt") patch.rt = value === "Round trip" ? "round" : "one";
    else if (key === "bag" || key === "seat") patch[key] = value.toLowerCase();
    else patch[key] = value;
    const norm = mergeTrip(trip || {}, patch);
    setTrip(norm);
    push({ id: mkId(), from: "user", kind: "text", text: value });
    pushTripQuestion(norm);
  }

  function finalizeTrip(t: Trip) {
    push({ id: mkId(), from: "bot", kind: "trip", trip: t });
    setTrip(null);
  }

  function summarizeKnown(t: Trip): string {
    const bits: string[] = [];
    if (t.to) bits.push(`to ${t.to}`);
    if (t.from) bits.push(`from ${t.from}`);
    if (t.dates) bits.push(t.dates);
    if (t.travelers) bits.push(`${t.travelers} traveler${t.travelers === "1" ? "" : "s"}`);
    if (t.cabin) bits.push(t.cabin.toLowerCase());
    if (t.rt) bits.push(t.rt === "one" ? "one-way" : "round trip");
    return bits.length ? `Got it — ${bits.join(", ")}.` : "Got it — let's plan the trip.";
  }

  async function handleSubmit(text: string) {
    const v = text.trim();
    if (!v || busy) return;
    setInput("");
    push({ id: mkId(), from: "user", kind: "text", text: v });
    setBusy(true);

    try {
      // Mid-trip free-text answer → extract structured details from message
      if (trip) {
        const extracted = await aiTripExtract(v);
        let merged = mergeTrip(trip, extracted);
        // If a freeform question was pending and the model extracted nothing useful, take their text as that answer
        const pendingIdx = nextMissingIdx(trip);
        const pending = pendingIdx >= 0 ? TRIP_SEQ[pendingIdx] : null;
        if (pending?.freeform && merged[pending.key] === trip[pending.key]) {
          merged = mergeTrip(merged, { [pending.key]: v });
        }
        setTrip(merged);
        pushTripQuestion(merged);
        return;
      }

      // New chat input — classify intent
      const { category } = await aiClassify(v);
      const cat = (category || "other").toLowerCase();

      if (cat === "travel") {
        const extracted = await aiTripExtract(v);
        const seed = mergeTrip({}, extracted);
        setTrip(seed);
        push({ id: mkId(), from: "bot", kind: "text", text: summarizeKnown(seed) });
        pushTripQuestion(seed);
      } else {
        const spend = await aiSpendExtract(v);
        push({ id: mkId(), from: "bot", kind: "rec", category: cat, query: spend.merchantQuery || v, amount: spend.amount ?? null });
      }
    } catch {
      push({ id: mkId(), from: "bot", kind: "text", text: "Sorry — couldn't understand that. Try again?" });
    } finally {
      setBusy(false);
    }
  }

  const suggestions = ["Book a trip to Miami", "Weekly groceries run", "Add a streaming subscription", "Fill up the tank"];

  return (
    <div className="chat">
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {msgs.length === 1 && (
            <div className="greeting fade">
              <div className="hi">Hi {firstName} 👋</div>
              <div className="sub">Tell me what you're buying or booking — I'll pick the right card.</div>
            </div>
          )}
          {msgs.map((m) => <MsgView key={m.id} m={m} data={data} onChip={answerTrip} />)}
          {msgs.length === 1 && (
            <div className="row fade" style={{ justifyContent: "center" }}>
              {suggestions.map((s) => (
                <button key={s} className="chip" onClick={() => handleSubmit(s)}>{s}</button>
              ))}
            </div>
          )}
          {busy && (
            <div className="msg bot fade">
              <div className="avatar">P</div>
              <div className="bubble"><span className="spinner" /> <span className="muted">thinking…</span></div>
            </div>
          )}
        </div>
      </div>

      <div className="chat-input-wrap">
        <div className="chat-input-row">
          <input
            placeholder="What are we buying or booking?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit(input)} />
          <button className="btn btn-primary" onClick={() => handleSubmit(input)} disabled={!input.trim() || busy}>
            Send <span className="kbd" style={{ background: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.2)", color: "white" }}>↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MsgView({ m, data, onChip }: { m: Msg; data: AppData; onChip: (k: keyof Trip, v: string) => void }) {
  if (m.kind === "text") {
    return (
      <div className={`msg ${m.from}`}>
        <div className="avatar">{m.from === "bot" ? "P" : (data.profile.name[0] || "U").toUpperCase()}</div>
        <div className="bubble">{m.text}</div>
      </div>
    );
  }
  if (m.kind === "chips") {
    return (
      <div className="msg bot">
        <div className="avatar">P</div>
        <div className="bubble">
          <div style={{ marginBottom: 8 }}>{m.prompt}</div>
          <div className="row">
            {m.options.map((o) => (
              <button key={o} className="chip" onClick={() => onChip(m.key as keyof Trip, o)}>{o}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (m.kind === "rec") {
    return (
      <div className="msg bot">
        <div className="avatar">P</div>
        <div className="bubble" style={{ width: "100%" }}>
          <RecCard category={m.category} query={m.query || ""} data={data} amount={m.amount ?? null} />
        </div>
      </div>
    );
  }
  if (m.kind === "trip") {
    return (
      <div className="msg bot">
        <div className="avatar">P</div>
        <div className="bubble" style={{ width: "100%" }}>
          <TripResult trip={m.trip} data={data} />
        </div>
      </div>
    );
  }
  return null;
}

/* ============================================================ Rec card */

function RecCard({ category, query, data, amount }: { category: string; query: string; data: AppData; amount: number | null }) {
  const ranked = useMemo(() => bestForCategory(data.cards, category), [data.cards, category]);
  if (!ranked.length) {
    return <div className="muted">Add a card first — open My cards in the sidebar.</div>;
  }
  const pick = ranked[0];
  const backup = ranked[1];
  const m = MERCHANT[category] || MERCHANT.other;
  const link = m.href(query);

  const rate = rateFor(pick, category);
  const valuePct = rate * pick.cpp;           // % effective value
  const baselineRate = 1;                     // default 1× card baseline
  const spend = amount && amount > 0 ? amount : 100;
  const ptsEarned = Math.round(rate * spend);
  const dollarEarned = (rate * spend * pick.cpp) / 100;
  const savedVsBaseline = ((rate - baselineRate) * spend * pick.cpp) / 100;

  return (
    <div className="rec fade">
      <div className="head">
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <span className="tag tag-cat" data-cat={category}>{CAT_LABEL[category] || "Everyday"}</span>
          <span className="muted" style={{ fontSize: 12 }}>{m.name} handoff</span>
        </div>
        <span className="headline-value">
          <span className="v">{valuePct.toFixed(2)}%</span>
          <span className="u">back</span>
        </span>
      </div>
      <h3>Use {pick.name}</h3>
      <div className="why">
        <b>{rate.toFixed(1)}×</b> on {CAT_LABEL[category] || "this"} · <span className="mono">{pick.cpp.toFixed(2)}¢/pt</span>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: amount ? "repeat(3,1fr)" : "repeat(3,1fr)" }}>
        <div className="stat">
          <div className="label">Spend</div>
          <div className="val">${spend.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="label">You earn</div>
          <div className="val">{ptsEarned.toLocaleString()} <span className="muted" style={{ fontSize: 11 }}>pts</span></div>
        </div>
        <div className="stat">
          <div className="label">≈ Value</div>
          <div className="val" style={{ color: "var(--gold-text)" }}>${dollarEarned.toFixed(2)}</div>
        </div>
      </div>

      {savedVsBaseline > 0 && (
        <div className="tag gold" style={{ marginBottom: 12 }}>
          Save +${savedVsBaseline.toFixed(2)} vs a default 1× card
        </div>
      )}

      <div className="card-tile" style={{ marginBottom: 8 }}>
        <div className="swatch" style={{ background: pick.color }} />
        <div className="meta">
          <div className="name">{pick.name}</div>
          <div className="sub">{pick.issuer} · {pick.cur}</div>
        </div>
        <span />
        <span className="tag gold">{rateFor(pick, category).toFixed(1)}×</span>
      </div>

      {backup && (
        <>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", margin: "10px 0 6px" }}>Backup</div>
          <div className="card-tile">
            <div className="swatch" style={{ background: backup.color }} />
            <div className="meta">
              <div className="name">{backup.name}</div>
              <div className="sub">{backup.issuer}</div>
            </div>
            <span />
            <span className="tag">{rateFor(backup, category).toFixed(1)}×</span>
          </div>
        </>
      )}

      <div className="divider" />
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Pre-filled handoff</div>
      <div style={{ fontSize: 13, color: "var(--fg-1)", marginBottom: 12 }}>
        Deliver to <b style={{ color: "var(--fg-0)" }}>{data.profile.address || "your address"}</b> · {data.profile.email}
      </div>
      <a className="btn btn-primary btn-lg" href={link} target="_blank" rel="noreferrer">
        Continue to {m.name} →
      </a>
      <div className="footer-note">
        The link pre-fills the search only. Anything behind a login or merchant-specific fields needs a browser agent.
      </div>
    </div>
  );
}

/* ============================================================ Trip result */

function TripResult({ trip, data }: { trip: Trip; data: AppData }) {
  const priority = (trip.priority as TripPriority) || "Spend the least cash";
  const { pick, why } = bestForTrip(data.cards, priority);
  const url = buildFlightsUrl(trip, data.profile.airport);
  const cashValue = pick ? (pick.points * pick.cpp) / 100 : 0;

  return (
    <div className="rec fade">
      <div className="head">
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <span className="tag tag-cat" data-cat="travel">Travel</span>
          <span className="muted" style={{ fontSize: 12 }}>Google Flights handoff</span>
        </div>
        <span className="tag">{(trip.priority || "Spend the least cash")}</span>
      </div>
      <h3>{pick ? `Pay with ${pick.name}` : "Add a card first"}</h3>
      <div className="why">{why}</div>

      <div className="stat-grid">
        <div className="stat"><div className="label">Route</div><div className="val">{trip.from || data.profile.airport || "?"} → {trip.to || "?"}</div></div>
        <div className="stat"><div className="label">Dates</div><div className="val" style={{ fontSize: 13 }}>{trip.dates || "?"}</div></div>
        <div className="stat"><div className="label">Travelers</div><div className="val">{trip.travelers || "1"}</div></div>
      </div>

      {pick && (
        <>
          <div className="card-tile">
            <div className="swatch" style={{ background: pick.color }} />
            <div className="meta">
              <div className="name">{pick.name}</div>
              <div className="sub">
                {rateFor(pick, "travel").toFixed(1)}× travel · <span className="mono">{pick.points.toLocaleString()}</span> pts ≈ <b style={{ color: "var(--gold-text)" }}>${cashValue.toFixed(0)}</b>
              </div>
            </div>
            <span />
            <span className="tag gold">pick</span>
          </div>
          {pick.points > 0 && (
            <div className="tag gold" style={{ marginTop: 10 }}>
              Your {pick.cur} balance is worth ≈ ${cashValue.toFixed(2)} toward this trip
            </div>
          )}
        </>
      )}

      <div className="divider" />
      <a className="btn btn-primary btn-lg" href={url} target="_blank" rel="noreferrer">
        Open Google Flights →
      </a>
      <div className="footer-note">
        Route, dates, travelers & cabin go in the link. Bag ({trip.bag || "?"}), seat ({trip.seat || "?"}), and anything behind a login need a browser agent.
      </div>
    </div>
  );
}

function buildFlightsUrl(t: Trip, homeAirport?: string) {
  const from = t.from || homeAirport || "";
  const to = t.to || "";
  const pax = (t.travelers || "1").replace("+", "");
  const cabinMap: Record<string, string> = { Basic: "economy", Economy: "economy", Business: "business", First: "first" };
  const cabin = cabinMap[t.cabin || "Economy"] || "economy";
  const rt = t.rt === "one" ? "one-way" : "round-trip";
  const dates = t.dates || "";
  const q = `Flights from ${from} to ${to} ${dates} ${rt} ${pax} adults ${cabin}`.replace(/\s+/g, " ").trim();
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

/* ============================================================ Cards view */

function CardsView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    const query = q.trim();
    if (!query || busy) return;
    setBusy(true); setErr(null);
    try {
      const card = await aiCardLookup(query);
      const next = { ...data, cards: [...data.cards, card] };
      setData(next); await saveProfile(next); setQ("");
    } catch (e: any) {
      setErr(e?.message || "Lookup failed");
    } finally { setBusy(false); }
  }

  async function seed() {
    const existing = new Set(data.cards.map((c) => c.id));
    const add = SEED_CARDS.filter((c) => !existing.has(c.id));
    const next = { ...data, cards: [...data.cards, ...add] };
    setData(next); await saveProfile(next);
  }

  async function update(i: number, patch: Partial<Card>) {
    const cards = [...data.cards]; cards[i] = { ...cards[i], ...patch };
    const next = { ...data, cards }; setData(next); await saveProfile(next);
  }
  async function remove(i: number) {
    const next = { ...data, cards: data.cards.filter((_, j) => j !== i) };
    setData(next); await saveProfile(next);
  }

  return (
    <div className="content">
      <div className="page">
        <div className="page-head">
          <h1>My cards</h1>
          <p>Add cards by name — we pull live reward rates. Or seed demo cards for the showcase.</p>
        </div>

        <div className="row" style={{ marginBottom: 18, alignItems: "center" }}>
          <input className="input input-lg" style={{ flex: 1, maxWidth: 460 }}
            placeholder='Try "Amex Gold", "Chase Sapphire Reserve", "Target RedCard"'
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn btn-primary btn-lg" onClick={add} disabled={busy || !q.trim()}>
            {busy ? <span className="spinner" /> : "Add card"}
          </button>
          <button className="btn btn-lg" onClick={seed}>Seed demo</button>
        </div>

        {err && <div className="tag" style={{ background: "#fdecef", borderColor: "#f3c6cf", color: "#a02a4b", marginBottom: 12 }}>{err}</div>}

        {!data.cards.length ? (
          <div className="empty">
            <div className="big">No cards yet</div>
            <div className="small">Click <b>Seed demo</b> to load 5 realistic cards, or add your own above.</div>
          </div>
        ) : (
          <div className="col">
            {data.cards.map((c, i) => (
              <CardTile key={c.id + i} card={c} onBalance={(n) => update(i, { points: n })} onRemove={() => remove(i)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================ Profile view */

function ProfileView({ data }: { data: AppData }) {
  return (
    <div className="content">
      <div className="page">
        <div className="page-head">
          <h1>Profile</h1>
          <p>What we use for pre-filled handoffs.</p>
        </div>
        <div className="card">
          <Row k="Name"    v={data.profile.name} />
          <Row k="Email"   v={data.profile.email} />
          <Row k="Phone"   v={data.profile.phone} />
          <Row k="Address" v={data.profile.address} />
          <Row k="Home airport" v={data.profile.airport} mono />
          <Row k="Use cases" v={data.uses.join(", ")} />
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)", justifyContent: "space-between", gap: 12 }}>
      <span className="muted" style={{ fontSize: 13 }}>{k}</span>
      <span style={{ fontSize: 13, color: "var(--fg-0)", textAlign: "right" }} className={mono ? "mono" : ""}>{v || "—"}</span>
    </div>
  );
}
