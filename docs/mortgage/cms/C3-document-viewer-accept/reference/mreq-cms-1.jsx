/* eslint-disable */
// Mortgage requests · CMS C1 queue, C2 pre-approval file (in review), C6 consultancy request.

// now = Tue 22 Sep 2026, 16:32
const MRQ_QUEUE = [
  ["BZM-26-0406", "Mariam Al Kaabi", "+971 50 ••• 3321", "pre", "UAE National · Business Owner", ["accepted", "accepted", "review", "review"], "review", { left: "1h 48m left", pct: 92, tone: "risk" }, "LV", "Mon 18:20"],
  ["BZM-26-0403", "Thomas Becker", "+971 52 ••• 7710", "pre", "Expat · Salaried", ["accepted", "accepted", "accepted", "review"], "review", { left: "3h 20m left", pct: 86, tone: "risk" }, "RK", "Mon 19:52"],
  ["BZM-26-0398", "Arjun Mehta", "+971 55 ••• 0142", "pre", "Expat · Salaried", ["accepted", "accepted", "accepted", "accepted"], "banks", { left: "4h 30m left", pct: 81 }, "YA", "Mon 21:02"],
  ["BZM-26-0404", "Liam Walsh", "+971 58 ••• 9021", "pre", "Expat · Salaried", ["accepted", "accepted", "accepted", "accepted"], "banks", { left: "9h 15m left", pct: 61 }, "RK", "Today 01:47"],
  ["BZM-26-0409", "Karim Haddad", "+971 55 ••• 2290", "pre", "Expat · Business Owner", ["accepted", "accepted", "accepted", "flagged"], "awaiting", { left: "Paused · 9h 13m left", pct: 62, tone: "paused" }, "YA", "Mon 21:05"],
  ["BZM-26-0412", "Priya Raman", "+971 50 ••• 4417", "pre", "Expat · Salaried", ["accepted", "accepted", "review", "review"], "review", { left: "17h 42m left", pct: 26 }, "YA", "Today 10:14", true],
  ["BZM-26-0416", "Daniel Okafor", "+971 56 ••• 6604", "pre", "Expat · Business Owner", ["review", "review", "review", "review"], "new", { left: "21h 05m left", pct: 12 }, null, "Today 13:37"],
  ["BZM-26-0417", "Sofia Marques", "+971 50 ••• 8836", "pre", "Expat · Salaried", ["review", "review", "review", "review"], "new", { left: "22h 41m left", pct: 6 }, null, "Today 15:13"],
  ["BZM-26-0418", "Omar Al Hammadi", "+971 50 ••• 1178", "consult", "UAE National · Salaried", null, "new", { text: "Waiting 12m", icon: "clock" }, null, "Today 16:20"],
  ["BZM-26-0415", "Ahmed Al Suwaidi", "+971 50 ••• 1290", "consult", "UAE National · Salaried", null, "contacted", { text: "Replied on WhatsApp 11:20", icon: "chat" }, "RK", "Today 09:47"],
  ["BZM-26-0401", "Noura Al Mansoori", "+971 50 ••• 5513", "consult", "UAE National · Business Owner", null, "booked", { text: "Wed 23 Sep · 11:30", icon: "calendar" }, "LV", "Mon 11:02"],
];

function MrqQueueRow({ r }) {
  const [ref, name, mob, svc, profile, docs, status, clock, owner, rec, sel] = r;
  const td = { padding: "12px 14px", verticalAlign: "middle", background: sel ? "var(--bz-surface-2)" : undefined };
  return (
    <tr>
      <td style={{ ...td, boxShadow: sel ? "inset 3px 0 0 var(--bz-ink)" : "none" }}><span className="mono" style={{ fontSize: 12 }}>{ref}</span></td>
      <td style={td}><div style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{name}</div><div className="mono" style={{ fontSize: 11, color: "var(--bz-muted)", marginTop: 2 }}>{mob}</div></td>
      <td style={td}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}><span style={{ width: 7, height: 7, borderRadius: 2, background: svc === "pre" ? "var(--bz-ink)" : "var(--bz-accent)" }} /><span style={{ fontWeight: 500 }}>{svc === "pre" ? "Fast Pre-Approval" : "Mortgage Consultancy"}</span></div>
        <div style={{ fontSize: 11.5, color: "var(--bz-muted)", marginTop: 2, paddingLeft: 15, whiteSpace: "nowrap" }}>{profile}</div>
      </td>
      <td style={td}><MrqDocBar states={docs} /></td>
      <td style={td}><MrqStatus s={status} sm /></td>
      <td style={td}>{clock.text
        ? <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--bz-ink-2)", whiteSpace: "nowrap" }}>{clock.icon === "calendar" ? I.calendar : <MIc n={clock.icon} s={14} />}{clock.text}</span>
        : <MrqClock left={clock.left} pct={clock.pct} tone={clock.tone} w={176} />}</td>
      <td style={td}><MrqOwner who={owner} /></td>
      <td style={{ ...td, fontSize: 12, color: "var(--bz-muted)", whiteSpace: "nowrap" }}>{rec}</td>
    </tr>
  );
}

