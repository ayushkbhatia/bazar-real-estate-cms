import type { Metadata } from "next";
import { LegalDocFrame } from "../_layout";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "Terms of service for Bazar Real Estate's marketplace, advisory, and tools.",
};

export default function TermsPage() {
  return (
    <LegalDocFrame active="terms" title="Terms of service" effective="22 May 2026">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By using bazar.ae and the services it links to (the &quot;Service&quot;)
        you agree to these terms. The Service is operated by Bazar Real Estate
        Brokerage LLC (&quot;Bazar&quot;, &quot;we&quot;), a UAE-licensed
        brokerage (ORN 28041). If you don&apos;t agree, don&apos;t use the
        Service.
      </p>

      <h2>2. Eligibility and Accounts</h2>
      <p>
        You must be at least 18 to create an account. You&apos;re responsible
        for keeping your login credentials confidential and for all activity
        under your account. Tell us immediately at{" "}
        <a href="mailto:dpo@bazarrealestate.ae">dpo@bazarrealestate.ae</a> if
        you suspect unauthorised access.
      </p>

      <h2>3. Description of Service</h2>
      <ul>
        <li>
          You may browse the marketplace, submit enquiries, save listings, and
          use the calculator tools without an account. Some features (saved
          searches, viewings, the data-export and data-deletion endpoints)
          require an account.
        </li>
        <li>
          The catalogue is curated. Bazar selects which listings appear; we do
          not guarantee that any specific property is or remains available.
        </li>
        <li>
          Prices and figures shown are estimates unless explicitly described
          as a final offer. Final terms are confirmed in writing per
          transaction.
        </li>
        <li>We may add, change, or discontinue features at any time.</li>
      </ul>

      <h2>4. Advisor / Agency Relationship</h2>
      <p>
        Bazar acts as a fiduciary advisor to its clients. Where there is no
        signed advisory or buyer-representation agreement, Bazar represents
        the seller of any specific listing. We disclose this upfront on every
        enquiry, consistent with UAE brokerage disclosure requirements.
      </p>

      <h2>5. Fees</h2>
      <p>
        Advisory fees are disclosed in your engagement letter — typically a
        percentage of the closed transaction value, paid by the engaging
        party. Marketplace use is free for buyers and tenants. Valuation and
        mortgage tool outputs are free and do not create an advisory
        relationship on their own.
      </p>

      <h2>6. Listings &amp; Compliance</h2>
      <ul>
        <li>
          Every published listing carries a valid Trakheesi/DARI permit number
          and an assigned BRN-licensed advisor. Listings without valid permits
          are not publishable through the CMS.
        </li>
        <li>
          We do not knowingly publish listings sourced from another agency
          without a cooperating-broker arrangement.
        </li>
        <li>
          Listing data is provided by the assigned advisor and reviewed by our
          compliance team, but Bazar does not independently verify every
          physical detail of a property before publication.
        </li>
      </ul>

      <h2>7. User Content and Conduct</h2>
      <p>
        When you submit an enquiry, review, or other content, you grant Bazar
        a worldwide, non-exclusive licence to use it to provide the Service.
        Don&apos;t submit content you don&apos;t have the right to share, and
        don&apos;t submit content that is false, defamatory, or infringes a
        third party&apos;s rights.
      </p>

      <h2>8. AI Tools (Concierge, Valuation)</h2>
      <p>
        Outputs from the AI concierge and the auto-valuation tool are
        informational. They are not financial, legal, or tax advice, and do
        not replace a licensed advisor&apos;s judgment. We review and
        override AI-generated valuations before they are used in any binding
        context. Concierge conversations may be retained per our{" "}
        <a href="/legal/privacy">Privacy Policy</a> to improve response
        quality.
      </p>

      <h2>9. Intellectual Property</h2>
      <p>
        Bazar owns or licenses all content on the Service — text, design,
        listing photography we commission, and software. You may not copy,
        republish, or create derivative works from it outside of normal
        browsing use, except as these terms expressly allow.
      </p>

      <h2>10. Prohibited Use</h2>
      <ul>
        <li>No scraping, automated downloading, or bulk extraction.</li>
        <li>No publishing of listings sourced from this Service elsewhere.</li>
        <li>No attempt to circumvent rate limits, bot protection, or auth.</li>
        <li>No misrepresentation of identity, residency, or proof of funds.</li>
        <li>
          No use of the Service to send unsolicited communications to other
          users.
        </li>
      </ul>

      <h2>11. Third-Party Links and Services</h2>
      <p>
        The Service may link to developer microsites, property portals, or
        payment processors we don&apos;t control. We aren&apos;t responsible
        for their content, availability, or practices — review their own
        terms before relying on them.
      </p>

      <h2>12. Disclaimers</h2>
      <p>
        The Service is provided on an as-is, as-available basis. To the
        maximum extent permitted by UAE law, Bazar disclaims implied
        warranties of merchantability, fitness for a particular purpose, and
        non-infringement. We don&apos;t warrant that the Service will be
        uninterrupted, error-free, or that listing data is complete or
        current at every moment.
      </p>

      <h2>13. Limitation of Liability</h2>
      <p>
        Bazar&apos;s aggregate liability arising from your use of the Service
        is capped at the lesser of AED 10,000 or fees paid to Bazar in the
        twelve months preceding the claim. This cap does not apply to
        liability that cannot be limited under UAE law (including liability
        for fraud or wilful misconduct).
      </p>

      <h2>14. Indemnification</h2>
      <p>
        You agree to indemnify Bazar against claims arising from your breach
        of these terms or your misuse of the Service, to the extent permitted
        by UAE law.
      </p>

      <h2>15. Termination</h2>
      <p>
        We may suspend or terminate accounts that violate these terms. You
        may terminate your account at any time via{" "}
        <code>/account/data-deletion</code>. Sections that by their nature
        should survive termination (fees owed, liability caps, governing
        law) continue to apply.
      </p>

      <h2>16. Governing Law and Dispute Resolution</h2>
      <p>
        These terms are governed by the laws of the Emirate of Abu Dhabi and
        the federal laws of the UAE. Disputes are subject to the exclusive
        jurisdiction of the Abu Dhabi courts.
      </p>

      <h2>17. Changes to These Terms</h2>
      <p>
        We will notify registered users of material changes by email and
        surface a banner on sign-in. Continued use after the effective date
        constitutes acceptance.
      </p>

      <h2>18. Contact Us</h2>
      <p>
        Bazar Real Estate Brokerage LLC
        <br />
        Abu Dhabi, United Arab Emirates
        <br />
        ORN 28041
        <br />
        Email:{" "}
        <a href="mailto:dpo@bazarrealestate.ae">dpo@bazarrealestate.ae</a>
      </p>
    </LegalDocFrame>
  );
}
