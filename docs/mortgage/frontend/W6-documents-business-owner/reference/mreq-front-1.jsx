/* eslint-disable */
// Mortgage requests · website W1–W4 — choose service, personal details, consultancy submit + received.

function MrqServiceCard({ on, title, desc, chip, chipTone, badge, needs }) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: 318, padding: 28, borderRadius: 16, background: "var(--bz-surface)", border: `1px solid ${on ? "var(--bz-ink)" : "var(--bz-border)"}`, boxShadow: on ? "0 0 0 1px var(--bz-ink), 0 14px 36px rgba(0,0,0,.07)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 26 }}>
        <MrqRadio on={on} size={22} />
        {badge && <MrqPill tone="ink" style={{ gap: 6 }}><MIc n="clock" s={13} />{badge}</MrqPill>}
      </div>
      <div className="serif" style={{ fontSize: 36, lineHeight: 1.04, letterSpacing: "-0.02em", marginTop: 30 }}>{title}</div>
      <div style={{ fontSize: 15, lineHeight: 1.55, color: "var(--bz-ink-2)", marginTop: 10 }}>{desc}</div>
      <div style={{ marginTop: 18 }}><MrqPill tone={chipTone}>{chip}</MrqPill></div>
      <div style={{ marginTop: "auto", paddingTop: 22 }}>
        <div style={{ paddingTop: 18, borderTop: "1px solid var(--bz-border)" }}>
          <div className="eyebrow" style={{ fontSize: 10.5 }}>What we'll ask for</div>
          <div style={{ fontSize: 13.5, color: "var(--bz-ink-2)", marginTop: 6, lineHeight: 1.5 }}>{needs}</div>
        </div>
      </div>
    </div>
  );
}

function MrqTile({ title, sub, on }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderRadius: 12, background: "var(--bz-surface)", border: `1px solid ${on ? "var(--bz-ink)" : "var(--bz-border)"}`, boxShadow: on ? "0 0 0 0.5px var(--bz-ink)" : "none" }}>
      <MrqRadio on={on} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--bz-muted)", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function MrqInput({ label, value, placeholder, prefix, hint }) {
  const field = <input className="bz-field" defaultValue={value} placeholder={placeholder} style={{ height: 50, fontSize: 15, padding: "0 16px", borderRadius: prefix ? "0 10px 10px 0" : 10, flex: 1, minWidth: 0 }} />;
  return (
    <div>
      <label className="bz-label" style={{ fontSize: 13, color: "var(--bz-ink)", marginBottom: 8 }}>{label}</label>
      {prefix ? (
        <div style={{ display: "flex" }}>
          <span style={{ height: 50, padding: "0 16px", display: "flex", alignItems: "center", fontSize: 15, fontWeight: 500, background: "var(--bz-surface-2)", border: "1px solid var(--bz-border)", borderRight: 0, borderRadius: "10px 0 0 10px" }}>{prefix}</span>
          {field}
        </div>
      ) : field}
      {hint && <div className="bz-hint" style={{ fontSize: 12 }}>{hint}</div>}
    </div>
  );
}

function MrqGroupLabel({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{children}</div>;
}

// ── W1 · Choose service ──────────────────────────────────────────
function MrqChooseService() {
  const opt = (t, d) => (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t}</div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--bz-ink-2)", marginTop: 4, textWrap: "pretty" }}>{d}</div>
    </div>
  );
  return (
    <MrqFlow step={0} last="Documents" rail={<>
      <MrqRailCard title="Which one is right for you?">
        {opt("Mortgage Consultancy", "For when you're still exploring: how much you could borrow, how UAE mortgages work and which route suits you.")}
        <div style={{ height: 1, background: "var(--bz-border)", margin: "16px 0" }} />
        {opt("Fast Pre-Approval", "For when you're ready to make an offer. A pre-approval shows sellers and developers that your finance is lined up.")}
      </MrqRailCard>
      <MrqRailCard soft pad={20}>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ color: "var(--bz-accent)", marginTop: 1 }}><MIc n="switch" /></span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>You can switch later</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--bz-ink-2)", marginTop: 4 }}>Start with a consultation and your adviser can send you a Fast Pre-Approval link when you're ready. Your details carry over.</div>
          </div>
        </div>
      </MrqRailCard>
      <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--bz-muted)", padding: "0 4px" }}>Prefer to talk it through? Call <span style={{ color: "var(--bz-ink)" }}>+971 2 632 2223</span> or WhatsApp <span style={{ color: "var(--bz-ink)" }}>+971 50 691 1103</span>.</div>
    </>}>
      <MrqHead eyebrow="Step 1 · Choose your service" title="How can we assist you?" lede="Pick a service to begin. We only ask for what that service actually needs." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 40 }}>
        <MrqServiceCard title="Mortgage Consultancy" desc="Personalised mortgage guidance from our team." chip="No documents required" chipTone="success" needs="Your personal details only." />
        <MrqServiceCard on title="Fast Pre-Approval" desc="Get your mortgage pre-approval within 24 hours." chip="Supporting documents required" chipTone="accent" badge="Within 24 hours" needs="Your personal details, then four documents matched to your employment type." />
      </div>
      <MrqActions back={false} note="Next: your details" cta="Continue" arrow />
    </MrqFlow>
  );
}

