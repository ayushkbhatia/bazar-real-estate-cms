/* eslint-disable */
// Mortgage requests · website W5–W8 — the two document sets, submission, and the re-upload link.

function MrqUploadRow({ doc, state = "empty", files, error, total, note }) {
  const d = MRQ_DOCS[doc];
  const act = state === "empty"
    ? <><span style={{ fontSize: 12, color: "var(--bz-muted)" }}>Drop {d.multi ? "files" : "a file"} here or</span><Btn kind="outline" icon={I.upload}>{d.multi ? "Upload documents" : "Upload document"}</Btn></>
    : state === "error" ? <Btn kind="outline" icon={I.upload}>Choose another file</Btn>
    : state === "busy" ? <Btn kind="ghost" size="sm">Cancel</Btn>
    : d.multi ? <Btn kind="outline" size="sm" icon={I.plus}>Add more files</Btn>
    : <Btn kind="ghost" size="sm" icon={I.refresh}>Replace</Btn>;
  return (
    <div style={{ padding: "18px 20px", borderRadius: 14, background: state === "error" ? "oklch(0.985 0.01 28)" : "var(--bz-surface)", border: state === "empty" ? "1.5px dashed var(--bz-border-strong)" : state === "error" ? "1px solid oklch(0.86 0.07 28)" : "1px solid var(--bz-border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <MrqDocTile glyph={d.glyph} state={state} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15.5, fontWeight: 500 }}>{d.name}</span>
            {state === "done" && <MrqPill tone="success" sm>{d.multi ? `${files.length} files added` : "Added"}</MrqPill>}
            {state === "busy" && <MrqPill tone="accent" sm>Uploading</MrqPill>}
            {state === "error" && <MrqPill tone="danger" sm>Needs attention</MrqPill>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--bz-muted)", marginTop: 3 }}>{d.hint}</div>
          {note && <div style={{ fontSize: 12.5, color: "var(--bz-ink-2)", marginTop: 2 }}>{note}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>{act}</div>
      </div>
      {files && files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16, marginLeft: 60, paddingTop: 14, borderTop: "1px solid var(--bz-border)" }}>
          {files.map(f => <MrqFile key={f.name} {...f} />)}
          {error && <div style={{ display: "flex", gap: 8, fontSize: 12.5, lineHeight: 1.5, color: "oklch(0.45 0.13 28)" }}><MIc n="alert" s={15} style={{ marginTop: 2 }} />{error}</div>}
          {total && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
              <div style={{ flex: 1, maxWidth: 320, height: 4, borderRadius: 99, background: "var(--bz-surface-3)", overflow: "hidden" }}><div style={{ width: `${(total[0] / total[1]) * 100}%`, height: "100%", borderRadius: 99, background: "var(--bz-ink-2)" }} /></div>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--bz-muted)", whiteSpace: "nowrap" }}>{total[0]} of {total[1]} MB used</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MrqConsent({ on }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginTop: 20, padding: "18px 20px", borderRadius: 14, border: "1px solid var(--bz-border)", background: on ? "var(--bz-surface)" : "transparent" }}>
      <MrqCheck on={on} size={20} />
      <span style={{ fontSize: 13.5, lineHeight: 1.6 }}>I authorise Bazar Real Estate to share these documents with its partner banks for the sole purpose of obtaining my mortgage pre-approval. <span style={{ color: "var(--bz-muted)" }}>(Consent wording to be confirmed by compliance.)</span></span>
    </div>
  );
}

function MrqPreNextRail() {
  return (
    <>
      <MrqRailCard title="What happens next">
        <MrqNext items={[["We review your file", " — usually the same working day."], ["We price it", " against our partner banks."], ["We contact you within 24 hours", " with your pre-approval."]]} />
      </MrqRailCard>
      <MrqRailCard soft pad={20}>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ color: "var(--bz-accent)", marginTop: 1 }}><MIc n="shield" /></span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Your documents are protected</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--bz-ink-2)", marginTop: 4 }}>Encrypted in transit and at rest. Only Bazar's mortgage team can open them, and every view is recorded.</div>
          </div>
        </div>
      </MrqRailCard>
    </>
  );
}

const MRQ_DOC_LEDE = "These documents are tailored to your employment type — you only see what a bank actually needs from you. Accepted formats: PDF, JPG, JPEG, PNG.";

// ── W5 · Salaried set, nothing added yet ─────────────────────────
function MrqDocsSalaried() {
  return (
    <MrqFlow step={2} last="Documents" rail={<MrqPreNextRail />}>
      <MrqSelections items={[["Service: Fast Pre-Approval", true], ["Salaried"], ["UAE Resident / Expat"]]} />
      <MrqHead eyebrow="Step 3 · Documents" title="Upload your salaried documents" lede={MRQ_DOC_LEDE} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 36 }}>
        {MRQ_SETS.salaried.map(k => <MrqUploadRow key={k} doc={k} note={k === "stm3" ? "Jun, Jul and Aug 2026" : null} />)}
      </div>
      <MrqConsent />
      <MrqActions note="0 of 4 documents added" cta="Get Fast Pre-Approval" disabled />
    </MrqFlow>
  );
}