// ── C1 · Requests queue ──────────────────────────────────────────
function MrqQueue() {
  const th = { padding: "10px 14px", fontSize: 10.5 };
  return (
    <CmsShell active="Mortgages" title="Mortgage requests" breadcrumbs="Inbox · 31 open · 5 new">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "oklch(0.975 0.02 28)", border: "1px solid oklch(0.88 0.06 28)", color: "oklch(0.45 0.14 28)" }}>
          <MIc n="clock" />
          <div style={{ flex: 1, fontSize: 13 }}><b style={{ fontWeight: 600 }}>2 pre-approvals are inside their last 4 hours.</b> <span style={{ color: "var(--bz-ink-2)" }}>Mariam Al Kaabi (BZM-26-0406) has 1h 48m left and Thomas Becker (BZM-26-0403) has 3h 20m.</span></div>
          <a style={{ fontSize: 12.5, fontWeight: 500 }}>Show only these</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 8, background: "var(--bz-surface-2)" }}>
            {[["All", 31], ["Fast Pre-Approval", 22], ["Mortgage Consultancy", 9]].map(([t, c], i) => (
              <span key={t} style={{ height: 30, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, fontSize: 12.5, fontWeight: i === 0 ? 500 : 400, background: i === 0 ? "var(--bz-surface)" : "transparent", boxShadow: i === 0 ? "0 1px 2px rgba(0,0,0,.08)" : "none", color: i === 0 ? "var(--bz-ink)" : "var(--bz-ink-2)" }}>{t}<span className="mono" style={{ fontSize: 11, color: "var(--bz-muted)" }}>{c}</span></span>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative", width: 240 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--bz-muted)", display: "flex" }}>{I.search}</span>
            <input className="bz-field" placeholder="Name, reference or mobile" style={{ height: 34, paddingLeft: 32 }} />
          </div>
          <select className="bz-field" style={{ width: 150, height: 34 }}><option>Owner: anyone</option></select>
          <select className="bz-field" style={{ width: 170, height: 34 }}><option>Sort: promise due</option></select>
        </div>
        <div className="bz-card">
          <div className="bz-tabs" style={{ padding: "0 18px", gap: 22 }}>
            {[["Open", 31], ["New", 5], ["In review", 9], ["Awaiting applicant", 4], ["With banks", 6], ["Contacted & booked", 7], ["Closed"]].map(([t, c], i) => (
              <div key={t} className={`bz-tab ${i === 0 ? "is-active" : ""}`} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>{t}{c != null && <span className="mono" style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 99, background: i === 0 ? "var(--bz-ink)" : "var(--bz-surface-3)", color: i === 0 ? "var(--bz-bg)" : "var(--bz-muted)" }}>{c}</span>}</div>
            ))}
          </div>
          <table className="bz-table">
            <thead><tr>{["Reference", "Applicant", "Request", "Documents", "Status", "24-hour promise", "Owner", "Received"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{MRQ_QUEUE.map(r => <MrqQueueRow key={r[0]} r={r} />)}</tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: "1px solid var(--bz-border)", fontSize: 12, color: "var(--bz-muted)" }}>
            <span>Showing 11 of 31 open requests · sorted by promise due</span>
            <span style={{ display: "flex", gap: 6 }}><Btn kind="outline" size="sm" icon={I.arrowL} /><Btn kind="outline" size="sm" icon={I.arrowR} /></span>
          </div>
        </div>
      </div>
    </CmsShell>
  );
}

