/* eslint-disable */
// Mortgage requests · CMS C3 document viewer (accept), C4 viewer (request re-upload), C5 pre-approval decision.

const MRQ_PAPER = { ink: "#1f1e1b", mute: "#6b6962", rule: "#e4e2dc" };

function MrqPaper({ children, w = 520 }) {
  return <div style={{ width: w, background: "#fff", color: MRQ_PAPER.ink, boxShadow: "0 1px 2px rgba(0,0,0,.08), 0 16px 40px rgba(0,0,0,.10)", padding: "40px 46px 44px", fontSize: 10.5, lineHeight: 1.65, fontFamily: "var(--bz-font-sans)", position: "relative", flexShrink: 0 }}>{children}</div>;
}

function MrqSalaryPage() {
  const { ink, mute, rule } = MRQ_PAPER;
  return (
    <MrqPaper>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 12, borderBottom: `2px solid ${ink}` }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".08em" }}>CORNICHE MEDICAL CENTRE L.L.C.</div>
          <div style={{ fontSize: 9, color: mute, marginTop: 2 }}>P.O. Box 48213 · Corniche Road West · Abu Dhabi · United Arab Emirates</div>
        </div>
        <div style={{ width: 36, height: 36, border: `1.5px solid ${ink}`, display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em" }}>CMC</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 10, color: mute }}><span>Ref: HR/SC/2026/0914</span><span>14 September 2026</span></div>
      <div style={{ marginTop: 14 }}>To: The Manager<br />First Abu Dhabi Bank<br />Abu Dhabi, United Arab Emirates</div>
      <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, letterSpacing: ".16em", marginTop: 20, textDecoration: "underline", textUnderlineOffset: 4 }}>SALARY CERTIFICATE</div>
      <p style={{ margin: "16px 0 0" }}>This is to certify that <b>Ms. Priya Raman</b>, an Indian national holding passport number Z4•••••82, has been employed with Corniche Medical Centre L.L.C. as <b>Senior Clinical Pharmacist</b> since 3 April 2019 on a permanent, full-time contract.</p>
      <p style={{ margin: "10px 0 0" }}>Her current monthly salary is as follows:</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <tbody>
          {[["Basic salary", "19,500.00"], ["Housing allowance", "9,000.00"], ["Transport allowance", "4,000.00"]].map(([l, v]) => (
            <tr key={l}><td style={{ padding: "4px 0", borderBottom: `1px solid ${rule}` }}>{l}</td><td style={{ padding: "4px 0", borderBottom: `1px solid ${rule}`, textAlign: "right", fontFamily: "var(--bz-font-mono)" }}>AED {v}</td></tr>
          ))}
          <tr><td style={{ padding: "6px 0", fontWeight: 700 }}>Total monthly gross salary</td><td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700, fontFamily: "var(--bz-font-mono)" }}>AED 32,500.00</td></tr>
        </tbody>
      </table>
      <p style={{ margin: "10px 0 0" }}>Her salary is transferred monthly to her account with Abu Dhabi Commercial Bank. This certificate is issued at her request for the purpose of a mortgage application, without any liability on the part of the company.</p>
      <div style={{ marginTop: 26, position: "relative", height: 104 }}>
        <div>For Corniche Medical Centre L.L.C.</div>
        <div style={{ fontFamily: "var(--bz-font-serif)", fontStyle: "italic", fontSize: 24, lineHeight: 1, marginTop: 8 }}>S. Menezes</div>
        <div style={{ width: 170, marginTop: 4, paddingTop: 4, borderTop: `1px solid ${ink}` }}><b>Sandra Menezes</b><br /><span style={{ color: mute }}>Head of Human Resources</span></div>
        <div style={{ position: "absolute", left: 206, top: -6, width: 90, height: 90, borderRadius: 999, border: "2px solid oklch(0.5 0.12 250 / .65)", color: "oklch(0.48 0.12 250 / .8)", display: "grid", placeItems: "center", transform: "rotate(-12deg)" }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, border: "1px solid currentColor", display: "grid", placeItems: "center", textAlign: "center", fontSize: 7.5, fontWeight: 700, letterSpacing: ".08em", lineHeight: 1.35 }}>CORNICHE<br />MEDICAL<br />CENTRE<br />ABU DHABI</div>
        </div>
      </div>
    </MrqPaper>
  );
}

