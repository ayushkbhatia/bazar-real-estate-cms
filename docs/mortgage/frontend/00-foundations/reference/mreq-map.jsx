/* eslint-disable */
// Mortgage requests · journey map — the three paths across the website (W) and the CMS (C).

function MrqJourneyMap() {
  const node = (code, title, detail, kind = "web", chips) => (
    <div style={{ height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "14px 15px", borderRadius: 10, background: kind === "cms" ? "var(--bz-accent-soft)" : kind === "out" ? "transparent" : "var(--bz-surface)", border: kind === "out" ? "1.5px dashed var(--bz-border-strong)" : kind === "cms" ? "1px solid transparent" : "1px solid var(--bz-border)" }}>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--bz-accent)" }}>{code}</span>
      <span style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.3, marginTop: 5 }}>{title}</span>
      {detail && <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--bz-ink-2)", marginTop: 5, textWrap: "pretty" }}>{detail}</span>}
      {chips && <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>{chips.map(c => <span key={c} style={{ fontSize: 10.5, padding: "3px 7px", borderRadius: 999, background: kind === "cms" ? "var(--bz-surface)" : "var(--bz-surface-2)", color: "var(--bz-ink-2)" }}>{c}</span>)}</span>}
    </div>
  );
  const at = (col, row, span, content, arrow = true) => (
    <div style={{ gridColumn: col, gridRow: `${row} / span ${span}`, position: "relative" }}>
      {arrow && <span style={{ position: "absolute", left: -19, top: "50%", transform: "translateY(-50%)", color: "var(--bz-muted-2)", display: "flex" }}>{I.chevR}</span>}
      {content}
    </div>
  );
  const path = (row, letter, title) => (
    <div style={{ gridColumn: 1, gridRow: row, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <span style={{ alignSelf: "flex-start", fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", padding: "3px 8px", borderRadius: 999, background: "var(--bz-surface-2)", color: "var(--bz-ink-2)" }}>PATH {letter}</span>
      <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3, marginTop: 8 }}>{title}</span>
    </div>
  );
  const band = (col, label) => (
    <div style={{ gridColumn: col, gridRow: 1, paddingBottom: 8, borderBottom: "1px solid var(--bz-border-strong)" }}><span className="eyebrow" style={{ color: "var(--bz-ink-2)" }}>{label}</span></div>
  );
  const stage = (col, label) => <div style={{ gridColumn: col, gridRow: 2, fontSize: 11.5, color: "var(--bz-muted)" }}>{label}</div>;
  const chainPill = (t, tone) => <MrqPill key={t} tone={tone} sm>{t}</MrqPill>;
  const arrow = <span style={{ color: "var(--bz-muted-2)", display: "flex" }}>{I.chevR}</span>;
  return (
    <div style={{ padding: "52px 56px", minHeight: "100%", background: "var(--bz-bg)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 40, paddingBottom: 28, borderBottom: "1px solid var(--bz-border)" }}>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">Mortgage requests · the complete flow</div>
          <h1 className="serif" style={{ fontSize: 56, lineHeight: 1.02, letterSpacing: "-0.025em", margin: "12px 0 0" }}>One form, three journeys</h1>
          <p style={{ margin: "14px 0 0", fontSize: 15.5, lineHeight: 1.6, color: "var(--bz-ink-2)", maxWidth: 700, textWrap: "pretty" }}>The user chooses a service and enters their details once. From there the form only ever shows what that person needs — so nobody sees document fields that don't apply to them.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[["W1–W8", "website screens", "web"], ["C1–C6", "CMS screens", "cms"]].map(([c, l, k]) => (
            <div key={c} style={{ padding: "12px 16px", borderRadius: 10, minWidth: 150, background: k === "cms" ? "var(--bz-accent-soft)" : "var(--bz-surface)", border: k === "cms" ? "1px solid transparent" : "1px solid var(--bz-border)" }}>
              <div className="mono" style={{ fontSize: 16, fontWeight: 500 }}>{c}</div>
              <div style={{ fontSize: 11.5, color: "var(--bz-muted)", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>Entry points</span>
        {["Home · Get pre-approval today", "Mortgage calculator · Start pre-approval", "Property detail · Get mortgage pre-approval", "Mortgage calculator · Talk to advisor", "Services menu · Mortgage assistance"].map(t => <span key={t} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 999, background: "var(--bz-surface)", border: "1px solid var(--bz-border)", whiteSpace: "nowrap" }}>{t}</span>)}
        <span style={{ fontSize: 12, color: "var(--bz-muted)" }}>Pre-approval buttons open W1 with Fast Pre-Approval selected; advisor links open it on Mortgage Consultancy.</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "150px repeat(7, minmax(0,1fr))", gridTemplateRows: "auto auto repeat(3, minmax(128px, auto))", columnGap: 22, rowGap: 10, marginTop: 30 }}>
        {band("2 / span 4", "Website · applicant")}
        {band("6 / span 3", "CMS · Inbox › Mortgage requests")}
        {stage(2, "Step 1")}{stage(3, "Step 2")}{stage(4, "Step 3")}{stage(5, "Confirmation")}{stage(6, "Intake")}{stage(7, "Review")}{stage(8, "Outcome")}
        {path(3, "A", "Mortgage Consultancy")}
        {path(4, "B", "Fast Pre-Approval · Salaried")}
        {path(5, "C", "Fast Pre-Approval · Business Owner")}

        {at(2, 3, 3, node("W1", "Choose service", "The pick decides how long the form is.", "web", ["Consultancy → A", "Fast Pre-Approval → B · C"]), false)}
        {at(3, 3, 3, node("W2", "Personal details", "Residency, employment type, name, date of birth, mobile, email. Collected once, for everyone.", "web", ["Salaried → B", "Business Owner → C"]))}

        {at(4, 3, 1, node("W3", "No documents", "Review details → Request a Consultation"))}
        {at(4, 4, 1, node("W5", "Salaried set", null, "web", ["Emirates ID", "Passport", "Salary Certificate", "3 Months' Statements"]))}
        {at(4, 5, 1, node("W6", "Business Owner set", null, "web", ["Emirates ID", "Passport", "Trade License", "1 Year's Statements"]))}

        {at(5, 3, 1, node("W4", "Request received", "“A member of our mortgage team will contact you shortly.”"))}
        {at(5, 4, 2, node("W7", "Application received", "Reference number, the time the 24-hour promise runs out, and what was received."))}

        {at(6, 3, 3, node("C1", "Requests queue", "Every request lands here with its path, document status, owner and 24-hour clock. Files inside their last 4 hours are flagged.", "cms"))}

        {at(7, 3, 1, node("C6", "Contact & book", "Call, WhatsApp or email. Book the consultation, or send a Fast Pre-Approval link.", "cms"))}
        {at(7, 4, 1, node("C2 · C3", "File & document review", "Open each document, tick its checks, accept.", "cms"))}
        {at(7, 5, 1, node("C4 ⇄ W8", "Re-upload loop", "Ask for one document with a reason. The applicant adds it from a secure link; accepted documents stay accepted.", "cms"))}

        {at(8, 3, 1, node("—", "Consultation held", "Booked → Completed. Can move to Path B or C without re-entering details.", "out"))}
        {at(8, 4, 2, node("C5", "Pre-approve or decline", "Pick the partner-bank response, record the outcome, notify the applicant by email and WhatsApp.", "cms"))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr 0.9fr", gap: 16, marginTop: 36 }}>
        <div className="bz-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>Document sets</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 12.5 }}>
            <thead><tr>{["", "Salaried", "Business Owner"].map(h => <th key={h} style={{ textAlign: "left", fontWeight: 500, fontSize: 11, color: "var(--bz-muted)", padding: "0 0 8px", letterSpacing: ".04em" }}>{h}</th>)}</tr></thead>
            <tbody>
              {[["Identity", "Emirates ID", "Emirates ID"], ["", "Passport copy", "Passport copy"], ["Income", "Salary certificate", "Business trade license"], ["Statements", "Last 3 months · 25 MB", "Last 1 year · 40 MB"]].map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: "7px 8px 7px 0", borderTop: "1px solid var(--bz-border)", color: j ? "var(--bz-ink)" : "var(--bz-muted)", fontWeight: j && i > 1 ? 500 : 400 }}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bz-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>Statuses in the CMS</div>
          <div style={{ fontSize: 11.5, color: "var(--bz-muted)", marginTop: 14 }}>Fast Pre-Approval</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {chainPill("New", "accent")}{arrow}{chainPill("In review", "warn")}{arrow}{chainPill("With banks", "info")}{arrow}{chainPill("Pre-approved", "success")}<span style={{ fontSize: 11, color: "var(--bz-muted)" }}>or</span>{chainPill("Declined", "danger")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5, color: "var(--bz-muted)" }}>{chainPill("In review", "warn")}<span>⇄</span>{chainPill("Awaiting applicant", "muted")}<span>while a re-upload is outstanding</span></div>
          <div style={{ fontSize: 11.5, color: "var(--bz-muted)", marginTop: 16 }}>Mortgage Consultancy</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {chainPill("New", "accent")}{arrow}{chainPill("Contacted", "warn")}{arrow}{chainPill("Consultation booked", "info")}{arrow}{chainPill("Completed", "success")}
          </div>
        </div>
        <div className="bz-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>The 24-hour promise</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9, fontSize: 12.5, lineHeight: 1.5, color: "var(--bz-ink-2)" }}>
            {["Starts when the applicant presses Get Fast Pre-Approval.", "Pauses while the file is Awaiting applicant.", "Stops when the pre-approval or decline is sent.", "Consultancy has no clock. C1 shows how long each request has waited."].map(t => (
              <div key={t} style={{ display: "flex", gap: 10 }}><span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--bz-accent)", marginTop: 7, flexShrink: 0 }} />{t}</div>
            ))}
          </div>
        </div>
      </div>
      <p style={{ margin: "22px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--bz-muted)", maxWidth: 900 }}>Employment Type is collected for everyone, but only changes the screen on the Fast Pre-Approval path — where it swaps the required documents between the Salaried and Business Owner sets.</p>
    </div>
  );
}

Object.assign(window, { MrqJourneyMap });