// ── Shared file-page pieces ──────────────────────────────────────
function MrqReviewRow({ doc, state, files, by, action }) {
  const d = MRQ_DOCS[doc];
  const [lbl, tone] = MRQ_DSTATE[state];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) auto", gap: 16, padding: "16px 20px", borderTop: "1px solid var(--bz-border)", alignItems: "start", background: state === "flagged" ? "oklch(0.985 0.008 28)" : "transparent" }}>
      <MrqDocTile glyph={d.glyph} state={state === "accepted" ? "done" : state === "flagged" ? "error" : "review"} size={40} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 14, fontWeight: 500 }}>{d.name}</span><MrqPill tone={tone} sm>{lbl}</MrqPill></div>
        <div style={{ fontSize: 12, color: "var(--bz-muted)", marginTop: 3 }}>{d.hint}{by && <> · <span style={{ color: "var(--bz-ink-2)" }}>{by}</span></>}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>{files.map(f => <MrqFileTag key={f.name} {...f} />)}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>{action}</div>
    </div>
  );
}

function MrqContactBtns({ mobile }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      <Btn kind="outline" size="sm" icon={I.phone}>Call</Btn>
      <Btn kind="outline" size="sm" icon={<MIc n="chat" s={15} />}>WhatsApp</Btn>
      <Btn kind="outline" size="sm" icon={I.mail}>Email</Btn>
    </div>
  );
}

// ── C2 · Pre-approval file · Salaried · in review ────────────────
function MrqFileSalaried() {
  const open = <Btn kind="ghost" size="sm" icon={I.eye}>Open</Btn>;
  return (
    <CmsShell active="Mortgages" title="Priya Raman" breadcrumbs="Inbox › Mortgage requests › BZM-26-0412"
      secondary={<Btn kind="outline" size="sm" icon={I.send}>Request documents</Btn>}
      primary={<Btn kind="primary" size="sm" icon={I.check} style={{ opacity: .4, cursor: "not-allowed" }}>Accept application</Btn>}>
      <MrqFileHead chips={[["Fast Pre-Approval", "ink"], ["Salaried"], ["UAE Resident / Expat · up to 80% LTV"]]} right={<MrqClock left="17h 42m left" due="Due Wed 23 Sep, 10:14" pct={26} w={300} />} />
      <MrqStages stages={["New", "In review", "With banks", "Pre-approved"]} at={1} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="bz-card">
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Salaried document set</div>
                <div style={{ fontSize: 12, color: "var(--bz-muted)", marginTop: 2 }}>Uploaded with the application · Tue 22 Sep, 10:14</div>
              </div>
              <MrqDocBar states={["accepted", "accepted", "review", "review"]} label="2 of 4 accepted" />
            </div>
            <MrqReviewRow doc="eid" state="accepted" by="Accepted by Yasmin · 10:35" files={[{ name: "emirates-id-front.jpg", meta: "1.4 MB", kind: "id" }, { name: "emirates-id-back.jpg", meta: "1.3 MB", kind: "id" }]} action={open} />
            <MrqReviewRow doc="passport" state="accepted" by="Accepted by Yasmin · 10:38" files={[{ name: "passport.pdf", meta: "1 page · 2.2 MB" }]} action={open} />
            <MrqReviewRow doc="salary" state="review" files={[{ name: "salary-certificate.pdf", meta: "1 page · 412 KB" }]} action={<Btn kind="primary" size="sm">Review</Btn>} />
            <MrqReviewRow doc="stm3" state="review" files={[{ name: "statement-jun-2026.pdf", meta: "2 pages · 1.5 MB" }, { name: "statement-jul-2026.pdf", meta: "2 pages · 1.6 MB" }, { name: "statement-aug-2026.pdf", meta: "3 pages · 1.7 MB" }]} action={<Btn kind="outline" size="sm">Review</Btn>} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderTop: "1px solid var(--bz-border)", background: "var(--bz-surface-2)", fontSize: 12, color: "var(--bz-muted)" }}><MIc n="lock" s={14} />Visible to the mortgage team only. Every open and download is recorded in the activity log.</div>
          </div>
          <MrqCard title="Applicant" aside={<a style={{ fontSize: 12, color: "var(--bz-accent)" }}>Edit</a>}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "16px 20px" }}>
              {[["Full name", "Priya Raman"], ["Date of birth", "14 Mar 1990 · 36"], ["Residency status", "UAE Resident / Expat"], ["Employment type", "Salaried"], ["Mobile", "+971 50 218 4417"], ["Email", "priya.raman@gmail.com"], ["Submitted", "Tue 22 Sep, 10:14"], ["Started from", "Mortgage calculator"]].map(([l, v]) => (
                <div key={l} style={{ minWidth: 0 }}><div style={{ fontSize: 11.5, color: "var(--bz-muted)" }}>{l}</div><div style={{ fontSize: 13, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</div></div>
              ))}
            </div>
          </MrqCard>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <MrqCard title="Owner" aside={<a style={{ fontSize: 12, color: "var(--bz-accent)" }}>Reassign</a>}>
            <MrqOwner who="YA" size={34} named />
            <div style={{ marginTop: 14 }}><MrqContactBtns /></div>
          </MrqCard>
          <MrqCard title="Consent">
            <div style={{ display: "flex", gap: 10 }}>
              <MrqCheck on size={18} tone="oklch(0.55 0.12 145)" />
              <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 500 }}>Share documents with partner banks</div>
                <div style={{ color: "var(--bz-muted)", marginTop: 2 }}>Given Tue 22 Sep, 10:14 · 94.203.•.• · Chrome, macOS</div>
                <div style={{ marginTop: 8 }}><MrqPill tone="warn" sm>Wording v0.1 · pending compliance</MrqPill></div>
              </div>
            </div>
          </MrqCard>
          <MrqCard title="Activity" aside={<a style={{ fontSize: 12, color: "var(--bz-accent)" }}>View all 9</a>}>
            <MrqActivity items={[
              ["16:21", "Yasmin opened Salary certificate"],
              ["10:38", "Yasmin accepted Passport copy", null, "success"],
              ["10:35", "Yasmin accepted Emirates ID", null, "success"],
              ["10:31", "Assigned to Yasmin", "Round-robin · mortgage team"],
              ["10:14", "Submitted from the website", "Confirmation shown · email sent", "accent"],
            ]} />
          </MrqCard>
        </div>
      </div>
    </CmsShell>
  );
}

