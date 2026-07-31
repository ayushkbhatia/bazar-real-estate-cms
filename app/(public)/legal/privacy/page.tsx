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
      <h2>1. Introduction</h2>
      <p>
        Bazar Real Estate Brokerage LLC (&quot;Bazar&quot;, &quot;we&quot;,
        &quot;us&quot;) operates bazar.ae: a curated property marketplace and
        advisory service across the United Arab Emirates. We are licensed by
        the Abu Dhabi Department of Municipalities and Transport (ORN 28041).
      </p>
      <p>
        This policy explains what personal data we collect, why, how long we
        keep it, who we share it with, and the rights you have over it. It
        applies to everyone who browses bazar.ae, creates an account,
        contacts us, or transacts with us — buyers, tenants, landlords,
        sellers, and site visitors alike.
      </p>
      <p>
        Our Data Protection Officer can be reached at{" "}
        <a href="mailto:dpo@bazarrealestate.ae">dpo@bazarrealestate.ae</a> for
        any question about this policy or your data.
      </p>

      <h2>2. Scope</h2>
      <p>
        This policy covers bazar.ae and the Bazar CMS. It does not cover
        third-party sites we link to (developer microsites, portal
        syndication targets, payment processors) — those are governed by
        their own policies.
      </p>

      <h2>3. Information We Collect</h2>
      <p>
        <b>Information you give us directly</b>
      </p>
      <ul>
        <li>
          <b>Account details</b> — name, email, phone number, residency
          status.
        </li>
        <li>
          <b>Enquiries</b> — when you contact us about a listing, submit the
          contact form, or message the AI concierge: your name, contact
          details, message body, and the property or development referenced.
        </li>
        <li>
          <b>Saved items</b> — properties and searches you save, and the
          alert frequency you choose (daily / weekly / on-change).
        </li>
        <li>
          <b>Viewing requests and deal documents</b> — once you progress to
          an offer, identity documents and proof-of-funds for KYC, deal
          notes, and any files you upload to a deal room.
        </li>
        <li>
          <b>Valuation and mortgage tool inputs</b> — property address, size,
          condition, and financial assumptions you enter to generate a
          report.
        </li>
        <li>
          <b>Newsletter signup</b> — email address and, if you tell us, your
          areas of interest.
        </li>
      </ul>
      <p>
        <b>Information we collect automatically</b>
      </p>
      <ul>
        <li>
          <b>Usage data</b> — pages viewed, search filters applied, device
          and browser type, approximate location (IP-derived), referrer.
        </li>
        <li>
          <b>Cookies and similar technologies</b> — see Section 6.
        </li>
      </ul>
      <p>
        <b>Information from third parties</b>
      </p>
      <ul>
        <li>
          Portal syndication partners and developers may pass us enquiry data
          they collected on their own channels, where you&apos;ve consented
          to that hand-off.
        </li>
        <li>
          Public UAE property registries (e.g. DLD transaction data) used for
          valuation comparables — this is not personal data about you
          specifically.
        </li>
      </ul>

      <h2>4. How We Use Your Information</h2>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Examples</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Deliver the service you asked for</td>
            <td>
              Responding to enquiries, scheduling viewings, progressing a
              deal, sending the report you requested
            </td>
          </tr>
          <tr>
            <td>Run your account</td>
            <td>Authentication, saved searches, alert emails</td>
          </tr>
          <tr>
            <td>Legal and regulatory compliance</td>
            <td>
              AML/CFT checks and KYC record-keeping, audit logging,
              DLD-related reporting
            </td>
          </tr>
          <tr>
            <td>Improve the product</td>
            <td>
              Aggregated/anonymised analytics on search and listing
              performance
            </td>
          </tr>
          <tr>
            <td>Marketing (only with consent)</td>
            <td>The Bazar Brief newsletter, campaign emails</td>
          </tr>
          <tr>
            <td>Security</td>
            <td>Fraud prevention, abuse detection, access logging</td>
          </tr>
        </tbody>
      </table>
      <p>
        We do not use your data to make any decision with legal or similarly
        significant effect about you without a human in the loop.
      </p>

      <h2>5. Legal Basis for Processing</h2>
      <p>
        Under UAE PDPL, we rely on one or more of the following bases for
        each use above:
      </p>
      <ul>
        <li>
          <b>Performance of a contract</b> — delivering the marketplace and
          advisory service you&apos;ve asked for.
        </li>
        <li>
          <b>Legal obligation</b> — AML/CFT record-keeping, regulatory
          reporting.
        </li>
        <li>
          <b>Legitimate interest</b> — product analytics, fraud prevention,
          service improvement — balanced against your right to privacy, and
          only where you wouldn&apos;t reasonably object.
        </li>
        <li>
          <b>Consent</b> — newsletter emails, non-essential cookies, WhatsApp
          messaging you initiate. You can withdraw consent at any time (see
          Section 9).
        </li>
      </ul>

      <h2>6. Cookies</h2>
      <p>
        We use strictly-necessary cookies (session, security) without
        asking, and analytics/marketing cookies only after you accept them
        in the consent banner. Full detail — including current vendors and
        retention — is in our{" "}
        <a href="/legal/cookies">Cookie Policy</a>, which is part of this
        policy by reference.
      </p>

      <h2>7. Who We Share It With</h2>
      <p>
        We share personal data with the vendors that operate the service. We
        do not sell personal data, and we do not share it with third parties
        for their own marketing purposes.
      </p>
      <table>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Purpose</th>
            <th>Data shared</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase (EU, Frankfurt)</td>
            <td>Database, authentication, file storage</td>
            <td>All account and enquiry data</td>
          </tr>
          <tr>
            <td>Resend (EU, Frankfurt)</td>
            <td>Transactional email</td>
            <td>Email address, message content</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Hosting</td>
            <td>Request logs, IP address</td>
          </tr>
          <tr>
            <td>Meta WhatsApp Business Cloud</td>
            <td>Messaging</td>
            <td>Only for users who message us on WhatsApp first</td>
          </tr>
          <tr>
            <td>Anthropic (Claude)</td>
            <td>AI concierge</td>
            <td>Concierge conversation content</td>
          </tr>
          <tr>
            <td>Meilisearch</td>
            <td>Search</td>
            <td>Publicly listed property attributes only (no personal data)</td>
          </tr>
          <tr>
            <td>Mapbox</td>
            <td>Geocoding, isochrones, maps</td>
            <td>Addresses/coordinates you search</td>
          </tr>
          <tr>
            <td>Mailchimp</td>
            <td>Newsletter campaigns</td>
            <td>Email address, subscription status</td>
          </tr>
          <tr>
            <td>PostHog, Vercel Analytics</td>
            <td>Product analytics</td>
            <td>Only after cookie consent</td>
          </tr>
          <tr>
            <td>Sentry</td>
            <td>Error monitoring</td>
            <td>
              Technical error context; we scrub personal data from error
              payloads where feasible
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        We may also disclose data where required by UAE law, court order, or
        regulator request (e.g. DLD, Central Bank AML reporting), or to a
        successor entity in the event of a merger or acquisition of Bazar,
        subject to equivalent privacy protections.
      </p>

      <h2>8. Cross-Border Transfers</h2>
      <p>
        Most processing happens within the European Economic Area
        (Frankfurt). Where a vendor processes data outside the EEA or UAE
        (for example, US-based observability tooling), we rely on standard
        contractual clauses or the vendor&apos;s equivalent safeguard,
        consistent with UAE PDPL&apos;s cross-border transfer requirements.
      </p>

      <h2>9. Your Rights Under UAE PDPL</h2>
      <p>You have the right to:</p>
      <ul>
        <li>
          <b>Access</b> the personal data we hold about you — write to{" "}
          <a href="mailto:dpo@bazarrealestate.ae">dpo@bazarrealestate.ae</a>{" "}
          and we will verify your identity and send a machine-readable copy.
        </li>
        <li>
          <b>Rectify</b> inaccurate data — write to{" "}
          <a href="mailto:dpo@bazarrealestate.ae">dpo@bazarrealestate.ae</a>.
        </li>
        <li>
          <b>Erase</b> your data — write to{" "}
          <a href="mailto:dpo@bazarrealestate.ae">dpo@bazarrealestate.ae</a>.
          KYC records tied to a closed transaction are retained per Section
          10 and anonymised where deletion isn&apos;t legally permitted.
        </li>
        <li>
          <b>Restrict or object to processing</b>, including direct
          marketing — unsubscribe from the Bazar Brief, or contact us.
        </li>
        <li>
          <b>Data portability</b> — request your data in a structured,
          machine-readable format.
        </li>
        <li>
          <b>Withdraw consent</b> at any time, without affecting processing
          already carried out.
        </li>
        <li>
          <b>Lodge a complaint</b> with the UAE Data Office if you believe
          we&apos;ve mishandled your data.
        </li>
      </ul>
      <p>
        We respond within 30 days. If we can&apos;t fully honour a request —
        for example because of an AML retention obligation — we&apos;ll
        explain why.
      </p>

      <h2>10. Data Retention</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Retention</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Account data</td>
            <td>
              While your account is active, plus 30 days after deletion
              request processing
            </td>
          </tr>
          <tr>
            <td>KYC / AML records</td>
            <td>
              7 years from the end of the relationship (UAE AML/CFT
              requirement)
            </td>
          </tr>
          <tr>
            <td>Audit logs</td>
            <td>7 years, immutable</td>
          </tr>
          <tr>
            <td>Marketing analytics</td>
            <td>13 months</td>
          </tr>
          <tr>
            <td>Newsletter subscription</td>
            <td>Until you unsubscribe or request deletion</td>
          </tr>
          <tr>
            <td>Support/enquiry threads</td>
            <td>
              2 years after resolution, unless tied to an active or closed
              deal (then per KYC retention)
            </td>
          </tr>
        </tbody>
      </table>

      <h2>11. Security</h2>
      <p>
        We encrypt data in transit (TLS 1.2+) and at rest (AES-256). CMS
        access requires multi-factor authentication and is role-gated.
        Production secrets are managed outside application code. We run
        quarterly disaster-recovery tests. No system is 100% secure; if we
        experience a breach affecting your data, we&apos;ll notify you and
        the relevant authority as UAE PDPL requires.
      </p>

      <h2>12. Children&apos;s Privacy</h2>
      <p>
        Bazar&apos;s services are intended for adults entering property
        transactions. We do not knowingly collect data from anyone under 18.
        If we learn we&apos;ve collected such data, we&apos;ll delete it.
      </p>

      <h2>13. Third-Party Links</h2>
      <p>
        Listings may link to developer microsites, portals, or payment
        processors outside our control. Their privacy practices are governed
        by their own policies — we encourage you to review them.
      </p>

      <h2>14. Marketing Communications</h2>
      <p>
        We only send marketing email (the Bazar Brief, campaigns) to those
        who&apos;ve opted in via double opt-in. Every marketing email
        includes a one-click unsubscribe. Transactional emails (viewing
        confirmations, deal updates, account notices) are not marketing and
        can&apos;t be opted out of while your account is active.
      </p>

      <h2>15. Changes to This Policy</h2>
      <p>
        We will notify you of material changes by email and surface a
        banner on sign-in. The effective date at the top of this page
        reflects the latest revision. Continued use of bazar.ae after a
        change takes effect means you accept the update.
      </p>

      <h2>16. Contact Us</h2>
      <p>
        Bazar Real Estate Brokerage LLC
        <br />
        Abu Dhabi, United Arab Emirates
        <br />
        ORN 28041
        <br />
        Data Protection Officer:{" "}
        <a href="mailto:dpo@bazarrealestate.ae">dpo@bazarrealestate.ae</a>
      </p>
    </LegalDocFrame>
  );
}
