"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { aiClassify, aiCardLookup, aiAnalyze } from "@/lib/ai";
import { bestForCategory, bestForTrip, rateFor, ceilingFor, type Card } from "@/lib/recommend";
import { resolveMerchant } from "@/lib/merchants";
import { loadProfile, saveProfile } from "@/lib/supabase";

type Profile = { name: string; email: string; phone: string; address: string; airport: string };
type AppData = { profile: Profile; cards: Card[]; uses: string[]; spend?: Record<string, number> };

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

  return (
    <>
      <h2>Your cards</h2>
      <p className="lead">Type any card — personal, store, or co-brand. We pull live reward rates from the web.</p>

      <div className="row" style={{ marginBottom: 12, alignItems: "center" }}>
        <input className="input input-lg" style={{ flex: 1 }}
          placeholder='e.g. "Amex Gold", "Chase Sapphire Preferred"'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn btn-primary btn-lg" onClick={add} disabled={busy || !q.trim()}>
          {busy ? <span className="spinner" /> : "Add card"}
        </button>
      </div>

      {err && <div className="tag" style={{ background: "#fdecef", borderColor: "#f3c6cf", color: "#a02a4b", marginBottom: 8 }}>{err}</div>}

      <div className="col">
        {cards.map((c, i) => (
          <CardTile key={c.id + i} card={c}
            onBalance={(n) => { const next = [...cards]; next[i] = { ...c, points: n }; setCards(next); }}
            onEdit={(patch) => { const next = [...cards]; next[i] = { ...c, ...patch }; setCards(next); }}
            onRemove={() => setCards(cards.filter((_, j) => j !== i))} />
        ))}
        {!cards.length && <div className="muted" style={{ fontSize: 12, padding: 6 }}>No cards yet — add one or click <b>Seed demo</b>.</div>}
      </div>
    </>
  );
}

