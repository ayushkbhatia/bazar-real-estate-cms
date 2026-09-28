/* eslint-disable */
// Mortgage requests — shared atoms for the website journey (W1–W8) and the CMS review screens (C1–C6).

const MRQ_P = {
  idCard: <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.3 16.3c.7-1.3 1.8-2 3.2-2s2.5.7 3.2 2M14 10h4.5M14 13.5h3"/></>,
  passport: <><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3.2"/><path d="M8.8 10h6.4M9 17h6"/></>,
  cert: <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 15.5h7M9 19h3.5"/></>,
  licence: <><path d="M5 3h14v18H5z"/><path d="M8 7h8M8 10.5h8M8 14h3.5"/><circle cx="15.5" cy="16.5" r="2.2"/></>,
  statement: <><path d="M8 3h11v14"/><rect x="4" y="6.5" width="12" height="14.5" rx="1"/><path d="M7 11h6M7 14h6M7 17h3.5"/></>,
  lock: <><rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5V17"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></>,
  chat: <path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z"/>,
  alert: <><path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r=".7" fill="currentColor"/></>,
  pause: <><circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></>,
  zoomIn: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/></>,
  zoomOut: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></>,
  rotate: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/></>,
  shield: <><path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2.2 2.2L15.5 10"/></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10.5 5-3v9l-5-3"/></>,
  office: <path d="M4 21V5l8-2v18M12 7h8v14M3 21h18M7 8h2M7 12h2M7 16h2M15 11h2M15 15h2"/>,
  switch: <><path d="M4 8h13l-3-3M20 16H7l3 3"/></>,
};
function MIc({ n, s = 16, sw = 1.6, style }) { return <Icn d={MRQ_P[n]} size={s} sw={sw} style={style} />; }
const MRQ_TICK = <path d="m5 12 5 5L20 7" />;
function MrqTick({ s = 12, sw = 2.6 }) { return <Icn d={MRQ_TICK} size={s} sw={sw} />; }

// ── The two document sets (copy verbatim from the brief) ─────────
const MRQ_DOCS = {
  eid:      { name: "Emirates ID", short: "Emirates ID", hint: "Front and back · PDF, JPG, PNG · max 10 MB", glyph: "idCard" },
  passport: { name: "Passport copy", short: "Passport", hint: "Photo page · PDF, JPG, PNG · max 10 MB", glyph: "passport" },
  salary:   { name: "Salary certificate", short: "Salary Certificate", hint: "Addressed to the bank · PDF · max 10 MB", glyph: "cert" },
  stm3:     { name: "Last 3 months' bank statements", short: "3 Months' Statements", hint: "Several files · PDF · max 25 MB total", glyph: "statement", multi: true },
  licence:  { name: "Business trade license", short: "Trade License", hint: "Valid / current · PDF, JPG, PNG · max 10 MB", glyph: "licence" },
  stm12:    { name: "Last 1 year's bank statements", short: "1 Year's Statements", hint: "Several files · PDF · max 40 MB total", glyph: "statement", multi: true },
};
const MRQ_SETS = { salaried: ["eid", "passport", "salary", "stm3"], business: ["eid", "passport", "licence", "stm12"] };

// ── Tones, pills, statuses ───────────────────────────────────────
const MRQ_TONES = {
  accent:  ["var(--bz-accent-soft)", "var(--bz-accent)"],
  warn:    ["oklch(0.96 0.05 80)", "oklch(0.45 0.1 60)"],
  muted:   ["var(--bz-surface-2)", "var(--bz-ink-2)"],
  info:    ["oklch(0.95 0.03 240)", "oklch(0.42 0.1 245)"],
  success: ["oklch(0.94 0.04 145)", "oklch(0.35 0.08 145)"],
  danger:  ["oklch(0.96 0.04 28)", "oklch(0.45 0.13 28)"],
  ink:     ["var(--bz-ink)", "var(--bz-bg)"],
  line:    ["transparent", "var(--bz-ink-2)"],
};
function MrqPill({ tone = "muted", dot, sm, children, style }) {
  const [bg, fg] = MRQ_TONES[tone];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: sm ? 22 : 26, padding: sm ? "0 8px" : "0 11px", borderRadius: 999, fontSize: sm ? 11 : 12, fontWeight: 500, background: bg, color: fg, border: tone === "line" ? "1px solid var(--bz-border-strong)" : 0, whiteSpace: "nowrap", letterSpacing: 0, flexShrink: 0, ...style }}>{dot && <span className="bz-dot" />}{children}</span>;
}
const MRQ_STATUS = {
  new: ["New", "accent"], review: ["In review", "warn"], awaiting: ["Awaiting applicant", "muted"], banks: ["With banks", "info"],
  approved: ["Pre-approved", "success"], declined: ["Declined", "danger"], contacted: ["Contacted", "warn"], booked: ["Consultation booked", "info"], completed: ["Completed", "success"],
};
function MrqStatus({ s, sm }) { const [l, t] = MRQ_STATUS[s]; return <MrqPill tone={t} dot sm={sm}>{l}</MrqPill>; }
const MRQ_DSTATE = { review: ["To review", "warn"], accepted: ["Accepted", "success"], flagged: ["Re-upload requested", "danger"] };

