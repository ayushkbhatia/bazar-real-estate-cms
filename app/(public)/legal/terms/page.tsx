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
      <h2>Acceptance</h2>
      <p>
        By using bazar.ae and the services it links to (the &quot;Service&quot;)
        you agree to these terms. The Service is operated by Bazar Real Estate
        Brokerage LLC, a UAE-licensed brokerage (ORN 28041).
      </p>

      <h2>Use of the Service</h2>
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
      </ul>

      <h2>Advisor relationship</h2>
      <p>
        Bazar acts as a fiduciary advisor to its clients. Where there is no
        signed advisory or buyer-representation agreement, Bazar represents
        the seller of any specific listing. We disclose this upfront on every
        enquiry.
      </p>

      <h2>Fees</h2>
      <p>
        Advisory fees are disclosed in your engagement letter — typically a
        percentage of the closed transaction value, paid by the engaging party.
        Marketplace use is free for buyers and tenants.
      </p>

      <h2>Listings &amp; compliance</h2>
      <ul>
        <li>
          Every published listing carries a valid Trakheesi/DARI permit number
          and an assigned BRN-licensed advisor. Listings without valid permits
          are not publishable through the CMS.
        </li>
        <li>
          We do not knowingly publish listings sourced from another agency
          without the cooperating-broker arrangement.
        </li>
      </ul>

      <h2>User content</h2>
      <p>
        When you submit an enquiry, review, or other content, you grant Bazar a
        worldwide, non-exclusive licence to use it to provide the Service.
        Don&apos;t submit content you don&apos;t have the right to share.
      </p>

      <h2>AI tools (concierge, valuation)</h2>
      <p>
        Outputs from the AI concierge and the auto-valuation tool are
        informational. They are not financial, legal, or tax advice. We
        review and override AI-generated valuations before they are used in
        any binding context.
      </p>

      <h2>Prohibited use</h2>
      <ul>
        <li>No scraping, automated downloading, or bulk extraction.</li>
        <li>No publishing of listings sourced from this Service elsewhere.</li>
        <li>No attempt to circumvent rate limits, bot protection, or auth.</li>
        <li>No misrepresentation of identity, residency, or proof of funds.</li>
      </ul>

      <h2>Termination</h2>
      <p>
        We may suspend or terminate accounts that violate these terms. You may
        terminate your account at any time via <code>/account/data-deletion</code>.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The Service is provided on an as-is basis. To the maximum extent
        permitted by UAE law, Bazar disclaims implied warranties of
        merchantability and fitness for a particular purpose.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        Bazar&apos;s aggregate liability arising from your use of the Service
        is capped at the lesser of AED 10,000 or fees paid to Bazar in the
        twelve months preceding the claim. This cap does not apply to
        liability that cannot be limited under UAE law.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the Emirate of Abu Dhabi and
        the federal laws of the UAE. Disputes are subject to the exclusive
        jurisdiction of the Abu Dhabi courts.
      </p>

      <h2>Changes</h2>
      <p>
        We will notify registered users of material changes by email. Continued
        use after the effective date constitutes acceptance.
      </p>
    </LegalDocFrame>
  );
}