function MrqStatementPage() {
  const { mute, rule } = MRQ_PAPER;
  const rows = [
    ["01 Mar", "Opening balance", "", "", "412,380.55"],
    ["02 Mar", "POS 4821 · ADNOC service station", "245.00", "", "412,135.55"],
    ["03 Mar", "Transfer in · Al Noor Contracting L.L.C.", "", "86,500.00", "498,635.55"],
    ["04 Mar", "WPS salary run · March", "64,210.00", "", "434,425.55"],
    ["05 Mar", "Rent · Warehouse 14, Mussafah", "22,500.00", "", "411,925.55"],
    ["07 Mar", "Cheque deposit 000418", "", "41,200.00", "453,125.55"],
    ["09 Mar", "ADDC · utilities", "3,184.20", "", "449,941.35"],
    ["10 Mar", "Transfer in · Emirates Fit-Out Co.", "", "128,000.00", "577,941.35"],
    ["12 Mar", "Supplier payment · Gulf Steel Trading", "97,450.00", "", "480,491.35"],
    ["14 Mar", "VAT payment · FTA", "18,366.40", "", "462,124.95"],
    ["15 Mar", "Card settlement · Network International", "", "12,840.60", "474,965.55"],
  ];
  const cell = { padding: "5px 6px", borderBottom: `1px solid ${rule}` };
  return (
    <MrqPaper>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", color: "oklch(0.38 0.07 200)" }}>GULF CRESCENT BANK</div>
          <div style={{ fontSize: 9.5, color: mute }}>Business current account statement</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 9.5, color: mute }}>Statement period<br /><b style={{ color: MRQ_PAPER.ink, fontSize: 10.5 }}>01 Mar 2026 – 31 May 2026</b><br />Page 1 of 4</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 10, marginTop: 16, padding: "10px 12px", background: "#f5f4f0", fontSize: 9.5 }}>
        <div><span style={{ color: mute }}>Account holder</span><br /><b style={{ fontSize: 10.5 }}>HADDAD TRADING L.L.C.</b></div>
        <div><span style={{ color: mute }}>Account number</span><br /><span style={{ fontFamily: "var(--bz-font-mono)" }}>AE07 0331 •••• •••• 4821</span></div>
        <div><span style={{ color: mute }}>Branch</span><br />Abu Dhabi Main · Hamdan Street</div>
        <div><span style={{ color: mute }}>Currency</span><br />AED</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12, fontSize: 9 }}>
        {[["Opening balance", "412,380.55"], ["Total credits", "1,284,110.00"], ["Total debits", "1,196,742.35"], ["Closing balance", "499,748.20"]].map(([l, v]) => (
          <div key={l} style={{ borderTop: `2px solid ${MRQ_PAPER.ink}`, paddingTop: 5 }}><div style={{ color: mute }}>{l}</div><div style={{ fontFamily: "var(--bz-font-mono)", fontSize: 10.5, fontWeight: 600, marginTop: 1 }}>{v}</div></div>
        ))}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14, fontSize: 9.5 }}>
        <thead><tr>{["Date", "Description", "Debit", "Credit", "Balance"].map((h, i) => <th key={h} style={{ ...cell, textAlign: i > 1 ? "right" : "left", fontWeight: 600, color: mute, borderBottom: `1px solid ${MRQ_PAPER.ink}` }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={r[0] + r[1]}>{r.map((c, i) => <td key={i} style={{ ...cell, textAlign: i > 1 ? "right" : "left", fontFamily: i > 1 ? "var(--bz-font-mono)" : "inherit", whiteSpace: "nowrap", color: i === 0 ? mute : MRQ_PAPER.ink }}>{c}</td>)}</tr>)}</tbody>
      </table>
      <div style={{ marginTop: 10, fontSize: 9, color: mute, textAlign: "right" }}>Continued on page 2</div>
    </MrqPaper>
  );
}

