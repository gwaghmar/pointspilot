"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const EXAMPLES = [
  { q: "Book a trip to Miami for 2 next weekend", a: "Use Capital One Venture X · 5× on flights · 9.25% effective value" },
  { q: "Spend $250 at Whole Foods", a: "Use Amex Gold · 4× on groceries · earn 1,000 pts ≈ $20 · save +$15 vs 1× card" },
  { q: "Weekly Netflix subscription",          a: "Use Sapphire Preferred · 3× on streaming · 3.75% back" },
  { q: "Fill up the tank — $60 of gas",        a: "Use Freedom Unlimited · 1.5× · save +$0.45 vs default" },
  { q: "Redeem points for a flight to Tokyo",   a: "Use Venture X · 71,225 miles ≈ $1,318 — most balance on hand" },
];

export default function Landing() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(t);
  }, []);

  const ex = EXAMPLES[idx];

  return (
    <div className="lp">
      {/* Nav */}
      <nav className="lp-nav">
        <Link href="/" className="lp-brand">
          <span className="lp-logo">P</span>
          <span className="lp-brand-name">PointsPilot</span>
        </Link>
        <div className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#why">Why</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="lp-nav-cta">
          <Link href="/app" className="btn">Open app</Link>
          <Link href="/app" className="btn btn-primary">Get started — free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-eyebrow">
          <span className="dot" /> Live web search · grounded recommendations · no fluff
        </div>
        <h1 className="lp-h1">
          <span className="grad">Google</span> for your<br />reward points.
        </h1>
        <p className="lp-sub">
          Type any purchase. PointsPilot picks the exact card to use,<br className="hide-sm" />
          shows the dollar value, and hands you off to book.
        </p>

        {/* Search demo */}
        <div className="lp-search">
          <div className="lp-search-bar">
            <SearchIcon />
            <span className="lp-typed">{ex.q}</span>
            <span className="lp-caret" />
          </div>
          <div className="lp-answer fade-key" key={idx}>
            <div className="lp-answer-icon">
              <span className="lp-logo small">P</span>
            </div>
            <div className="lp-answer-body">{ex.a}</div>
          </div>
        </div>

        <div className="lp-hero-cta">
          <Link href="/app" className="btn btn-primary btn-xl">Try it free — no signup</Link>
          <span className="lp-cta-meta">5 demo cards loaded · works in 30 seconds</span>
        </div>

        <div className="lp-trust">
          <span className="lp-trust-label">Works with</span>
          {["American Express", "Chase", "Capital One", "Citi", "Discover", "Wells Fargo", "Bilt"].map((b) => (
            <span key={b} className="lp-trust-chip">{b}</span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-kicker">How it works</span>
          <h2>Three steps. Real numbers. No guessing.</h2>
        </div>
        <div className="lp-how">
          <Step n="01" t="Tell us your cards" d="Type any card name — personal, store, or co-brand. We pull live reward rates from the web and show you the sources, so you can verify." />
          <Step n="02" t="Ask anything" d="“Book a trip to Miami.” “Spend $200 at Whole Foods.” “Redeem points for Tokyo.” Natural language — no forms." />
          <Step n="03" t="Get the answer" d="Best card to use, in dollars and points, with a one-tap handoff to book. We even tell you what you'd save vs a default card." />
        </div>
      </section>

      {/* Why */}
      <section id="why" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-kicker">Why PointsPilot</span>
          <h2>The math is on your side.</h2>
          <p className="lp-section-sub">Most points apps guess. We separate data from decision — the AI gathers, the math decides. That's why our recommendation is always correct.</p>
        </div>
        <div className="lp-feature-grid">
          <Feature title="Live web search" body="Reward rates come from real-time search results, not training data. Every card shows sources and a freshness date." />
          <Feature title="Deterministic ranking" body="The recommendation is plain math — multiplier × cents-per-point. The AI never picks the card. It can't get it wrong." />
          <Feature title="Points → dollars" body="See your balance in cash, see your savings per purchase, see exactly what's worth redeeming vs earning." />
          <Feature title="Natural language" body="“One-way to LAX in business, no bag.” One sentence extracts every detail — no forms, no clicks." />
          <Feature title="One-tap handoff" body="Pre-filled deep links to Google Flights, Amazon, Instacart, OpenTable. We tell you what the link can and can't do." />
          <Feature title="No lock-in" body="Your data lives in your browser + a row in Supabase. No accounts, no email lists, no upsells. Free forever for personal use." />
        </div>
      </section>

      {/* Demo strip */}
      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-kicker">Real numbers</span>
          <h2>Stop leaving money on the table.</h2>
        </div>
        <div className="lp-strip">
          <Stat big="+$430" small="Annual savings on $20k of mixed spend, vs a single 1.5% cashback card" />
          <Stat big="4 sources" small="Average citations per card lookup, all clickable" />
          <Stat big="< 2s" small="From typing your purchase to a card pick" />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="lp-section">
        <div className="lp-section-head center">
          <span className="lp-kicker">Pricing</span>
          <h2>Free, while we're cooking.</h2>
          <p className="lp-section-sub">No accounts, no card numbers, no credit checks. Ever.</p>
        </div>
        <div className="lp-cta-card">
          <div className="lp-cta-card-head">
            <div className="lp-tag">Open beta</div>
            <h3>Free</h3>
            <div className="lp-price">$0<span>/mo</span></div>
          </div>
          <ul className="lp-checklist">
            <li>Unlimited card lookups</li>
            <li>Unlimited purchase queries</li>
            <li>Full trip wizard + flight handoff</li>
            <li>Source-cited reward data</li>
            <li>Browser-local profile, no signup</li>
          </ul>
          <Link href="/app" className="btn btn-primary btn-xl" style={{ width: "100%" }}>
            Open PointsPilot →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-foot">
        <div className="lp-foot-inner">
          <div className="lp-foot-brand">
            <span className="lp-logo">P</span>
            <span>PointsPilot</span>
          </div>
          <div className="lp-foot-meta">
            <span>© {new Date().getFullYear()} PointsPilot</span>
            <span className="dot-sep">·</span>
            <span>Built with Next.js + OpenRouter + Tavily + Supabase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div className="lp-step">
      <div className="lp-step-n">{n}</div>
      <h3>{t}</h3>
      <p>{d}</p>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="lp-feature">
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="lp-stat">
      <div className="lp-stat-big">{big}</div>
      <div className="lp-stat-small">{small}</div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--fg-2)" }}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