// ── Form atoms ───────────────────────────────────────────────────
function MrqRadio({ on, size = 20 }) {
  return <span style={{ width: size, height: size, borderRadius: 999, flexShrink: 0, boxSizing: "border-box", background: "var(--bz-surface)", border: on ? `${Math.round(size * 0.3)}px solid var(--bz-ink)` : "1.5px solid var(--bz-border-strong)" }} />;
}
function MrqCheck({ on, size = 18, tone }) {
  return <span style={{ width: size, height: size, borderRadius: 5, flexShrink: 0, display: "grid", placeItems: "center", background: on ? (tone || "var(--bz-ink)") : "var(--bz-surface)", border: on ? "1.5px solid transparent" : "1.5px solid var(--bz-border-strong)", color: "var(--bz-bg)" }}>{on && <MrqTick s={Math.round(size * 0.66)} sw={2.8} />}</span>;
}

// ── Documents ────────────────────────────────────────────────────
const MRQ_TILE = {
  empty: ["var(--bz-surface-2)", "var(--bz-ink-2)"], done: ["oklch(0.94 0.04 145)", "oklch(0.4 0.09 145)"],
  busy: ["var(--bz-accent-soft)", "var(--bz-accent)"], error: ["oklch(0.96 0.04 28)", "oklch(0.5 0.15 28)"],
  review: ["oklch(0.96 0.05 80)", "oklch(0.45 0.1 60)"],
};
function MrqDocTile({ glyph, state = "empty", size = 44 }) {
  const [bg, fg] = MRQ_TILE[state];
  return (
    <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.24), background: bg, color: fg, display: "grid", placeItems: "center", flexShrink: 0, position: "relative" }}>
      <MIc n={glyph} s={Math.round(size * 0.46)} />
      {(state === "done" || state === "error") && (
        <span style={{ position: "absolute", right: -5, bottom: -5, width: 18, height: 18, borderRadius: 999, display: "grid", placeItems: "center", color: "#fff", background: state === "done" ? "oklch(0.55 0.12 145)" : "oklch(0.55 0.18 28)", boxShadow: "0 0 0 2px var(--bz-surface)" }}>
          {state === "done" ? <MrqTick s={10} sw={3} /> : <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>!</span>}
        </span>
      )}
    </span>
  );
}
function MrqThumb({ kind = "pdf", s = 1 }) {
  if (kind === "id") return <span style={{ width: 46 * s, height: 30 * s, borderRadius: 4, flexShrink: 0, border: "1px solid var(--bz-border)", background: "repeating-linear-gradient(135deg, var(--bz-surface-3) 0 1px, var(--bz-surface-2) 1px 6px)" }} />;
  return (
    <span style={{ width: 30 * s, height: 38 * s, borderRadius: 3, flexShrink: 0, background: "#fff", border: "1px solid var(--bz-border-strong)", padding: `${6 * s}px ${5 * s}px`, display: "flex", flexDirection: "column", gap: 3 * s, position: "relative", boxSizing: "border-box" }}>
      {[80, 100, 62, 100].map((w, i) => <span key={i} style={{ height: 1.5 * s, width: w + "%", background: "oklch(0.86 0.006 85)", borderRadius: 1 }} />)}
      <span className="mono" style={{ position: "absolute", left: 3 * s, bottom: 2 * s, fontSize: 7 * s, fontWeight: 600, color: "oklch(0.5 0.15 28)" }}>PDF</span>
    </span>
  );
}
// Website file line (inside an upload row)
function MrqFile({ name, meta, kind = "pdf", pct, err }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <MrqThumb kind={kind} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 12.5, color: err ? "oklch(0.45 0.13 28)" : "var(--bz-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        {pct != null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <div style={{ flex: 1, maxWidth: 280, height: 4, borderRadius: 99, background: "var(--bz-surface-3)", overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", borderRadius: 99, background: "var(--bz-accent)" }} /></div>
            <span style={{ fontSize: 11.5, color: "var(--bz-muted)" }}>{meta}</span>
          </div>
        ) : <div style={{ fontSize: 11.5, color: "var(--bz-muted)", marginTop: 2 }}>{meta}</div>}
      </div>
      {!err && pct == null && <span style={{ color: "oklch(0.5 0.12 145)", display: "flex" }}><MrqTick s={16} sw={2.2} /></span>}
      <span style={{ color: "var(--bz-muted)", display: "flex", cursor: "pointer" }}>{I.cross}</span>
    </div>
  );
}
// CMS file tag (compact)
function MrqFileTag({ name, meta, kind = "pdf" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 12px 6px 6px", borderRadius: 8, border: "1px solid var(--bz-border)", background: "var(--bz-surface)", maxWidth: 280 }}>
      <MrqThumb kind={kind} s={kind === "id" ? 0.8 : 0.72} />
      <span style={{ minWidth: 0 }}>
        <span className="mono" style={{ display: "block", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
        <span style={{ display: "block", fontSize: 10.5, color: "var(--bz-muted)", marginTop: 1 }}>{meta}</span>
      </span>
    </span>
  );
}
const MRQ_MONTHS = [["Sep", "25"], ["Oct", "25"], ["Nov", "25"], ["Dec", "25"], ["Jan", "26"], ["Feb", "26"], ["Mar", "26"], ["Apr", "26"], ["May", "26"], ["Jun", "26"], ["Jul", "26"], ["Aug", "26"]];
function MrqCoverage({ have = 9, h = 46 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 4 }}>
      {MRQ_MONTHS.map(([m, y], i) => {
        const ok = i < have;
        return (
          <div key={m} style={{ height: h, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, background: ok ? "oklch(0.94 0.04 145)" : "oklch(0.985 0.01 28)", border: ok ? "1px solid transparent" : "1.5px dashed oklch(0.72 0.12 28)" }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: ok ? "oklch(0.35 0.08 145)" : "oklch(0.48 0.15 28)" }}>{m}</span>
            <span className="mono" style={{ fontSize: 9.5, color: ok ? "oklch(0.45 0.06 145)" : "oklch(0.55 0.12 28)" }}>’{y}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── 24-hour promise clock ────────────────────────────────────────
function MrqClock({ left, due, pct, tone = "ok", w = 220 }) {
  const col = { ok: "var(--bz-accent)", risk: "oklch(0.55 0.18 28)", paused: "var(--bz-muted-2)", met: "oklch(0.55 0.12 145)" }[tone];
  return (
    <div style={{ width: w }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", color: tone === "risk" ? "oklch(0.48 0.16 28)" : tone === "paused" ? "var(--bz-ink-2)" : "var(--bz-ink)" }}><MIc n={tone === "paused" ? "pause" : "clock"} s={13} />{left}</span>
        {due && <span style={{ fontSize: 11.5, color: "var(--bz-muted)", whiteSpace: "nowrap" }}>{due}</span>}
      </div>
      <div style={{ height: 4, borderRadius: 99, background: "var(--bz-surface-3)", marginTop: 7, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", borderRadius: 99, background: col, backgroundImage: tone === "paused" ? "repeating-linear-gradient(135deg, transparent 0 3px, rgba(255,255,255,.55) 3px 5px)" : "none" }} />
      </div>
    </div>
  );
}

// ── CMS atoms ────────────────────────────────────────────────────
const MRQ_TEAM = { YA: ["Yasmin Abdalla", "Head of mortgages"], RK: ["Rashid Khan", "Mortgage adviser"], LV: ["Leena Varghese", "Mortgage adviser"] };
function MrqOwner({ who, size = 26, named }) {
  if (!who) return <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--bz-muted)" }}><span style={{ width: size, height: size, borderRadius: 999, border: "1.5px dashed var(--bz-border-strong)", boxSizing: "border-box" }} />{named && "Unassigned"}</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 13 }}><Avatar initials={who} size={size} />{named && <span><span style={{ display: "block", fontWeight: 500 }}>{MRQ_TEAM[who][0]}</span><span style={{ display: "block", fontSize: 11.5, color: "var(--bz-muted)" }}>{MRQ_TEAM[who][1]}</span></span>}</span>;
}
function MrqDocBar({ states, label }) {
  if (!states) return <span style={{ fontSize: 12, color: "var(--bz-muted)" }}>Not required</span>;
  const col = { accepted: "oklch(0.58 0.12 145)", review: "oklch(0.8 0.1 80)", flagged: "oklch(0.58 0.18 28)" };
  const n = states.filter(s => s === "accepted").length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "flex", gap: 3 }}>{states.map((s, i) => <span key={i} style={{ width: 15, height: 6, borderRadius: 2, background: col[s] }} />)}</span>
      <span className="mono" style={{ fontSize: 11.5, color: "var(--bz-muted)", whiteSpace: "nowrap" }}>{label || `${n}/${states.length}`}</span>
    </span>
  );
}
function MrqCard({ title, aside, children, pad = 20, style }) {
  return (
    <div className="bz-card" style={style}>
      {title && <div style={{ display: "flex", alignItems: "center", gap: 12, padding: `14px ${pad}px`, borderBottom: "1px solid var(--bz-border)" }}><div style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{title}</div>{aside}</div>}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}
function MrqKV({ rows, size = 12.5 }) {
  return <div>{rows.map(([l, v], i) => (
    <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderTop: i ? "1px solid var(--bz-border)" : 0, fontSize: size }}>
      <span style={{ color: "var(--bz-muted)", flexShrink: 0 }}>{l}</span><span style={{ textAlign: "right", minWidth: 0 }}>{v}</span>
    </div>
  ))}</div>;
}
function MrqActivity({ items }) {
  return (
    <div>
      {items.map(([t, text, sub, tone], i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 12px minmax(0,1fr)", columnGap: 10, position: "relative", paddingBottom: i === items.length - 1 ? 0 : 14 }}>
          {i < items.length - 1 && <span style={{ position: "absolute", left: 55, top: 14, bottom: 0, width: 1, background: "var(--bz-border)" }} />}
          <span className="mono" style={{ fontSize: 11, color: "var(--bz-muted)", paddingTop: 1 }}>{t}</span>
          <span style={{ width: 8, height: 8, borderRadius: 99, marginTop: 5, marginLeft: 2, background: tone ? MRQ_TONES[tone][1] : "var(--bz-border-strong)", position: "relative" }} />
          <div style={{ fontSize: 12.5, lineHeight: 1.45, minWidth: 0 }}>{text}{sub && <div style={{ fontSize: 11.5, color: "var(--bz-muted)", marginTop: 1 }}>{sub}</div>}</div>
        </div>
      ))}
    </div>
  );
}
function MrqFileHead({ chips, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      {chips.map(([t, tone]) => <MrqPill key={t} tone={tone || "muted"}>{t}</MrqPill>)}
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}
function MrqStages({ stages, at, side }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
      {stages.map((s, i) => (
        <div key={s} style={{ flex: 1, height: 38, padding: "0 14px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 500, background: i < at ? "var(--bz-accent-soft)" : i === at ? "var(--bz-ink)" : "var(--bz-surface)", color: i < at ? "var(--bz-accent)" : i === at ? "var(--bz-bg)" : "var(--bz-muted)", border: i > at ? "1px solid var(--bz-border)" : "1px solid transparent" }}>
          {i < at ? <MrqTick /> : <span className="mono" style={{ fontSize: 11, opacity: .8 }}>{i + 1}</span>}{s}
        </div>
      ))}
      {side}
    </div>
  );
}

// ── Website shell ────────────────────────────────────────────────
function MrqTopBar() {
  return (
    <header style={{ height: 68, padding: "0 48px", display: "flex", alignItems: "center", gap: 18, background: "var(--bz-surface)", borderBottom: "1px solid var(--bz-border)", flexShrink: 0 }}>
      <div className="bz-nav__logo"><b>Bazar</b></div>
      <span style={{ width: 1, height: 20, background: "var(--bz-border-strong)" }} />
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--bz-ink-2)" }}>Mortgages</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--bz-muted)" }}>Mortgage brokerage · ADREC permit MB-2026-01184</span>
      <span style={{ width: 1, height: 20, background: "var(--bz-border)" }} />
      <Btn kind="ghost" size="sm" icon={I.cross}>Exit</Btn>
    </header>
  );
}
function MrqStepper({ step = 0, last = "Documents" }) {
  const steps = ["Choose service", "Your details", last];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {steps.map((s, i) => {
        const st = i < step ? "done" : i === step ? "now" : "todo";
        return (
          <React.Fragment key={s}>
            {i > 0 && <span style={{ width: 40, height: 1, background: i <= step ? "var(--bz-ink-2)" : "var(--bz-border-strong)" }} />}
            <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 11, fontFamily: "var(--bz-font-mono)", boxSizing: "border-box", background: st === "now" ? "var(--bz-ink)" : st === "done" ? "var(--bz-accent-soft)" : "transparent", color: st === "now" ? "var(--bz-bg)" : st === "done" ? "var(--bz-accent)" : "var(--bz-muted)", border: st === "todo" ? "1px solid var(--bz-border-strong)" : "1px solid transparent" }}>{st === "done" ? <MrqTick /> : i + 1}</span>
              <span style={{ fontSize: 13, fontWeight: st === "now" ? 500 : 400, color: st === "todo" ? "var(--bz-muted)" : "var(--bz-ink)" }}>{s}</span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
function MrqFlow({ step, last, rail, children, top }) {
  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--bz-bg)" }}>
      <MrqTopBar />
      <main style={{ flex: 1, padding: "30px 48px 64px" }}>
        <div style={{ maxWidth: 1216, margin: "0 auto" }}>
          {step != null && <MrqStepper step={step} last={last} />}
          {top}
          <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: rail ? "minmax(0,1fr) 356px" : "minmax(0,1fr)", gap: 72, alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>{children}</div>
            {rail && <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>{rail}</aside>}
          </div>
        </div>
      </main>
      <footer style={{ padding: "18px 48px", borderTop: "1px solid var(--bz-border)", display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--bz-muted)" }}>
        <span>© 2026 Bazar Real Estate L.L.C. · Regulated by ADREC</span>
        <span style={{ display: "flex", gap: 20 }}><a>Privacy Policy</a><a>Terms of Use</a><a>+971 2 632 2223</a></span>
      </footer>
    </div>
  );
}
function MrqHead({ eyebrow, title, lede, size = 54 }) {
  return (
    <>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="serif" style={{ fontSize: size, lineHeight: 1.02, letterSpacing: "-0.025em", margin: "12px 0 0", maxWidth: 680, textWrap: "balance" }}>{title}</h1>
      {lede && <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--bz-ink-2)", maxWidth: 620, textWrap: "pretty" }}>{lede}</p>}
    </>
  );
}
function MrqSelections({ items, action = "Edit" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "var(--bz-surface)", border: "1px solid var(--bz-border)", borderRadius: 12, marginBottom: 36 }}>
      <span className="eyebrow" style={{ marginRight: 8 }}>Your selections</span>
      {items.map(([t, strong]) => <span key={t} style={{ height: 28, padding: "0 12px", borderRadius: 999, display: "inline-flex", alignItems: "center", fontSize: 12.5, fontWeight: 500, background: strong ? "var(--bz-ink)" : "var(--bz-surface-2)", color: strong ? "var(--bz-bg)" : "var(--bz-ink)" }}>{t}</span>)}
      <div style={{ flex: 1 }} />
      <a style={{ fontSize: 12.5, fontWeight: 500, color: "var(--bz-accent)" }}>{action}</a>
    </div>
  );
}
function MrqRailCard({ title, children, pad = 24, soft }) {
  return (
    <div style={{ background: soft ? "var(--bz-surface-2)" : "var(--bz-surface)", border: "1px solid var(--bz-border)", borderRadius: 14, padding: pad }}>
      {title && <div className="serif" style={{ fontSize: 25, letterSpacing: "-0.01em", lineHeight: 1.1, marginBottom: 18 }}>{title}</div>}
      {children}
    </div>
  );
}
function MrqNext({ items, done = 0 }) {
  return (
    <div>
      {items.map(([b, rest], i) => (
        <div key={i} style={{ display: "flex", gap: 14, padding: i ? "14px 0 0" : 0, marginTop: i ? 14 : 0, borderTop: i ? "1px solid var(--bz-border)" : 0 }}>
          <span style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 11, fontFamily: "var(--bz-font-mono)", background: i < done ? "var(--bz-accent-soft)" : "var(--bz-surface-2)", color: i < done ? "var(--bz-accent)" : "var(--bz-ink-2)" }}>{i < done ? <MrqTick /> : i + 1}</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--bz-ink-2)", paddingTop: 3, textWrap: "pretty" }}><b style={{ fontWeight: 600, color: "var(--bz-ink)" }}>{b}</b>{rest}</span>
        </div>
      ))}
    </div>
  );
}
function MrqTrack({ items, done = 1 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))`, background: "var(--bz-surface)", border: "1px solid var(--bz-border)", borderRadius: 14 }}>
      {items.map(([b, rest, meta], i) => {
        const st = i < done ? "done" : i === done ? "now" : "todo";
        return (
          <div key={i} style={{ padding: "20px 22px 22px", borderLeft: i ? "1px solid var(--bz-border)" : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 11, fontFamily: "var(--bz-font-mono)", boxSizing: "border-box", background: st === "done" ? "var(--bz-accent-soft)" : st === "now" ? "var(--bz-ink)" : "transparent", color: st === "done" ? "var(--bz-accent)" : st === "now" ? "var(--bz-bg)" : "var(--bz-muted)", border: st === "todo" ? "1px solid var(--bz-border-strong)" : "1px solid transparent" }}>{st === "done" ? <MrqTick /> : i + 1}</span>
              <span className="eyebrow" style={{ fontSize: 10.5, color: st === "now" ? "var(--bz-ink)" : "var(--bz-muted)" }}>{st === "done" ? "Done" : st === "now" ? "Now" : "Next"}</span>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 14, color: "var(--bz-ink-2)", textWrap: "pretty" }}><b style={{ fontWeight: 600, color: "var(--bz-ink)" }}>{b}</b>{rest}</div>
            {meta && <div className="mono" style={{ fontSize: 11, color: "var(--bz-muted)", marginTop: 8 }}>{meta}</div>}
          </div>
        );
      })}
    </div>
  );
}
function MrqActions({ back = true, note, cta, arrow, disabled, fine, extra }) {
  return (
    <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--bz-border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {back && <Btn kind="ghost" icon={I.arrowL}>Back</Btn>}
        {extra}
        <div style={{ flex: 1 }} />
        {note && <div style={{ fontSize: 13, color: "var(--bz-muted)", textAlign: "right" }}>{note}</div>}
        <button className="bz-btn bz-btn--primary" style={{ height: 52, padding: "0 28px", fontSize: 15, borderRadius: 10, ...(disabled ? { background: "var(--bz-surface-3)", color: "var(--bz-muted)", cursor: "not-allowed" } : {}) }}>{cta}{arrow && I.arrowR}</button>
      </div>
      {fine && <div style={{ fontSize: 12, color: "var(--bz-muted)", marginTop: 14, textAlign: "right" }}>{fine}</div>}
    </div>
  );
}

Object.assign(window, {
  MRQ_P, MIc, MRQ_TICK, MrqTick, MRQ_DOCS, MRQ_SETS, MRQ_TONES, MrqPill, MRQ_STATUS, MrqStatus, MRQ_DSTATE,
  MrqRadio, MrqCheck, MrqDocTile, MrqThumb, MrqFile, MrqFileTag, MRQ_MONTHS, MrqCoverage, MrqClock,
  MRQ_TEAM, MrqOwner, MrqDocBar, MrqCard, MrqKV, MrqActivity, MrqFileHead, MrqStages,
  MrqTopBar, MrqStepper, MrqFlow, MrqHead, MrqSelections, MrqRailCard, MrqNext, MrqTrack, MrqActions,
});