// ── W6 · Business Owner set, mid-upload ──────────────────────────
function MrqDocsBusiness() {
  return (
    <MrqFlow step={2} last="Documents" rail={<MrqPreNextRail />}>
      <MrqSelections items={[["Service: Fast Pre-Approval", true], ["Business Owner"], ["UAE Resident / Expat"]]} />
      <MrqHead eyebrow="Step 3 · Documents" title="Upload your business documents" lede={MRQ_DOC_LEDE} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 36 }}>
        <MrqUploadRow doc="eid" state="done" files={[{ name: "emirates-id-front.jpg", meta: "1.8 MB", kind: "id" }, { name: "emirates-id-back.jpg", meta: "1.6 MB", kind: "id" }]} />
        <MrqUploadRow doc="passport" state="busy" files={[{ name: "passport-photo-page.pdf", meta: "2.0 of 3.1 MB", pct: 64 }]} />
        <MrqUploadRow doc="licence" state="error" files={[{ name: "trade-license-scan.pdf", meta: "14.8 MB", err: true }]} error="This file is 14.8 MB and the limit is 10 MB. Save it at a lower resolution, or upload a photo of the licence instead." />
        <MrqUploadRow doc="stm12" state="done" note="Sep 2025 to Aug 2026" total={[18.4, 40]} files={[{ name: "statement-sep-nov-2025.pdf", meta: "6.4 MB" }, { name: "statement-dec-feb-2026.pdf", meta: "5.9 MB" }, { name: "statement-mar-may-2026.pdf", meta: "6.1 MB" }]} />
      </div>
      <MrqConsent on />
      <MrqActions note={<><span style={{ color: "var(--bz-ink)" }}>2 of 4 ready</span> · 1 file needs attention</>} cta="Get Fast Pre-Approval" disabled />
    </MrqFlow>
  );
}

// ── W7 · Pre-approval submitted ──────────────────────────────────
function MrqPreDone() {
  const sent = [["eid", "2 files"], ["passport", "1 file"], ["salary", "1 file"], ["stm3", "3 files"]];
  return (
    <MrqFlow step={3} last="Documents" rail={
      <MrqRailCard title="Your application">
        <MrqKV size={13} rows={[["Reference", <span className="mono">BZM-26-0412</span>], ["Service", "Fast Pre-Approval"], ["Residency", "UAE Resident / Expat"], ["Employment", "Salaried"]]} />
        <div style={{ fontSize: 12, color: "var(--bz-muted)", margin: "18px 0 10px", paddingTop: 16, borderTop: "1px solid var(--bz-border)" }}>Documents received</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sent.map(([k, n]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <MrqDocTile glyph={MRQ_DOCS[k].glyph} state="done" size={32} />
              <span style={{ flex: 1, fontSize: 13, lineHeight: 1.35 }}>{MRQ_DOCS[k].name}</span>
              <span style={{ fontSize: 11.5, color: "var(--bz-muted)", whiteSpace: "nowrap" }}>{n}</span>
            </div>
          ))}
        </div>
      </MrqRailCard>
    }>
      <MrqDone eyebrow="Application received" title="Thank you." body="Your details and documents have been submitted successfully. Our mortgage team will review your application and contact you regarding your pre-approval." />
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 36, padding: "20px 24px", borderRadius: 14, background: "var(--bz-ink)", color: "var(--bz-bg)" }}>
        <MIc n="clock" s={28} sw={1.4} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, opacity: .7 }}>We'll contact you by</div>
          <div className="serif" style={{ fontSize: 30, lineHeight: 1.1, marginTop: 2 }}>Wed 23 Sep, 10:14</div>
        </div>
        <div style={{ fontSize: 12.5, opacity: .75, maxWidth: 260, lineHeight: 1.5, textAlign: "right" }}>24 hours from when you submitted. Most files are reviewed the same working day.</div>
      </div>
      <div style={{ marginTop: 16 }}>
        <MrqTrack done={1} items={[["Submitted", "", "Tue 22 Sep, 10:14"], ["We review your file", " — usually the same working day."], ["We price it", " against our partner banks."], ["We contact you within 24 hours", " with your pre-approval."]]} />
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 16, padding: "16px 20px", borderRadius: 14, background: "var(--bz-surface-2)", fontSize: 13.5, lineHeight: 1.55, color: "var(--bz-ink-2)" }}>
        <span style={{ color: "var(--bz-accent)", marginTop: 1 }}><MIc n="chat" /></span>
        <span>If we need anything else, we'll message you on WhatsApp at <span style={{ color: "var(--bz-ink)" }}>+971 50 ••• 4417</span> with a secure link. You won't need to start again.</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 32 }}>
        <Btn kind="outline" size="lg">Back to Bazar</Btn>
        <Btn kind="ghost" size="lg" icon={I.chart}>Estimate your monthly payment</Btn>
      </div>
    </MrqFlow>
  );
}