// ── C6 · Consultancy request ─────────────────────────────────────
function MrqConsultRequest() {
  const seg = (items, on) => (
    <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 8, background: "var(--bz-surface-2)" }}>
      {items.map(([t, ic], i) => <span key={t} style={{ flex: 1, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 6, fontSize: 12.5, fontWeight: i === on ? 500 : 400, background: i === on ? "var(--bz-surface)" : "transparent", boxShadow: i === on ? "0 1px 2px rgba(0,0,0,.08)" : "none", color: i === on ? "var(--bz-ink)" : "var(--bz-ink-2)" }}>{ic}{t}</span>)}
    </div>
  );
  const chip = (t, state) => (
    <span key={t} style={{ height: 36, padding: "0 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, fontSize: 12.5, fontWeight: state === "on" ? 500 : 400, background: state === "on" ? "var(--bz-ink)" : "var(--bz-surface)", color: state === "on" ? "var(--bz-bg)" : state === "off" ? "var(--bz-muted-2)" : "var(--bz-ink)", border: state === "on" ? "1px solid transparent" : "1px solid var(--bz-border)", textDecoration: state === "off" ? "line-through" : "none" }}>{t}</span>
  );
  const lbl = t => <div style={{ fontSize: 12, fontWeight: 500, color: "var(--bz-ink-2)", marginBottom: 8 }}>{t}</div>;
  return (
    <CmsShell active="Mortgages" title="Ahmed Al Suwaidi" breadcrumbs="Inbox › Mortgage requests › BZM-26-0415"
      secondary={<Btn kind="outline" size="sm" icon={I.send}>Send pre-approval link</Btn>}
      primary={<Btn kind="primary" size="sm" icon={I.calendar}>Book consultation</Btn>}>
      <MrqFileHead chips={[["Mortgage Consultancy", "accent"], ["UAE National · up to 85% LTV"], ["Salaried"]]} right={<span style={{ fontSize: 12.5, color: "var(--bz-ink-2)" }}>Received today 09:47 · first contact 10:52</span>} />
      <MrqStages stages={["New", "Contacted", "Consultation booked", "Completed"]} at={1} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <MrqCard title="Contact log" aside={<span style={{ fontSize: 12, color: "var(--bz-muted)" }}>Owner · Rashid Khan</span>}>
            <MrqActivity items={[
              ["11:20", <><b style={{ fontWeight: 500 }}>Ahmed replied on WhatsApp</b></>, "“Thanks Rashid. Tomorrow morning works, any time before 12.”", "accent"],
              ["10:54", "Rashid sent a WhatsApp", "“Hi Ahmed, this is Rashid from Bazar Mortgages. Thanks for your consultation request. When suits you for a 20-minute call?”"],
              ["10:52", "Rashid called · no answer", "+971 50 774 1290 · 0:32"],
              ["09:47", "Request received from the website", "Mortgage Consultancy · no documents", "accent"],
            ]} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--bz-border)" }}>
              <span style={{ fontSize: 12, color: "var(--bz-muted)", marginRight: 4 }}>Log an attempt</span>
              {["Reached", "No answer", "Left a message"].map(t => <Btn key={t} kind="outline" size="sm">{t}</Btn>)}
              <div style={{ flex: 1 }} />
              <Btn kind="ghost" size="sm" icon={I.phone}>Call</Btn>
              <Btn kind="ghost" size="sm" icon={<MIc n="chat" s={15} />}>WhatsApp</Btn>
            </div>
          </MrqCard>
          <MrqCard title="Book the consultation">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>{lbl("Adviser")}<select className="bz-field" defaultValue="Rashid Khan"><option>Rashid Khan</option><option>Leena Varghese</option><option>Yasmin Abdalla</option></select></div>
              <div>{lbl("Format")}{seg([["Phone", <span key="i" style={{ display: "flex" }}>{I.phone}</span>], ["Video", <MIc key="v" n="video" s={15} />], ["Office", <MIc key="o" n="office" s={15} />]], 0)}</div>
            </div>
            <div style={{ marginTop: 18 }}>{lbl("Day")}<div style={{ display: "flex", gap: 6 }}>{[["Wed 23 Sep", "on"], ["Thu 24 Sep"], ["Fri 25 Sep"], ["Mon 28 Sep"]].map(([t, s]) => chip(t, s))}</div></div>
            <div style={{ marginTop: 16 }}>{lbl("Time · Rashid's free slots before 12:00, as Ahmed asked")}<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["09:00"], ["09:30"], ["10:00", "on"], ["10:30", "off"], ["11:00"], ["11:30", "off"]].map(([t, s]) => chip(t, s))}</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--bz-border)" }}>
              <MrqCheck on size={18} />
              <span style={{ fontSize: 12.5, flex: 1 }}>Send the invite to Ahmed by email and WhatsApp</span>
              <Btn kind="primary" size="sm" icon={I.calendar}>Book Wed 23 Sep, 10:00</Btn>
            </div>
          </MrqCard>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <MrqCard title="Applicant">
            <MrqKV rows={[["Full name", "Ahmed Al Suwaidi"], ["Date of birth", "02 Nov 1986 · 39"], ["Residency", "UAE National"], ["Employment", "Salaried"], ["Mobile", "+971 50 774 1290"], ["Email", "ahmed.suwaidi@outlook.com"], ["Started from", "Mortgage calculator · Talk to advisor"]]} />
          </MrqCard>
          <MrqCard title="Documents">
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--bz-ink-2)" }}>Not required. Consultancy is guidance only, so this request carries personal details and nothing else.</div>
          </MrqCard>
          <div style={{ padding: 20, borderRadius: 10, background: "var(--bz-accent-soft)" }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>Ready to apply?</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--bz-ink-2)", marginTop: 6 }}>Send Ahmed a secure Fast Pre-Approval link. His details carry over and he'll only see the Salaried document set.</div>
            <Btn kind="primary" size="sm" icon={I.send} style={{ marginTop: 14 }}>Send pre-approval link</Btn>
          </div>
        </div>
      </div>
    </CmsShell>
  );
}

Object.assign(window, { MRQ_QUEUE, MrqQueueRow, MrqQueue, MrqReviewRow, MrqContactBtns, MrqFileSalaried, MrqConsultRequest });
