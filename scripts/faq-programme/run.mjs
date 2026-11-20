#!/usr/bin/env node
/**
 * FAQ programme — check a wave's payload against the live database, then
 * (only with --write) replace each page's FAQ with it.
 *
 *   node --env-file=.env.local scripts/faq-programme/run.mjs <wave-dir>          # checks + dry run
 *   node --env-file=.env.local scripts/faq-programme/run.mjs <wave-dir> --write  # writes
 *
 * Pages supported:
 *   kind "area"        → pages.blocks, section "faq", values.items  (q, a, q_ar, a_ar)
 *   kind "development" → developments.meta.faq                      (q, a, q_ar, a_ar)
 *
 * A write backs the previous value up to <wave-dir>/backup/<slug>.json first,
 * and is conditional on `updated_at` being unchanged since the read, so an
 * editor's save in the CMS between the check and the write is never clobbered.
 * Both routes are ISR (areas 300 s, projects 60 s): no deploy is needed.
 */
import fs from "node:fs";
import path from "node:path";

const [, , waveDir, flag] = process.argv;
if (!waveDir) {
  console.error("usage: run.mjs <wave-dir> [--write]");
  process.exit(2);
}
const WRITE = flag === "--write";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(2);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function get(q) {
  const r = await fetch(`${URL_}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(`${q}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function patch(q, body) {
  const r = await fetch(`${URL_}/rest/v1/${q}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${q}: ${r.status} ${await r.text()}`);
  return r.json();
}

const payload = JSON.parse(fs.readFileSync(path.join(waveDir, "payload.json"), "utf8"));

// ── the standard (docs/plans/faq-programme-plan.pdf §2) ──────────────────────
const BANNED = [
  /\bguarantee/i, /\bbest\b/i, /\bno\.?\s?1\b/i, /\bnumber one\b/i, /risk[- ]free/i,
  /highest (return|yield)/i, /\bassured\b/i, /\bcertain to\b/i,
  /مضمون(?!ة?:)/, /الأفضل/, /الأول على/,
];
// Latin words allowed inside Arabic prose (codes, not words).
const AR_LATIN_OK = new Set(["E10", "E11", "E12", "ADGM", "DARI", "ADREC"]);

const nums = (s) =>
  (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "")).filter((n) => n !== "");
const firstSentence = (s) => s.split(/(?<=[.!?])\s/)[0];
const words = (s) => s.trim().split(/\s+/).length;

function factText(obj) {
  // Every number the database holds for this page, flattened.
  return new Set(nums(JSON.stringify(obj)));
}

const problems = [];
const warn = [];
const flagP = (slug, i, m) => problems.push(`${slug}#${i + 1}: ${m}`);
const flagW = (slug, i, m) => warn.push(`${slug}#${i + 1}: ${m}`);

// Shared numbers: facts from sources listed in the payload, and arithmetic the
// answers do on DB figures (e.g. 1,000 sq ft × AED 123 = 123,000).
const SOURCED = new Set((payload.sourcedNumbers ?? []).map(String));

const allAnswers = [];
const plan = [];

for (const page of payload.pages) {
  let row;
  let facts;
  if (page.kind === "area") {
    [row] = await get(`pages?select=id,slug,blocks,updated_at&slug=eq.${encodeURIComponent(page.pageSlug)}`);
    if (!row) { problems.push(`${page.slug}: no pages row ${page.pageSlug}`); continue; }
    if (!row.blocks.some((s) => s.key === "faq")) problems.push(`${page.slug}: no faq section`);
    const devs = await get(`developments?select=name,starting_price,handover_date,total_units,area:areas!inner(slug)&area.slug=eq.${page.slug}&published_at=not.is.null`);
    // Unpublished rows are seed/demo data (8 found 2026-11-20): never a fact source.
    facts = factText({ blocks: row.blocks, devs });
  } else if (page.kind === "development") {
    [row] = await get(`developments?select=id,slug,name,meta,updated_at,total_units,starting_price,handover_date,payment_plan,bedrooms_text,published_at,area:areas(slug)&slug=eq.${page.slug}`);
    if (!row) { problems.push(`${page.slug}: no developments row`); continue; }
    if (!row.published_at) problems.push(`${page.slug}: project is unpublished (seed/demo row)`);
    const units = await get(`development_unit_types?select=label,beds,size_from_ft2,size_to_ft2&development_id=eq.${row.id}`);
    const [areaPage] = await get(`pages?select=blocks&slug=eq.subpage/area/${row.area?.slug}`);
    facts = factText({ row, units, area: areaPage?.blocks });
  } else if (page.kind === "page") {
    // A master page (landing) whose FAQ is a section in its own document.
    const key = page.sectionKey ?? "faq";
    [row] = await get(`pages?select=id,slug,blocks,updated_at&slug=eq.${encodeURIComponent(page.pageSlug)}`);
    if (!row) { problems.push(`${page.slug}: no pages row ${page.pageSlug}`); continue; }
    if (!row.blocks.some((s) => s.key === key)) problems.push(`${page.slug}: no "${key}" section`);
    facts = factText({ blocks: row.blocks });
  } else if (page.kind === "faqdoc") {
    // A page-FAQ document (subpage/faq/<key>, lib/master-pages/page-faqs.ts):
    // one "faq" section, created on first write. Its page body is code copy, so
    // figures are traced through sourcedNumbers.
    if (!page.pageSlug?.startsWith("subpage/faq/")) { problems.push(`${page.slug}: faqdoc pageSlug must be subpage/faq/<key>`); continue; }
    [row] = await get(`pages?select=id,slug,blocks,updated_at&slug=eq.${encodeURIComponent(page.pageSlug)}`);
    let extra = {};
    const dev = /^developer-(.+)$/.exec(page.slug);
    if (dev) {
      // A developer profile: its record and its PUBLISHED projects are facts.
      const [d] = await get(`developers?select=id,name,founded_year,description,stats&slug=eq.${dev[1]}`);
      if (!d) { problems.push(`${page.slug}: no developers row ${dev[1]}`); continue; }
      const projects = await get(`developments?select=id,name,starting_price,handover_date,total_units,payment_plan,bedrooms_text&developer_id=eq.${d.id}&published_at=not.is.null`);
      const units = projects.length
        ? await get(`development_unit_types?select=beds,size_from_ft2,size_to_ft2&development_id=in.(${projects.map((p) => p.id).join(",")})`)
        : [];
      extra = { d, projects, units };
    }
    facts = factText({ blocks: row?.blocks ?? [], ...extra });
  } else {
    problems.push(`${page.slug}: unknown kind ${page.kind}`);
    continue;
  }

  const faq = page.faq;
  if (faq.length > 12) problems.push(`${page.slug}: ${faq.length} FAQs, max 12`);
  if (faq.length < 8) warn.push(`${page.slug}: only ${faq.length} FAQs`);
  const qs = new Set();

  faq.forEach((e, i) => {
    for (const k of ["q", "a", "q_ar", "a_ar"]) if (!e[k]?.trim()) flagP(page.slug, i, `missing ${k}`);
    if (!e.q || !e.a || !e.q_ar || !e.a_ar) return;
    if (e.q.length > 200 || e.q_ar.length > 200) flagP(page.slug, i, "question over 200 chars");
    if (e.a.length > 1200 || e.a_ar.length > 1200) flagP(page.slug, i, "answer over 1200 chars");
    if (!e.q.endsWith("?")) flagP(page.slug, i, "EN question must end with ?");
    if (!e.q_ar.endsWith("؟")) flagP(page.slug, i, "AR question must end with ؟");
    if (e.a.length < 150 || e.a.length > 520) flagW(page.slug, i, `answer ${e.a.length} chars (target 250–500)`);
    if (words(firstSentence(e.a)) > 45) flagW(page.slug, i, `first sentence ${words(firstSentence(e.a))} words`);
    if (/\b(it|this|they)\b/i.test(e.q.split(" ").slice(0, 3).join(" "))) flagW(page.slug, i, "question opens with a pronoun");
    if (qs.has(e.q)) flagP(page.slug, i, "duplicate question on page");
    qs.add(e.q);

    for (const re of BANNED) {
      if (re.test(e.a) || re.test(e.q) || re.test(e.a_ar)) {
        // "Returns are not guaranteed" is the compliant phrasing, not a claim.
        if (/not guaranteed|لا توجد عوائد مضمونة/.test(e.a + e.a_ar) && /guarantee|مضمون/.test(re.source)) continue;
        flagP(page.slug, i, `banned claim ${re}`);
      }
    }
    for (const w of (e.a_ar + " " + e.q_ar).match(/[A-Za-z][A-Za-z0-9]*/g) ?? []) {
      if (!AR_LATIN_OK.has(w)) flagP(page.slug, i, `Latin "${w}" in Arabic`);
    }
    if (/[Ѐ-ӿ]/.test(e.a_ar + e.q_ar)) flagP(page.slug, i, "Cyrillic in Arabic");

    // Every figure traceable: in the DB for this page, or listed as sourced.
    // "AED 2.4 million" is traced when a DB figure is within 5% of 2,400,000.
    const millions = new Set(
      [...e.a.matchAll(/(\d+(?:\.\d+)?)\s*(?:–\s*(\d+(?:\.\d+)?))?\s*million/g)].flatMap((m) => [m[1], m[2]]).filter(Boolean),
    );
    const nearDb = (n) => [...facts].some((f) => Number(f) >= 1e5 && Math.abs(Number(f) - Number(n) * 1e6) <= Number(n) * 1e6 * 0.05);
    const unknown = nums(e.a).filter(
      (n) => !facts.has(n) && !SOURCED.has(n) && !(millions.has(n) && (nearDb(n) || n === "2")),
    );
    if (unknown.length) flagP(page.slug, i, `untraced figures ${[...new Set(unknown)].join(", ")}`);
    // Arabic carries the same figures as English.
    const en = new Set(nums(e.a)), ar = new Set(nums(e.a_ar));
    const missing = [...en].filter((n) => !ar.has(n));
    const extra = [...ar].filter((n) => !en.has(n));
    if (missing.length || extra.length)
      flagW(page.slug, i, `EN/AR figures differ: EN-only [${missing}] AR-only [${extra}]`);

    if (/\[[^\]]+\]\(/.test(e.a + e.a_ar)) flagP(page.slug, i, "link syntax — renderer ships with the code batch");
    allAnswers.push({ slug: page.slug, i, a: e.a, name: page.slug });
  });

  plan.push({ page, row });
}

// Near-duplicates across pages: identical once the page's own names are removed.
const PLACE = new RegExp(
  payload.pages.map((p) => (p.name ?? p.slug.replace(/-/g, " ")).toLowerCase()).sort((a, b) => b.length - a.length).join("|"),
  "g",
);
const norm = (s) => s.toLowerCase().replace(PLACE, "X");
const seen = new Map();
for (const x of allAnswers) {
  const k = norm(x.a);
  if (seen.has(k)) warn.push(`${x.slug}#${x.i + 1}: same answer as ${seen.get(k)} apart from the place name`);
  else seen.set(k, `${x.slug}#${x.i + 1}`);
}

console.log(`\n${payload.pages.length} pages, ${allAnswers.length} FAQs`);
console.log(problems.length ? `\nFAIL — ${problems.length} problem(s):\n  ${problems.join("\n  ")}` : "\nPASS — no blocking problems");
if (warn.length) console.log(`\n${warn.length} warning(s):\n  ${warn.join("\n  ")}`);

if (problems.length) process.exit(1);
if (!WRITE) {
  console.log("\nDry run. Re-run with --write to replace these pages' FAQs.");
  process.exit(0);
}

// ── write ───────────────────────────────────────────────────────────────────
const backupDir = path.join(waveDir, "backup");
fs.mkdirSync(backupDir, { recursive: true });
const clean = (f) => f.map(({ q, a, q_ar, a_ar }) => ({ q, a, q_ar, a_ar }));

for (const { page, row } of plan) {
  const file = path.join(backupDir, `${page.kind}-${page.slug}.json`);
  if (page.kind === "faqdoc" && !row) {
    // First write: create the document. Eyebrow and heading are left to the
    // registry defaults, so only the items are stored.
    fs.writeFileSync(file, "null\n");
    const r = await fetch(`${URL_}/rest/v1/pages`, {
      method: "POST",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify({
        slug: page.pageSlug,
        title: `${page.name ?? page.slug} (FAQ)`,
        status: "published",
        blocks: [{ key: "faq", enabled: true, values: { items: clean(page.faq) } }],
      }),
    });
    console.log(r.ok ? `created ${page.pageSlug} (${page.faq.length})` : `FAILED ${page.pageSlug}: ${r.status} ${await r.text()}`);
  } else if (page.kind === "area" || page.kind === "page" || page.kind === "faqdoc") {
    const key = page.kind === "page" ? (page.sectionKey ?? "faq") : "faq";
    fs.writeFileSync(file, JSON.stringify(row.blocks.find((s) => s.key === key), null, 2));
    const blocks = row.blocks.map((s) =>
      s.key === key ? { ...s, enabled: true, values: { ...s.values, items: clean(page.faq) } } : s,
    );
    const out = await patch(
      `pages?id=eq.${row.id}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,
      { blocks, updated_at: new Date().toISOString() },
    );
    console.log(out.length ? `wrote  ${page.pageSlug} (${page.faq.length})` : `SKIPPED ${page.pageSlug}: changed since read`);
  } else {
    fs.writeFileSync(file, JSON.stringify(row.meta, null, 2));
    const meta = { ...(row.meta ?? {}), faq: clean(page.faq) };
    const out = await patch(
      `developments?id=eq.${row.id}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,
      { meta, updated_at: new Date().toISOString() },
    );
    console.log(out.length ? `wrote  developments/${page.slug} (${page.faq.length})` : `SKIPPED ${page.slug}: changed since read`);
  }
}