// ── W2 · Your details ────────────────────────────────────────────
function MrqWhyWeAsk() {
  const why = (t, d) => (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t}</div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--bz-ink-2)", marginTop: 4 }}>{d}</div>
    </div>
  );
  return (
    <MrqRailCard title="Why we ask">
      {why("Residency status", "Sets your maximum loan-to-value and which partner banks can lend to you.")}
      <div style={{ height: 1, background: "var(--bz-border)", margin: "16px 0" }} />
      {why("Employment type", "Determines the exact documents a bank needs to pre-approve you — nothing irrelevant is requested.")}
      <div style={{ display: "flex", gap: 12, marginTop: 20, padding: 16, borderRadius: 10, background: "var(--bz-surface-2)" }}>
        <span style={{ color: "var(--bz-accent)", marginTop: 1 }}><MIc n="lock" /></span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Nothing is shared yet</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--bz-ink-2)", marginTop: 4 }}>Your answers stay in your browser until you submit. No bank and no credit bureau is contacted at this stage.</div>
        </div>
      </div>
    </MrqRailCard>
  );
}

function MrqDetails() {
  return (
    <MrqFlow step={1} last="Documents" rail={<MrqWhyWeAsk />}>
      <MrqSelections items={[["Service: Fast Pre-Approval", true]]} action="Change" />
      <MrqHead eyebrow="Step 2 · Your details" title="Personal details" lede="Required for both Mortgage Consultancy and Fast Pre-Approval." />
      <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 28 }}>
        <div>
          <MrqGroupLabel>Residency status</MrqGroupLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <MrqTile title="UAE National" sub="Up to 85% LTV" />
            <MrqTile on title="UAE Resident / Expat" sub="Up to 80% LTV" />
          </div>
        </div>
        <div>
          <MrqGroupLabel>Employment type</MrqGroupLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <MrqTile on title="Salaried" sub="Employed, fixed salary" />
            <MrqTile title="Business Owner" sub="Trade licence holder" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, fontSize: 13, lineHeight: 1.5, color: "var(--bz-ink-2)" }}>
            <span style={{ color: "var(--bz-accent)", marginTop: 1 }}>{I.doc}</span>
            <span>Your <b style={{ fontWeight: 600, color: "var(--bz-ink)" }}>Employment Type</b> decides which documents you'll be asked for next — Salaried and Business Owner see different lists.</span>
          </div>
        </div>
        <div style={{ height: 1, background: "var(--bz-border)" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 16px" }}>
          <MrqInput label="Full name" value="Priya Raman" placeholder="As on your Emirates ID" hint="As on your Emirates ID" />
          <MrqInput label="Date of birth" value="14 / 03 / 1990" placeholder="DD / MM / YYYY" />
          <MrqInput label="Mobile number" prefix="+971" value="50 218 4417" placeholder="50 000 0000" />
          <MrqInput label="Email address" value="priya.raman@gmail.com" placeholder="you@email.com" />
        </div>
      </div>
      <MrqActions cta="Continue to documents" arrow />
    </MrqFlow>
  );
}