function CardTile({ card, onBalance, onRemove, onEdit, expanded = true }: { card: Card; onBalance: (n: number) => void; onRemove: () => void; onEdit?: (patch: Partial<Card>) => void; expanded?: boolean }) {
  const [editing, setEditing] = useState(false);
  const { sources, asOf, perks, offer, redemptions } = card;
  const balanceUsd = (card.points * card.cpp) / 100;
  const ceiling = ceilingFor(card);

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
          <div className="name">
            {card.name}
            {card.edited && <span className="tag" style={{ marginLeft: 6, fontSize: 9.5, padding: "0 5px" }}>edited</span>}
          </div>
          <div className="sub">
            {card.issuer} · <span className="mono">{card.cpp.toFixed(2)}¢/pt</span>
            {card.annualFee ? <> · <span className="mono">${card.annualFee}/yr</span></> : <> · no fee</>}
            {" · "}best on <b style={{ color: "var(--fg-1)" }}>{CAT_LABEL[topRow.cat] || topRow.cat}</b> ({topRow.rate.toFixed(1)}×)
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
          <div className="ceiling-strip">
            <span className="ceiling-label">Ceiling</span>
            <span className="ceiling-main">
              Max <b>{ceiling.topValuePct.toFixed(2)}%</b> back on <b>{CAT_LABEL[ceiling.topCategory] || ceiling.topCategory}</b> ({ceiling.topRate.toFixed(1)}×)
            </span>
            {ceiling.balanceUsd > 0 && <span className="ceiling-extra">balance ≈ ${ceiling.balanceUsd.toFixed(0)}</span>}
            {ceiling.hasOffer && <span className="ceiling-extra gold">offer live</span>}
          </div>

          <div className="bd-head">
            <span className="bd-title">Where to use this card</span>
            <span className="row" style={{ gap: 10, alignItems: "center" }}>
              {card.points > 0 && (
                <span className="bd-balance">
                  {card.points.toLocaleString()} pts ≈ <b>${balanceUsd.toFixed(2)}</b>
                </span>
              )}
              {onEdit && (
                <button className="bd-edit" onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Edit"}</button>
              )}
            </span>
          </div>

          {editing && onEdit ? (
            <CardEditor card={card} onEdit={onEdit} />
          ) : (
            <div className="bd-grid">
              {rows.map((r) => (
                <div key={r.cat} className={`bd-row ${r === rows[0] ? "best" : ""}`}>
                  <span className={`tag tag-cat`} data-cat={r.cat}>{CAT_LABEL[r.cat] || r.cat}</span>
                  <span className="bd-rate"><span className="mono">{r.rate.toFixed(1)}×</span></span>
                  <span className="bd-value mono">{r.value.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          )}

          {(offer || perks?.length || redemptions?.length) && <div className="divider" style={{ margin: "14px 0 12px" }} />}

          {offer && (
            <div className="perks-block">
              <div className="bd-title" style={{ marginBottom: 6 }}>Current offer</div>
              <div className="offer-pill">{offer}</div>
            </div>
          )}

          {perks && perks.length > 0 && (
            <div className="perks-block">
              <div className="bd-title" style={{ marginBottom: 8 }}>Perks & credits</div>
              <ul className="perks-list">
                {perks.slice(0, 5).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {redemptions && redemptions.length > 0 && (
            <div className="perks-block">
              <div className="bd-title" style={{ marginBottom: 8 }}>Best redemptions</div>
              <ul className="perks-list redemption">
                {redemptions.slice(0, 3).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Inline correction for wrong AI extractions. Sets `edited` so a later
 * re-lookup won't clobber the user's numbers. */
function CardEditor({ card, onEdit }: { card: Card; onEdit: (patch: Partial<Card>) => void }) {
  const cats = ["dining", "travel", "streaming", "groceries", "gas", "online", "other"];
  return (
    <div className="card-editor">
      <div className="ce-top">
        <label className="ce-field">
          <span>Point value (¢/pt)</span>
          <input className="input ce-input" type="number" step={0.05} min={0} value={card.cpp}
            onChange={(e) => onEdit({ cpp: Number(e.target.value) || 0, edited: true })} />
        </label>
        <label className="ce-field">
          <span>Annual fee ($)</span>
          <input className="input ce-input" type="number" min={0} value={card.annualFee ?? 0}
            onChange={(e) => onEdit({ annualFee: Number(e.target.value) || 0, edited: true })} />
        </label>
      </div>
      <div className="ce-grid">
        {cats.map((cat) => (
          <label key={cat} className="ce-cell">
            <span className="tag tag-cat" data-cat={cat}>{CAT_LABEL[cat] || cat}</span>
            <input className="input ce-input sm" type="number" step={0.5} min={0} value={card.r?.[cat] ?? 1}
              onChange={(e) => onEdit({ r: { ...card.r, [cat]: Number(e.target.value) || 0 }, edited: true })} />
            <span className="muted mono" style={{ fontSize: 11 }}>×</span>
          </label>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Edits stick and won't be overwritten by a re-lookup.</div>
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
            <div className="ws"><span className="wordmark sm">PointsPilot</span></div>
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
            <span className="wordmark sm">PointsPilot</span>
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
  const [thinking, setThinking] = useState<string | null>(null);
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

    let thinkingTimer: any = null;
    const steps = trip
      ? ["Reading your answer", "Updating trip details", "Next question"]
      : ["Reading your message", "Identifying intent", "Checking your cards", "Computing best pick"];
    let stepIdx = 0;
    setThinking(steps[0]);
    thinkingTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setThinking(steps[stepIdx]);
    }, 650);

    try {
      const result = await aiAnalyze(v, !!trip);

      if (trip) {
        let merged = mergeTrip(trip, result);
        const pendingIdx = nextMissingIdx(trip);
        const pending = pendingIdx >= 0 ? TRIP_SEQ[pendingIdx] : null;
        if (pending?.freeform && merged[pending.key] === trip[pending.key]) {
          merged = mergeTrip(merged, { [pending.key]: v });
        }
        setTrip(merged);
        pushTripQuestion(merged);
        return;
      }

      const intent = (result.intent || result.category || "other").toLowerCase();

      if (intent === "travel") {
        const seed = mergeTrip({}, result);
        setTrip(seed);
        const known = summarizeKnown(seed);
        push({ id: mkId(), from: "bot", kind: "text",
          text: known === "Got it — let's plan the trip." ? "Sure — a few quick questions and I'll pick the right card." : `${known} A couple more to nail it:` });
        pushTripQuestion(seed);
      } else {
        const merchantQuery = result.merchantQuery || v;
        const amount = typeof result.amount === "number" ? result.amount : null;
        if (!data.cards.length) {
          push({ id: mkId(), from: "bot", kind: "text", text: "You haven't added any cards yet — open My cards in the sidebar to load demo cards or add your own, then ask again." });
        } else {
          const ack = ackFor(intent, amount);
          if (ack) push({ id: mkId(), from: "bot", kind: "text", text: ack });
          push({ id: mkId(), from: "bot", kind: "rec", category: intent, query: merchantQuery, amount });
        }
      }
    } catch {
      push({ id: mkId(), from: "bot", kind: "text", text: "Hmm — say that again? You can be specific (\"$200 at Whole Foods\") or general (\"book a trip to Miami\")." });
    } finally {
      if (thinkingTimer) clearInterval(thinkingTimer);
      setThinking(null);
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
              <div className="bubble">
                <div className="thinking">
                  <span className="spinner" />
                  <span className="thinking-step" key={thinking}>{thinking || "Thinking"}</span>
                  <span className="thinking-dots"><i/><i/><i/></span>
                </div>
              </div>
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
  // Curated merchant knowledge wins over the model's coarse intent: a real
  // merchant codes in a specific category, so rank on THAT, not the guess.
  const merch = resolveMerchant(query || "");
  const cat = merch?.category || category;

  const annualSpend = data.spend?.[cat];
  const ranked = useMemo(() => bestForCategory(data.cards, cat, annualSpend), [data.cards, cat, annualSpend]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!ranked.length) {
    return <div className="muted">Add a card first — open My cards in the sidebar.</div>;
  }

  const recommended = ranked[0];
  const selected = ranked.find((c) => c.id === selectedId) ?? recommended;
  const isOverride = selected.id !== recommended.id;

  const m = MERCHANT[cat] || MERCHANT.other;
  const link = m.href(query);

  const rate = rateFor(selected, cat);
  const valuePct = rate * selected.cpp;
  const spend = amount && amount > 0 ? amount : 100;
  const ptsEarned = Math.round(rate * spend);
  const dollarEarned = (rate * spend * selected.cpp) / 100;
  const bestDollar = (rateFor(recommended, cat) * spend * recommended.cpp) / 100;
  const givenUp = bestDollar - dollarEarned;
  const cap = selected.caps?.[cat];

  return (
    <div className="rec fade">
      <div className="head">
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <span className="tag tag-cat" data-cat={cat}>{CAT_LABEL[cat] || "Everyday"}</span>
          <span className="muted" style={{ fontSize: 12 }}>{m.name} handoff</span>
        </div>
        <span className="headline-value">
          <span className="v">{valuePct.toFixed(2)}%</span>
          <span className="u">back</span>
        </span>
      </div>

      <h3>{isOverride ? `Your pick: ${selected.name}` : `Use ${selected.name}`}</h3>
      <div className="why">
        <b>{rate.toFixed(1)}×</b> on {CAT_LABEL[cat] || "this"} · <span className="mono">{selected.cpp.toFixed(2)}¢/pt</span>
        {!isOverride && <span className="tag gold" style={{ marginLeft: 8 }}>our pick</span>}
      </div>

      {merch?.note && (
        <div className="cap-note" style={{ marginBottom: 10 }}>Heads up: {merch.note}</div>
      )}

      <div className="stat-grid">
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

      <div className="pick-head">
        <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Your wallet, ranked</span>
        <span className="muted" style={{ fontSize: 11 }}>tap to choose · you decide</span>
      </div>
      <div className="pick-list">
        {ranked.map((c) => {
          const r = rateFor(c, cat);
          const v = r * c.cpp;
          const chosen = c.id === selected.id;
          const best = c.id === recommended.id;
          const cCap = c.caps?.[cat];
          return (
            <button key={c.id} className={`pick-row ${chosen ? "chosen" : ""}`} onClick={() => setSelectedId(c.id)}>
              <span className="swatch" style={{ background: c.color }} />
              <span className="pick-meta">
                <span className="pick-name">
                  {c.name}
                  {best && <span className="tag gold" style={{ marginLeft: 6, fontSize: 9.5, padding: "0 5px" }}>best</span>}
                </span>
                <span className="pick-sub">
                  {c.issuer} · {c.annualFee ? `$${c.annualFee}/yr` : "no fee"}
                  {cCap ? ` · ${r.toFixed(0)}× to $${Math.round(cCap.limit / 1000)}k` : ""}
                </span>
              </span>
              <span className="pick-nums">
                <span className="mono pick-rate">{r.toFixed(1)}×</span>
                <span className="mono pick-val">{v.toFixed(2)}%</span>
              </span>
              <span className={`radio ${chosen ? "on" : ""}`} aria-hidden />
            </button>
          );
        })}
      </div>

      {isOverride && givenUp > 0.005 && (
        <div className="cap-note warn">Leaves about ${givenUp.toFixed(2)} on the table vs {recommended.name} at this spend — your call.</div>
      )}
      {cap && (
        <div className="cap-note">{rate.toFixed(1)}× applies up to ${cap.limit.toLocaleString()}/yr, then {cap.postRate}×.</div>
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
  const url = buildFlightsUrl(trip, data.profile.airport);

  // Compute all 3 angles regardless of stated priority
  const maximize  = bestForTrip(data.cards, "Rack up the most points");
  const cash      = bestForTrip(data.cards, "Spend the least cash");
  const redeem    = bestForTrip(data.cards, "Redeem existing points");

  const userPriority = (trip.priority as TripPriority) || "Spend the least cash";
  const highlighted =
    userPriority === "Rack up the most points" ? "maximize"
    : userPriority === "Redeem existing points" ? "redeem"
    : "cash";

  return (
    <div className="rec fade">
      <div className="head">
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <span className="tag tag-cat" data-cat="travel">Travel</span>
          <span className="muted" style={{ fontSize: 12 }}>Google Flights handoff</span>
        </div>
        <span className="tag">{userPriority}</span>
      </div>
      <h3>Your trip, three ways</h3>
      <div className="why">
        Picked from {data.cards.length} card{data.cards.length === 1 ? "" : "s"} in your wallet. The one matching your priority is highlighted in gold.
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="label">Route</div><div className="val">{trip.from || data.profile.airport || "?"} → {trip.to || "?"}</div></div>
        <div className="stat"><div className="label">Dates</div><div className="val" style={{ fontSize: 13 }}>{trip.dates || "?"}</div></div>
        <div className="stat"><div className="label">Travelers</div><div className="val">{trip.travelers || "1"} · {trip.cabin || "Economy"}</div></div>
      </div>

      <div className="trip-opts">
        <TripOption label="Maximize points" sub="Best earn rate on this fare" pick={maximize.pick} why={maximize.why} active={highlighted === "maximize"} mode="earn" />
        <TripOption label="Best value" sub="Lowest out-of-pocket today" pick={cash.pick} why={cash.why} active={highlighted === "cash"} mode="cash" />
        <TripOption label="Use your balance" sub="Cover the fare with miles" pick={redeem.pick} why={redeem.why} active={highlighted === "redeem"} mode="redeem" />
      </div>

      <div className="divider" />
      <a className="btn btn-primary btn-lg" href={url} target="_blank" rel="noreferrer" onClick={() => { /* analytics hook */ }}>
        Open in Google Flights — pre-filled →
      </a>
      <div className="footer-note">
        Route, dates, travelers & cabin go in the URL. Bag ({trip.bag || "?"}), seat ({trip.seat || "?"}), loyalty ({trip.loyalty || "?"}), and login-only fields need a browser agent.
      </div>
    </div>
  );
}

function TripOption({ label, sub, pick, why, active, mode }:
  { label: string; sub: string; pick: Card | undefined; why: string; active: boolean; mode: "earn" | "cash" | "redeem" }) {
  if (!pick) return null;
  const earn = rateFor(pick, "travel");
  const earnPct = (earn * pick.cpp).toFixed(2);
  const balanceUsd = (pick.points * pick.cpp) / 100;

  return (
    <div className={`trip-opt ${active ? "active" : ""}`}>
      <div className="trip-opt-head">
        <div>
          <div className="trip-opt-label">{label}</div>
          <div className="trip-opt-sub">{sub}</div>
        </div>
        {active && <span className="tag gold">your pick</span>}
      </div>
      <div className="trip-opt-card">
        <div className="swatch" style={{ background: pick.color, width: 36, height: 24, borderRadius: 4, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{pick.name}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{pick.issuer} · {pick.cur}</div>
        </div>
      </div>
      <div className="trip-opt-stats">
        {mode === "earn" && (
          <>
            <div className="trip-opt-stat"><span className="muted">Earn</span><span className="mono"><b>{earn.toFixed(1)}×</b></span></div>
            <div className="trip-opt-stat"><span className="muted">Value back</span><span className="mono" style={{ color: "var(--gold-text)" }}><b>{earnPct}%</b></span></div>
          </>
        )}
        {mode === "cash" && (
          <>
            <div className="trip-opt-stat"><span className="muted">Balance</span><span className="mono"><b>{pick.points.toLocaleString()}</b> pts</span></div>
            <div className="trip-opt-stat"><span className="muted">Worth</span><span className="mono" style={{ color: "var(--gold-text)" }}><b>${balanceUsd.toFixed(0)}</b></span></div>
          </>
        )}
        {mode === "redeem" && (
          <>
            <div className="trip-opt-stat"><span className="muted">Redeem</span><span className="mono"><b>{pick.points.toLocaleString()}</b> pts</span></div>
            <div className="trip-opt-stat"><span className="muted">Cash value</span><span className="mono" style={{ color: "var(--gold-text)" }}><b>${balanceUsd.toFixed(0)}</b></span></div>
          </>
        )}
      </div>
      <div className="trip-opt-why">{why}</div>
    </div>
  );
}

function ackFor(intent: string, amount: number | null): string | null {
  const v = amount && amount > 0 ? `$${amount}` : "this";
  const acks: Record<string, string> = {
    groceries: `Groceries${amount ? ` (${v})` : ""} — easy. Best card for that:`,
    dining:    `Dining${amount ? ` (${v})` : ""} — here's what to use:`,
    streaming: "Streaming sub — quick one:",
    gas:       `Filling up${amount ? ` (${v})` : ""} — best card:`,
    online:    `Online purchase${amount ? ` (${v})` : ""} — try this:`,
    other:     "Got it. Best card for that:",
  };
  return acks[intent] || null;
}

function buildFlightsUrl(t: Trip, homeAirport?: string) {
  const from = t.from || homeAirport || "";
  const to = t.to || "";
  const pax = (t.travelers || "1").replace("+", "");
  const cabinMap: Record<string, string> = { Basic: "economy", Economy: "economy", Business: "business", First: "first" };
  const cabin = cabinMap[t.cabin || "Economy"] || "economy";
  const rt = t.rt === "one" ? "one-way" : "round trip";
  const dates = (t.dates || "").trim();

  // Build a clean natural-language query — Google Flights parses these well
  const parts = [
    `Flights from ${from || "anywhere"}`,
    to ? `to ${to}` : "",
    dates ? `on ${dates}` : "",
    rt,
    `${pax} ${pax === "1" ? "adult" : "adults"}`,
    cabin !== "economy" ? cabin : "",
  ].filter(Boolean);

  return `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(" "))}`;
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
          <p>Add cards by name — we pull live reward rates from the web with sources.</p>
        </div>

        <div className="row" style={{ marginBottom: 18, alignItems: "center" }}>
          <input className="input input-lg" style={{ flex: 1, maxWidth: 460 }}
            placeholder='Try "Amex Gold", "Chase Sapphire Reserve", "Target RedCard"'
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn btn-primary btn-lg" onClick={add} disabled={busy || !q.trim()}>
            {busy ? <span className="spinner" /> : "Add card"}
          </button>
        </div>

        {err && <div className="tag" style={{ background: "#fdecef", borderColor: "#f3c6cf", color: "#a02a4b", marginBottom: 12 }}>{err}</div>}

        {!data.cards.length ? (
          <div className="empty">
            <div className="big">No cards yet</div>
            <div className="small">Type a card name above — we'll pull its current reward rates from the web in a few seconds.</div>
          </div>
        ) : (
          <div className="col">
            {data.cards.map((c, i) => (
              <CardTile key={c.id + i} card={c} onBalance={(n) => update(i, { points: n })} onEdit={(patch) => update(i, patch)} onRemove={() => remove(i)} />
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
