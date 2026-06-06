import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { AI_PHASES, estimateAnnualSaved, sourceConfidence } from "../lib/ux-insights";
import type { Card } from "../lib/recommend";

const cards: Card[] = [
  {
    id: "gold",
    name: "Amex Gold",
    issuer: "American Express",
    cur: "Points",
    cpp: 1,
    color: "#214dff",
    points: 0,
    r: { dining: 4, travel: 1, streaming: 1, groceries: 1, gas: 1, online: 1, other: 1 },
    sources: [{ title: "Issuer", url: "https://example.com" }],
    asOf: "2026-06-01",
  },
];

assert.equal(estimateAnnualSaved(cards, ["Dining"], { dining: 12000 }), 300);
assert.equal(sourceConfidence(cards).label, "High confidence");
assert.equal(AI_PHASES.length, 4);
assert.equal(AI_PHASES[0].title, "AI recommendations and proof");

const appSource = readFileSync("app/app/page.tsx", "utf8");
const landingSource = readFileSync("app/page.tsx", "utf8");
const apiRouteSource = readFileSync("app/api/ai/route.ts", "utf8");
const aiSource = readFileSync("lib/ai.ts", "utf8");
const gapsSource = readFileSync("lib/gaps.ts", "utf8");
const supabaseSource = readFileSync("lib/supabase.ts", "utf8");
const schemaSource = readFileSync("supabase/schema.sql", "utf8");
const cssSource = readFileSync("app/globals.css", "utf8");
const readmeSource = readFileSync("README.md", "utf8");
const decorativeGlyphs = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{25A0}-\u{25FF}]/u;
const productionSources = [appSource, landingSource, aiSource, schemaSource].join("\n");
const readmeMermaidBlocks = [...readmeSource.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map((match) => match[1]);

assert.equal(decorativeGlyphs.test(appSource), false, "App source should use Lucide icons, not emoji glyphs");
assert.equal(decorativeGlyphs.test(landingSource), false, "Landing source should not contain emoji glyphs");
assert.equal(decorativeGlyphs.test(cssSource), false, "CSS should not render emoji glyphs");
assert.equal(readmeMermaidBlocks.length, 1, "README should keep one GitHub-rendered Mermaid tech-stack diagram");
assert.doesNotMatch(
  readmeMermaidBlocks.join("\n"),
  /<br\s*\/?>|:::[A-Za-z0-9_-]+|^\s*classDef\b/m,
  "README Mermaid must use GitHub-safe labels without HTML breaks or inline class shorthand",
);
assert.doesNotMatch(productionSources, /\b(demo|seed demo|open beta|while we're cooking|No auth for MVP|disable row level security|browser-local profile)\b/i);
assert.doesNotMatch(aiSource, /issuer:\s*"Card"|Lookup failed|rewards:\s*\{\}/);
assert.doesNotMatch(gapsSource, /CATALOG|\.\/catalog/);
assert.equal(existsSync("lib/catalog.ts"), false, "Do not ship hard-coded card recommendation catalog");
assert.match(apiRouteSource, /RATE_LIMIT_WINDOW_MS/);
assert.match(apiRouteSource, /MAX_TEXT_CHARS/);
assert.match(apiRouteSource, /allowedModes/);
assert.match(apiRouteSource, /AI request could not be completed/);
assert.match(apiRouteSource, /api_rate_limits/);
assert.match(apiRouteSource, /checkRateLimit/);
assert.match(schemaSource, /create table if not exists api_rate_limits/);
assert.match(supabaseSource, /signInWithPassword/);
assert.match(supabaseSource, /signUp/);
assert.match(supabaseSource, /signOut/);
assert.match(appSource, /AuthPanel/);
assert.match(appSource, /Sign in/);
assert.match(appSource, /type View = .*"everyday"/);
assert.match(appSource, /Money saved using PointsPilot/);
assert.match(appSource, /AI checked the math/);
assert.match(appSource, /AI_PHASES/);
assert.match(appSource, /className="mobile-tabbar"/);
assert.match(appSource, /className="profile-row"/);
assert.match(landingSource, /for your <br \/>reward points/);
assert.match(landingSource, /use, <br className="hide-sm" \/>/);
assert.match(cssSource, /--wordmark-stripe-fill/);
assert.match(cssSource, /-webkit-text-stroke: 0\.45px var\(--accent\)/);
const statBigBlock = cssSource.match(/\.lp-stat-big\s*\{[\s\S]*?\n\}/)?.[0] || "";
assert.doesNotMatch(statBigBlock, /background-clip|-webkit-text-fill-color|font-family:\s*var\(--font-mono\)/, "Production posture card headings must stay readable UI text, not decorative logo text");
assert.match(cssSource, /\.mobile-tabbar/);
assert.match(cssSource, /\.profile-row/);
assert.match(cssSource, /@media \(max-width: 1180px\)/);
assert.match(cssSource, /@media \(max-width: 640px\)/);
assert.match(cssSource, /\.lp-hero\s*\{[\s\S]*padding: 36px 32px 30px;/);
assert.match(cssSource, /\.lp-trust\s*\{[\s\S]*margin-top: 20px;/);
assert.match(cssSource, /\.lp-section\s*\{[\s\S]*padding: 44px 32px;/);
assert.match(cssSource, /@media \(max-width: 640px\)[\s\S]*\.lp-hero\s*\{[\s\S]*padding: 22px 16px 18px;/);
assert.match(cssSource, /@media \(max-width: 640px\)[\s\S]*\.lp-trust\s*\{[\s\S]*margin-top: 14px;/);
assert.match(cssSource, /@media \(max-width: 640px\)[\s\S]*\.lp-section\s*\{[\s\S]*padding: 34px 16px;/);