// ── W8 · Re-upload one document from a secure link ───────────────
function MrqReupload() {
  const d = MRQ_DOCS.stm12;
  return (
    <MrqFlow rail={<>
      <MrqRailCard title="What happens next">
        <MrqNext items={[["Yasmin checks", " the new statements."], ["We price your file", " against our partner banks."], ["We contact you", " with your pre-approval."]]} />
      </MrqRailCard>
      <MrqRailCard soft pad={20}>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ color: "var(--bz-accent)", marginTop: 1 }}><MIc n="chat" /></span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Questions?</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--bz-ink-2)", marginTop: 4 }}>Reply to Yasmin on WhatsApp, or call the mortgage team on +971 2 632 2223.</div>
          </div>
        </div>
      </MrqRailCard>
    </>} top={
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 32, padding: "0 14px", borderRadius: 999, background: "var(--bz-surface)", border: "1px solid var(--bz-border)", fontSize: 12.5, color: "var(--bz-ink-2)" }}>
        <span style={{ color: "oklch(0.5 0.12 145)", display: "flex" }}><MIc n="lock" s={14} /></span>
        Secure link for Karim Haddad · verified with a code sent to +971 55 ••• 2290
      </div>
    }>
      <MrqHead eyebrow="Application BZM-26-0409 · Fast Pre-Approval" title="One document needs another look" lede="Thanks, Karim. Three of your four documents are accepted. Add what's missing below and we'll pick your file straight back up." />
      <div style={{ display: "flex", gap: 14, marginTop: 32, padding: "18px 20px", borderRadius: 14, background: "var(--bz-surface)", border: "1px solid var(--bz-border)" }}>
        <Avatar initials="YA" size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "baseline" }}><b style={{ fontWeight: 600 }}>Yasmin Abdalla</b><span style={{ color: "var(--bz-muted)", fontSize: 12 }}>Mortgage adviser · Tue 22 Sep, 11:52</span></div>
          <div style={{ fontSize: 14.5, lineHeight: 1.55, marginTop: 6 }}>Your statements cover September 2025 to May 2026. For a full year, please add June, July and August 2026.</div>
        </div>
      </div>
      <div style={{ marginTop: 12, padding: "20px 22px", borderRadius: 14, background: "var(--bz-surface)", border: "1px solid oklch(0.86 0.07 28)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <MrqDocTile glyph={d.glyph} state="error" />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 15.5, fontWeight: 500 }}>{d.name}</span><MrqPill tone="danger" sm>3 months missing</MrqPill></div>
            <div style={{ fontSize: 12.5, color: "var(--bz-muted)", marginTop: 3 }}>{d.hint}</div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}><MrqCoverage have={9} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--bz-muted)", marginTop: 8 }}><span>Received · Sep 2025 – May 2026</span><span style={{ color: "oklch(0.48 0.15 28)" }}>Needed · Jun – Aug 2026</span></div>
        <div style={{ marginTop: 18, padding: 18, borderRadius: 12, border: "1.5px dashed var(--bz-border-strong)", background: "var(--bz-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, fontSize: 13.5 }}>Add statements for <b style={{ fontWeight: 600 }}>June, July and August 2026</b></div>
            <span style={{ fontSize: 12, color: "var(--bz-muted)" }}>Drop files here or</span>
            <Btn kind="outline" size="sm" icon={I.upload}>Upload documents</Btn>
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--bz-border)" }}>
            <MrqFile name="statement-jun-aug-2026.pdf" meta="5.7 MB · ready to send" />
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--bz-muted)", marginTop: 12 }}>Already received: statement-sep-nov-2025.pdf, statement-dec-feb-2026.pdf, statement-mar-may-2026.pdf · 18.4 of 40 MB used</div>
      </div>
      <div style={{ marginTop: 12, borderRadius: 14, border: "1px solid var(--bz-border)", background: "var(--bz-surface)" }}>
        {["eid", "passport", "licence"].map((k, i) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderTop: i ? "1px solid var(--bz-border)" : 0 }}>
            <MrqDocTile glyph={MRQ_DOCS[k].glyph} state="done" size={32} />
            <span style={{ flex: 1, fontSize: 13.5 }}>{MRQ_DOCS[k].name}</span>
            <MrqPill tone="success" sm>Accepted</MrqPill>
          </div>
        ))}
      </div>
      <MrqActions back={false} note="Your file is on hold until this arrives." cta="Send documents" />
    </MrqFlow>
  );
}

Object.assign(window, { MrqUploadRow, MrqConsent, MrqPreNextRail, MrqDocsSalaried, MrqDocsBusiness, MrqPreDone, MrqReupload });