// Document viewer frame — document tabs, toolbar, stage, review panel.
function MrqViewer({ tabs, files, fileMeta, page, pageOf, panel }) {
  const tool = (ic, key) => <span key={key} style={{ width: 30, height: 30, borderRadius: 6, display: "grid", placeItems: "center", color: "var(--bz-ink-2)", border: "1px solid var(--bz-border)" }}>{ic}</span>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 372px", height: "100%", border: "1px solid var(--bz-border)", borderRadius: 12, overflow: "hidden", background: "var(--bz-surface)" }}>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, borderRight: "1px solid var(--bz-border)" }}>
        <div style={{ display: "flex", padding: "0 10px", borderBottom: "1px solid var(--bz-border)" }}>
          {tabs.map(([k, st, on]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, height: 46, padding: "0 12px", fontSize: 12.5, whiteSpace: "nowrap", color: on ? "var(--bz-ink)" : "var(--bz-ink-2)", fontWeight: on ? 500 : 400, borderBottom: on ? "2px solid var(--bz-ink)" : "2px solid transparent", marginBottom: -1 }}>
              <span style={{ width: 16, height: 16, borderRadius: 99, display: "grid", placeItems: "center", color: "#fff", background: st === "accepted" ? "oklch(0.58 0.12 145)" : st === "flagged" ? "oklch(0.58 0.18 28)" : "transparent", border: st === "review" ? "1.5px solid oklch(0.78 0.1 80)" : 0, boxSizing: "border-box" }}>{st === "accepted" ? <MrqTick s={9} sw={3.2} /> : st === "flagged" ? <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>!</span> : null}</span>
              {MRQ_DOCS[k].name}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--bz-border)" }}>
          {files ? files.map(([t, on]) => <span key={t} style={{ height: 30, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 6, fontSize: 12, background: on ? "var(--bz-ink)" : "var(--bz-surface-2)", color: on ? "var(--bz-bg)" : "var(--bz-ink-2)" }}><span className="mono" style={{ fontSize: 9, fontWeight: 600, color: on ? "inherit" : "oklch(0.5 0.15 28)", opacity: on ? .75 : 1 }}>PDF</span>{t}</span>)
            : <span className="mono" style={{ fontSize: 12, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileMeta}</span>}
          <div style={{ flex: 1 }} />
          {tool(<MIc n="zoomOut" s={15} />, "zo")}
          <span className="mono" style={{ fontSize: 11.5, color: "var(--bz-ink-2)", width: 44, textAlign: "center" }}>100%</span>
          {tool(<MIc n="zoomIn" s={15} />, "zi")}
          {tool(<MIc n="rotate" s={15} />, "ro")}
          <span style={{ width: 1, height: 20, background: "var(--bz-border)", margin: "0 4px" }} />
          <Btn kind="ghost" size="sm" icon={I.download}>Download</Btn>
        </div>
        <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "28px 0", overflow: "hidden", background: "var(--bz-surface-2)" }}>
          {page}
          <span className="mono" style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontSize: 11, padding: "4px 10px", borderRadius: 99, background: "var(--bz-ink)", color: "var(--bz-bg)" }}>{pageOf}</span>
        </div>
      </div>
      <aside style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>{panel}</aside>
    </div>
  );
}

