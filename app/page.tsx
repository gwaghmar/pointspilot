"use client";

import Link from "next/link";
import { Calculator, Link2, Search, SlidersHorizontal, type LucideIcon } from "lucide-react";

export default function Landing() {
  return (
    <div className="lp">
      {/* Nav */}
      <nav className="lp-nav">
        <Link href="/" className="lp-brand">
          <span className="lp-logo">P</span>
          <span className="wordmark md">PointsPilot</span>
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
          <span className="grad">Google</span> for your <br />reward points.
        </h1>
        <p className="lp-sub">
          Type any purchase. PointsPilot picks the exact card to use, <br className="hide-sm" />
          shows the dollar value, and hands you off to book.
        </p>

        {/* Search preview */}
        <div className="lp-search">
          <div className="lp-search-bar">
            <Search size={20} strokeWidth={2.2} style={{ flexShrink: 0, color: "var(--fg-2)" }} />
            <span className="lp-typed">Ask about a purchase, trip, or redemption</span>
            <span className="lp-caret" />
          </div>
          <div className="lp-answer">
            <div className="lp-answer-swatch" />
            <div className="lp-answer-body">
              Live wallet data, source links, and deterministic ranking appear here after setup.
            </div>
            <span className="lp-answer-tag">Source-backed</span>
          </div>
        </div>

        <div className="lp-hero-cta">
          <Link href="/app" className="btn btn-primary btn-xl">Start your wallet</Link>
          <span className="lp-cta-meta">No card numbers or credit checks</span>
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
          <Feature title="Privacy-first setup" body="No card numbers or credit checks. Profile details are only used to prepare handoffs and ranking context." />
        </div>
      </section>

      {/* Trust strip */}
      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-kicker">Production posture</span>
          <h2>Built to show its work.</h2>
        </div>
        <div className="lp-strip">
          <Stat icon={Link2} big="Sources" small="Reward data is shown with links and freshness dates when available." />
          <Stat icon={Calculator} big="Math" small="Card ranking is deterministic, visible, and separate from AI extraction." />
          <Stat icon={SlidersHorizontal} big="Control" small="Users can correct rates, caps, fees, and point values before relying on results." />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="lp-section">
        <div className="lp-section-head center">
          <span className="lp-kicker">Pricing</span>
          <h2>Start free.</h2>
          <p className="lp-section-sub">No card numbers, no credit checks, and no hidden financial-product application flow.</p>
        </div>
        <div className="lp-cta-card">
          <div className="lp-cta-card-head">
            <div className="lp-tag">Early access</div>
            <h3>Free</h3>
            <div className="lp-price">$0<span>/mo</span></div>
          </div>
          <ul className="lp-checklist">
            <li>Live card lookup</li>
            <li>Purchase and trip recommendations</li>
            <li>Flight and merchant handoffs</li>
            <li>Source-cited reward data</li>
            <li>Editable wallet assumptions</li>
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
            <span className="wordmark sm">PointsPilot</span>
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

function Stat({ icon: Icon, big, small }: { icon: LucideIcon; big: string; small: string }) {
  return (
    <div className="lp-stat">
      <div className="lp-stat-icon" aria-hidden="true"><Icon size={18} strokeWidth={2.2} /></div>
      <div className="lp-stat-big">{big}</div>
      <div className="lp-stat-small">{small}</div>
    </div>
  );
}
