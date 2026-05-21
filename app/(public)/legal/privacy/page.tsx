import type { Metadata } from "next";
import { LegalDocFrame } from "../_layout";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Bazar Real Estate collects, uses, and protects personal data, aligned with UAE PDPL (Federal Decree-Law 45/2021).",
};

export default function PrivacyPage() {
  return (
    <LegalDocFrame active="privacy" title="Privacy policy" effective="22 May 2026">
      <h2>Who we are</h2>
      <p>
        Bazar Real Estate Brokerage LLC (&quot;Bazar&quot;, &quot;we&quot;)
        operates a curated marketplace and bespoke advisory service for
        property in the United Arab Emirates. We are licensed by the Abu Dhabi
        Department of Municipalities and Transport (ORN 28041). Our data
        protection officer can be reached at{" "}
        <a href="mailto:dpo@bazar.ae">dpo@bazar.ae</a>.
      </p>

      <h2>The data we collect</h2>
      <p>We collect personal data when you:</p>
      <ul>
        <li>
          Create an account (name, email, optional phone, residency status).
        </li>
        <li>
          Submit an enquiry on a listing, the contact page, or the AI concierge
          (name, contact details, message body, the property you asked about).
        </li>
        <li>
          Save properties, save searches, or schedule viewings (browser
          identifier and the saved item ids).
        </li>
        <li>
          Upload identity and proof-of-funds documents for KYC at the offer
          stage. KYC documents are encrypted at rest and retained for seven
          years per AML/CFT requirements.
        </li>
        <li>
          Subscribe to the Bazar Brief (email, signup source, confirmation
          status). Double-opt-in is enforced; you can unsubscribe in one click
          from any email footer.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>
          <b>Contract performance</b> — we use the data you submit to deliver
          the service you asked for (responding to enquiries, scheduling
          viewings, sending transactional emails).
        </li>
        <li>
          <b>Legitimate interest</b> — we use anonymised usage data to improve
          search quality and listing relevance.
        </li>
        <li>
          <b>Legal obligation</b> — we retain KYC documents and transaction
          metadata to satisfy UAE AML/CFT rules.
        </li>
        <li>
          <b>Consent</b> — we send the Bazar Brief and use analytics cookies
          only after you opt in.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We share data with vendors who help us run the service: Supabase
        (database and authentication, Frankfurt), Resend (transactional email,
        Frankfurt), Vercel (hosting, multi-region), Meta WhatsApp Business
        Cloud (only for users who initiate a WhatsApp conversation), Anthropic
        (AI concierge — message bodies are sent to Claude). We never sell
        personal data.
      </p>

      <h2>Cross-border transfers</h2>
      <p>
        Most processing happens in the European Economic Area (Frankfurt). UAE
        PDPL permits transfers to jurisdictions with adequate protection. For
        transfers to other jurisdictions (notably US-based vendors used for
        observability), we rely on standard contractual clauses.
      </p>

      <h2>Your rights under UAE PDPL</h2>
      <p>You can:</p>
      <ul>
        <li>
          <b>Access</b> the personal data we hold about you — use{" "}
          <code>/account/data-export</code>.
        </li>
        <li>
          <b>Rectify</b> inaccurate data — edit your profile or write to{" "}
          <a href="mailto:dpo@bazar.ae">dpo@bazar.ae</a>.
        </li>
        <li>
          <b>Delete</b> your account — use <code>/account/data-deletion</code>.
          KYC records linked to closed transactions are retained for seven
          years and anonymised after deletion.
        </li>
        <li>
          <b>Object</b> to processing for direct marketing — unsubscribe from
          the Bazar Brief, or contact{" "}
          <a href="mailto:dpo@bazar.ae">dpo@bazar.ae</a>.
        </li>
        <li>
          <b>Withdraw consent</b> at any time — for cookies, change your
          preference in the banner; for the newsletter, click unsubscribe.
        </li>
      </ul>
      <p>
        We respond to requests within 30 days. If we cannot honour a request
        (for example because of a legal-retention obligation) we will explain
        why.
      </p>

      <h2>Retention</h2>
      <p>
        Account data is retained while your account is active. KYC records are
        retained for seven years from the end of the relationship per UAE
        AML/CFT rules. Audit logs are retained for seven years and cannot be
        purged by anyone. Marketing analytics are retained for thirteen months.
      </p>

      <h2>Security</h2>
      <p>
        We encrypt data in transit (TLS 1.2+) and at rest (AES-256). Staff
        access to the CMS requires multi-factor authentication. Production
        secrets live in Doppler. We test the disaster-recovery runbook
        quarterly.
      </p>

      <h2>Changes</h2>
      <p>
        We will notify you of material changes by email and surface a banner on
        sign-in. The effective date at the top of this page reflects the
        latest revision.
      </p>
    </LegalDocFrame>
  );
}