function MrqPanelHead({ step, doc, sub }) {
  return (
    <div style={{ padding: "18px 20px 16px", borderBottom: "1px solid var(--bz-border)" }}>
      <div className="eyebrow">Reviewing · {step}</div>
      <div className="serif" style={{ fontSize: 26, lineHeight: 1.1, letterSpacing: "-0.01em", marginTop: 6 }}>{MRQ_DOCS[doc].name}</div>
      <div style={{ fontSize: 12, color: "var(--bz-muted)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
function MrqChecks({ items }) {
  return (
    <div>
      {items.map(([t, v, ok], i) => (
        <div key={t} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? "1px solid var(--bz-border)" : 0 }}>
          <MrqCheck on={ok} size={18} tone={ok ? "oklch(0.55 0.12 145)" : undefined} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13 }}>{t}</div>
            <div style={{ fontSize: 11.5, marginTop: 1, color: ok ? "var(--bz-muted)" : "oklch(0.48 0.15 28)" }}>{v}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── C3 · Viewer · Salary certificate · accept ────────────────────
function MrqViewSalary() {
  const field = (l, v) => (
    <div key={l}>
      <div style={{ fontSize: 11, color: "var(--bz-muted)", marginBottom: 4 }}>{l}</div>
      <input className="bz-field" defaultValue={v} style={{ height: 34, fontSize: 12.5 }} />
    </div>
  );
  return (
    <CmsShell active="Mortgages" title="Salary certificate" breadcrumbs="Mortgage requests › BZM-26-0412 · Priya Raman › Documents" secondary={<Btn kind="ghost" size="sm" icon={I.arrowL}>Back to file</Btn>}>
      <MrqViewer
        tabs={[["eid", "accepted"], ["passport", "accepted"], ["salary", "review", true], ["stm3", "review"]]}
        fileMeta="salary-certificate.pdf · 1 page · 412 KB"
        page={<MrqSalaryPage />} pageOf="Page 1 of 1"
        panel={<>
          <MrqPanelHead step="3 of 4" doc="salary" sub="Required: addressed to the bank · PDF · max 10 MB" />
          <div style={{ flex: 1, minHeight: 0, padding: "14px 20px", overflow: "hidden" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--bz-ink-2)", marginBottom: 4 }}>Checks</div>
            <MrqChecks items={[
              ["Name matches the application", "Priya Raman", true],
              ["Addressed to a bank", "First Abu Dhabi Bank", true],
              ["Issued within the last 30 days", "14 Sep 2026 · 8 days ago", true],
              ["Signed and stamped by the employer", "HR signature and company stamp", true],
              ["Monthly salary stated", "AED 32,500 gross", true],
            ]} />
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--bz-ink-2)", margin: "16px 0 10px" }}>Record for pricing</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {field("Monthly gross salary", "AED 32,500")}{field("Employed since", "Apr 2019")}
              <div style={{ gridColumn: "1 / -1" }}>{field("Employer", "Corniche Medical Centre L.L.C.")}</div>
            </div>
          </div>
          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--bz-border)" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn kind="outline" icon={I.refresh} style={{ flex: 1, padding: "0 10px" }}>Request re-upload</Btn>
              <Btn kind="primary" icon={I.check} style={{ flex: 1, padding: "0 10px" }}>Accept document</Btn>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 11.5, color: "var(--bz-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><MIc n="lock" s={13} />Opened by Yasmin · 16:21 · logged</span>
              <a style={{ color: "var(--bz-accent)", fontWeight: 500 }}>Next: bank statements →</a>
            </div>
          </div>
        </>}
      />
    </CmsShell>
  );
}

// ── C4 · Viewer · Bank statements · request re-upload ────────────
function MrqViewStatements() {
  const reason = (t, on) => <span key={t} style={{ height: 28, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, fontSize: 12, fontWeight: on ? 500 : 400, background: on ? "var(--bz-ink)" : "var(--bz-surface)", color: on ? "var(--bz-bg)" : "var(--bz-ink-2)", border: on ? "1px solid transparent" : "1px solid var(--bz-border)" }}>{on && <MrqTick s={11} />}{t}</span>;
  return (
    <CmsShell active="Mortgages" title="Last 1 year's bank statements" breadcrumbs="Mortgage requests › BZM-26-0409 · Karim Haddad › Documents" secondary={<Btn kind="ghost" size="sm" icon={I.arrowL}>Back to file</Btn>}>
      <MrqViewer
        tabs={[["eid", "accepted"], ["passport", "accepted"], ["licence", "accepted"], ["stm12", "flagged", true]]}
        files={[["Sep–Nov 2025"], ["Dec–Feb 2026"], ["Mar–May 2026", true]]}
        page={<MrqStatementPage />} pageOf="File 3 of 3 · page 1 of 4"
        panel={<>
          <MrqPanelHead step="4 of 4" doc="stm12" sub="Required: several files · PDF · max 40 MB total" />
          <div style={{ padding: "14px 20px 16px", borderBottom: "1px solid var(--bz-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 500, color: "var(--bz-ink-2)", marginBottom: 8 }}><span>Coverage · last 12 months</span><span style={{ color: "oklch(0.48 0.15 28)" }}>9 of 12</span></div>
            <MrqCoverage have={9} h={38} />
            <div style={{ marginTop: 12 }}>
              <MrqChecks items={[
                ["Account holder matches the trade licence", "Haddad Trading L.L.C.", true],
                ["Issued by the bank", "Original PDFs, not scans", true],
                ["Covers the last 12 months", "Jun, Jul and Aug 2026 missing", false],
              ]} />
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: "14px 20px", background: "var(--bz-bg)", overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Request re-upload</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {[["Unreadable"], ["Wrong document"], ["Expired"], ["Period incomplete", true], ["Pages missing"], ["Other"]].map(([t, on]) => reason(t, on))}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--bz-muted)", margin: "14px 0 6px" }}>Message to Karim</div>
            <textarea className="bz-field" rows={4} style={{ fontSize: 12.5, lineHeight: 1.5 }} defaultValue="Your statements cover September 2025 to May 2026. For a full year, please add June, July and August 2026." />
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, fontSize: 12.5 }}>
              <span style={{ fontSize: 11.5, color: "var(--bz-muted)" }}>Send by</span>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}><MrqCheck on size={16} />WhatsApp</span>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}><MrqCheck on size={16} />Email</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "var(--bz-surface-2)", fontSize: 11.5, lineHeight: 1.5, color: "var(--bz-ink-2)" }}>
              <span style={{ marginTop: 1, display: "flex" }}><MIc n="pause" s={14} /></span>
              <span>The 24-hour clock pauses until Karim uploads. His three accepted documents stay accepted.</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--bz-border)" }}>
            <Btn kind="ghost" style={{ flex: 1 }}>Cancel</Btn>
            <Btn kind="primary" icon={I.send} style={{ flex: 2 }}>Send request to Karim</Btn>
          </div>
        </>}
      />
    </CmsShell>
  );
}