// ── W3 · Consultancy — review & request ──────────────────────────
function MrqDetailsReview({ rows }) {
  return (
    <div style={{ marginTop: 16, background: "var(--bz-surface)", border: "1px solid var(--bz-border)", borderRadius: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid var(--bz-border)" }}>
        <span style={{ fontSize: 13.5, fontWeight: 500 }}>Your details</span>
        <a style={{ fontSize: 12.5, fontWeight: 500, color: "var(--bz-accent)" }}>Edit</a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 32, rowGap: 16, padding: "18px 22px 20px" }}>
        {rows.map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 12, color: "var(--bz-muted)" }}>{l}</div>
            <div style={{ fontSize: 14.5, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MRQ_AHMED = [["Full name", "Ahmed Al Suwaidi"], ["Date of birth", "02 / 11 / 1986"], ["Mobile number", "+971 50 774 1290"], ["Email address", "ahmed.suwaidi@outlook.com"]];

function MrqConsultSubmit() {
  return (
    <MrqFlow step={2} last="Submit" rail={
      <MrqRailCard title="What happens next">
        <MrqNext items={[["We receive your request", " straight away."], ["An adviser reviews", " your profile and residency."], ["We contact you", " to arrange your consultation."]]} />
      </MrqRailCard>
    }>
      <MrqSelections items={[["Service: Mortgage Consultancy", true], ["UAE National"], ["Salaried"]]} />
      <MrqHead eyebrow="Step 3 · Mortgage Consultancy" title="You're all set — no documents needed" lede="Because you chose Mortgage Consultancy, the form ends at your personal details. Our team will reach out to guide you personally." />
      <div style={{ marginTop: 36, display: "flex", gap: 18, alignItems: "flex-start", padding: 22, borderRadius: 14, background: "var(--bz-surface)", border: "1px solid var(--bz-border)" }}>
        <span style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: "oklch(0.94 0.04 145)", color: "oklch(0.4 0.09 145)" }}><MrqTick s={20} sw={2.2} /></span>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 500 }}>No supporting documents required</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--bz-ink-2)", marginTop: 4 }}>Consultancy is guidance only — there's nothing to upload. Submit your details and a mortgage adviser will contact you.</div>
        </div>
      </div>
      <MrqDetailsReview rows={MRQ_AHMED} />
      <MrqActions cta="Request a Consultation" fine={<>By submitting, you agree to be contacted by Bazar's mortgage team about this request. <a style={{ color: "var(--bz-ink-2)", textDecoration: "underline" }}>Privacy Policy</a></>} />
    </MrqFlow>
  );
}

// ── W4 · Consultancy — request received ──────────────────────────
function MrqDone({ eyebrow, title, body }) {
  return (
    <>
      <span style={{ width: 56, height: 56, borderRadius: 999, display: "grid", placeItems: "center", background: "var(--bz-accent-soft)", color: "var(--bz-accent)" }}><MrqTick s={24} sw={2.2} /></span>
      <div className="eyebrow" style={{ marginTop: 28 }}>{eyebrow}</div>
      <h1 className="serif" style={{ fontSize: 60, lineHeight: 1.0, letterSpacing: "-0.025em", margin: "12px 0 0" }}>{title}</h1>
      <p style={{ margin: "16px 0 0", fontSize: 18, lineHeight: 1.55, color: "var(--bz-ink-2)", maxWidth: 620, textWrap: "pretty" }}>{body}</p>
    </>
  );
}

function MrqConsultDone() {
  return (
    <MrqFlow step={3} last="Submit" rail={
      <MrqRailCard title="Your request">
        <MrqKV size={13} rows={[["Reference", <span className="mono">BZM-26-0415</span>], ["Service", "Mortgage Consultancy"], ["Residency", "UAE National"], ["Employment", "Salaried"], ["Received", "Tue 22 Sep, 09:47"]]} />
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--bz-border)" }}>
          <div style={{ fontSize: 12, color: "var(--bz-muted)" }}>We'll contact you on</div>
          <div style={{ fontSize: 13.5, marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>{I.phone} +971 50 774 1290</div>
          <div style={{ fontSize: 13.5, marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>{I.mail} ahmed.suwaidi@outlook.com</div>
        </div>
      </MrqRailCard>
    }>
      <MrqDone eyebrow="Request received" title="Thank you for your interest." body="A member of our mortgage team will contact you shortly." />
      <div style={{ marginTop: 40 }}>
        <MrqTrack done={1} items={[["We receive your request", " straight away.", "Received 09:47"], ["An adviser reviews", " your profile and residency."], ["We contact you", " to arrange your consultation."]]} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 32 }}>
        <Btn kind="outline" size="lg">Back to Bazar</Btn>
        <Btn kind="ghost" size="lg" icon={I.chart}>Estimate your monthly payment</Btn>
      </div>
    </MrqFlow>
  );
}

Object.assign(window, { MrqServiceCard, MrqTile, MrqInput, MrqGroupLabel, MrqChooseService, MrqWhyWeAsk, MrqDetails, MrqDetailsReview, MrqConsultSubmit, MrqDone, MrqConsultDone });