// ── C5 · Pre-approval decision ───────────────────────────────────
function MrqBankMark({ code, tone }) {
  return <span className="mono" style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 600, color: "#fff", background: tone }}>{code}</span>;
}

function MrqDecision() {
  const banks = [
    ["FAB", "First Abu Dhabi Bank", "oklch(0.42 0.06 250)", "approved", "AED 2,150,000", "3.99% fixed · 3 yrs", "AED 11,337", "18:31", true],
    ["ADCB", "Abu Dhabi Commercial Bank", "oklch(0.45 0.09 25)", "approved", "AED 2,000,000", "4.15% fixed · 3 yrs", "AED 10,723", "18:02"],
    ["MSQ", "Mashreq", "oklch(0.45 0.08 320)", "waiting"],
  ];
  const lbl = t => <div style={{ fontSize: 11.5, color: "var(--bz-muted)", marginBottom: 6 }}>{t}</div>;
  return (
    <CmsShell active="Mortgages" title="Priya Raman" breadcrumbs="Inbox › Mortgage requests › BZM-26-0412 › Decision" secondary={<Btn kind="ghost" size="sm" icon={I.arrowL}>Back to file</Btn>}>
      <MrqFileHead chips={[["Fast Pre-Approval", "ink"], ["Salaried"], ["UAE Resident / Expat · up to 80% LTV"]]} right={<MrqClock left="15h 19m left" due="Due Wed 23 Sep, 10:14" pct={36} w={300} />} />
      <MrqStages stages={["New", "In review", "With banks", "Pre-approved"]} at={2} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 400px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
            {[["4 of 4 documents accepted", "Last one accepted by Yasmin at 17:02"], ["Consent on file", "Partner-bank sharing · 22 Sep, 10:14"], ["Sent to 3 partner banks", "Package shared at 17:05"]].map(([t, s]) => (
              <div key={t} style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: "var(--bz-surface)", border: "1px solid var(--bz-border)" }}>
                <span style={{ width: 22, height: 22, borderRadius: 99, flexShrink: 0, display: "grid", placeItems: "center", color: "#fff", background: "oklch(0.58 0.12 145)" }}><MrqTick s={11} sw={3} /></span>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 500 }}>{t}</div><div style={{ fontSize: 11.5, color: "var(--bz-muted)", marginTop: 1 }}>{s}</div></div>
              </div>
            ))}
          </div>
          <MrqCard title="Partner bank responses" aside={<span style={{ fontSize: 12, color: "var(--bz-muted)" }}>Choose the offer to lead with</span>} pad={0}>
            {banks.map(([code, name, tone, st, amt, rate, pay, at, on], i) => (
              <div key={code} style={{ display: "grid", gridTemplateColumns: "22px 38px minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,.9fr)", gap: 14, alignItems: "center", padding: "16px 20px", borderTop: i ? "1px solid var(--bz-border)" : 0, background: on ? "var(--bz-surface-2)" : "transparent" }}>
                {st === "waiting" ? <span /> : <MrqRadio on={on} />}
                <MrqBankMark code={code} tone={tone} />
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 500 }}>{name}</div><div style={{ marginTop: 4 }}>{st === "waiting" ? <MrqPill tone="muted" sm>Awaiting reply · sent 17:05</MrqPill> : <MrqPill tone="success" sm dot>Pre-approved · {at}</MrqPill>}</div></div>
                {st === "waiting" ? (
                  <div style={{ gridColumn: "4 / -1", display: "flex", justifyContent: "flex-end" }}><Btn kind="outline" size="sm">Send a reminder</Btn></div>
                ) : <>
                  <div><div style={{ fontSize: 11, color: "var(--bz-muted)" }}>Up to</div><div className="mono" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>{amt}</div></div>
                  <div><div style={{ fontSize: 11, color: "var(--bz-muted)" }}>Rate</div><div style={{ fontSize: 13, marginTop: 2 }}>{rate}</div></div>
                  <div><div style={{ fontSize: 11, color: "var(--bz-muted)" }}>25 yrs · monthly</div><div className="mono" style={{ fontSize: 13, marginTop: 2 }}>{pay}</div></div>
                </>}
              </div>
            ))}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--bz-border)", fontSize: 12, color: "var(--bz-muted)" }}>Priced on a monthly gross salary of AED 32,500 (salary certificate) and a maximum LTV of 80% (UAE Resident / Expat).</div>
          </MrqCard>
          <MrqCard title="Activity">
            <MrqActivity items={[
              ["18:31", "FAB pre-approved up to AED 2,150,000", "Letter attached · FAB-pre-approval-BZM-26-0412.pdf", "success"],
              ["18:02", "ADCB pre-approved up to AED 2,000,000", null, "success"],
              ["17:05", "Package sent to FAB, ADCB and Mashreq", "4 documents · structured summary", "info"],
              ["17:02", "Yasmin accepted Last 3 months' bank statements", null, "success"],
            ]} />
          </MrqCard>
        </div>
        <div className="bz-card" style={{ overflow: "visible" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bz-border)" }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>Decision</div>
            <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 8, background: "var(--bz-surface-2)", marginTop: 12 }}>
              {["Pre-approve", "Decline"].map((t, i) => <span key={t} style={{ flex: 1, height: 32, display: "grid", placeItems: "center", borderRadius: 6, fontSize: 12.5, fontWeight: i === 0 ? 500 : 400, background: i === 0 ? "var(--bz-surface)" : "transparent", boxShadow: i === 0 ? "0 1px 2px rgba(0,0,0,.08)" : "none", color: i === 0 ? "var(--bz-ink)" : "var(--bz-ink-2)" }}>{t}</span>)}
            </div>
          </div>
          <div style={{ padding: "16px 20px" }}>
            <MrqKV rows={[["Lead offer", "FAB · up to AED 2,150,000"], ["Rate", "3.99% fixed for 3 years"], ["Valid until", "21 Nov 2026 · 60 days"]]} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bz-border)" }}>
              <MrqThumb s={0.7} />
              <span className="mono" style={{ flex: 1, fontSize: 11.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>FAB-pre-approval-BZM-26-0412.pdf</span>
              <span style={{ color: "oklch(0.5 0.12 145)", display: "flex" }}><MrqTick s={14} sw={2.4} /></span>
            </div>
            <div style={{ marginTop: 16 }}>{lbl("Message to Priya")}</div>
            <textarea className="bz-field" rows={7} style={{ fontSize: 12.5, lineHeight: 1.55 }} defaultValue={"Good news, Priya: you're pre-approved. First Abu Dhabi Bank has pre-approved you for up to AED 2,150,000 at 3.99% fixed for 3 years, valid until 21 November 2026. ADCB has also pre-approved you for up to AED 2,000,000.\n\nI'll call you tomorrow morning to talk through both. Yasmin"} />
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, fontSize: 12.5 }}>
              <span style={{ fontSize: 11.5, color: "var(--bz-muted)" }}>Send by</span>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}><MrqCheck on size={16} />Email + letter</span>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}><MrqCheck on size={16} />WhatsApp</span>
            </div>
          </div>
          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--bz-border)" }}>
            <Btn kind="primary" size="lg" icon={I.check} style={{ width: "100%" }}>Confirm pre-approval & notify Priya</Btn>
            <div style={{ fontSize: 11.5, color: "var(--bz-muted)", marginTop: 10, textAlign: "center" }}>Moves the file to Pre-approved and stops the clock at 8h 41m.</div>
          </div>
        </div>
      </div>
    </CmsShell>
  );
}

Object.assign(window, { MRQ_PAPER, MrqPaper, MrqSalaryPage, MrqStatementPage, MrqViewer, MrqPanelHead, MrqChecks, MrqViewSalary, MrqViewStatements, MrqBankMark, MrqDecision });
