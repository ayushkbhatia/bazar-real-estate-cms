import type { Metadata } from "next";
import { LegalDocFrame } from "../_layout";
import { PrivacyArabic } from "./_content-ar";
import { localeAlternates } from "@/lib/i18n/metadata";
import { isEnabledLocale, type Locale } from "@/lib/i18n/locales";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isEnabledLocale(raw) ? raw : "en";
  const alternates = localeAlternates("/legal/privacy", locale);

  return locale === "ar"
    ? {
        title: "سياسة الخصوصية",
        description:
          "كيفية قيام شركة بازار العقارية ذ.م.م بجمع البيانات الشخصية واستخدامها وتخزينها والإفصاح عنها وحمايتها، وفقًا للمرسوم بقانون اتحادي رقم ٤٥ لسنة ٢٠٢١ بشأن حماية البيانات الشخصية.",
        alternates,
      }
    : {
        title: "Privacy policy",
        description:
          "How Bazar Real Estate L.L.C. collects, uses, stores, discloses, and protects personal data, issued under UAE PDPL (Federal Decree-Law No. 45 of 2021).",
        alternates,
      };
}

/**
 * Client-supplied final text (bilingual PDF, English side), replacing the
 * in-house draft. Copy is verbatim apart from typographic normalisation —
 * do not rewrite it to match the product surface. Where the policy and the
 * product disagree (it names Salesforce as the CRM; it is silent on the AI
 * concierge, newsletter and valuation tools), the policy is the client's to
 * change, not ours. See docs/FOLLOWUPS.md.
 */
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Same URL, two languages — see _content-ar.tsx for why this is a branch
  // rather than a separate route.
  if (locale === "ar") return <PrivacyArabic />;

  return (
    <LegalDocFrame
      active="privacy"
      title="Privacy policy"
      effective="6 August 2026"
      dateLabel="Last updated"
      contactEmail="info@bazarrealestate.ae"
      draft={false}
      translation={{
        label: "العربية",
        href: "/ar/legal/privacy",
        locale: "ar",
      }}
    >
      <h2>1. Introduction</h2>
      <p>
        Bazar Real Estate L.L.C. is a real estate brokerage licensed and
        regulated in the Emirate of Abu Dhabi, United Arab Emirates,
        headquartered in Al Bateen, Abu Dhabi, and regulated by the Abu Dhabi
        Real Estate Centre (ADREC) and, where applicable, the Dubai Land
        Department (DLD). This Privacy Policy explains how we collect, use,
        store, disclose, and protect personal data when you visit our
        website(s), submit an inquiry, contact us through WhatsApp or phone,
        or otherwise interact with our services.
      </p>
      <p>
        This Policy is issued in accordance with UAE Federal Decree-Law No. 45
        of 2021 on the Protection of Personal Data (the &quot;PDPL&quot;) and
        its implementing regulations.
      </p>

      <h2>2. What Personal Data We Collect</h2>
      <p>We collect personal data through the following channels:</p>
      <ul>
        <li>
          <b>Website contact and inquiry forms</b> — full name, phone number,
          email address, and details of the property or service you are
          interested in.
        </li>
        <li>
          <b>WhatsApp integration</b> — your name, phone number, and the
          content of messages exchanged with our team.
        </li>
        <li>
          <b>Call integration</b> — your phone number, call metadata (date,
          time, duration), and, where legally permitted and disclosed to you,
          call recordings for quality and training purposes.
        </li>
        <li>
          <b>Third-party advertising and listing platforms</b> — when you
          engage with our adverts or listings on Meta
          (Facebook/Instagram), Google, LinkedIn, Property Finder, Bayut,
          Dubizzle, or similar platforms, and submit an inquiry through them,
          your name, contact details, and inquiry details are passed to us and
          stored in our CRM.
        </li>
        <li>
          <b>Cookies and similar tracking technologies</b> deployed via our
          website and advertising pixels (see Section 6).
        </li>
        <li>
          <b>Documents you voluntarily provide</b> during a transaction (e.g.
          Emirates ID, passport, income documentation), whether submitted via
          the website, email, or in person.
        </li>
      </ul>

      <h2>3. How We Use Your Data</h2>
      <p>
        We process personal data for the following purposes, each with a
        corresponding legal basis under the PDPL:
      </p>
      <ul>
        <li>
          To respond to your inquiry and connect you with the relevant
          property consultant — basis: performance of a contract /
          pre-contractual steps taken at your request.
        </li>
        <li>
          To pass your inquiry to the property consultant responsible for the
          relevant listing, location, or service area — basis: legitimate
          interest in fulfilling your request efficiently.
        </li>
        <li>
          To maintain records of client and lead interactions in our CRM
          system (Salesforce) — basis: legitimate interest and, in relevant
          cases, legal obligation (e.g. ADREC/DLD record-keeping
          requirements).
        </li>
        <li>
          To send you marketing communications about properties or services
          that may interest you — basis: your consent, which you may withdraw
          at any time (see Section 8).
        </li>
        <li>
          To comply with applicable UAE laws and regulatory requirements,
          including those of ADREC and DLD.
        </li>
      </ul>

      <h2>4. Who We Share Your Data With</h2>
      <p>
        Access to your personal data within Bazar is restricted to authorized
        personnel — namely, the property consultant(s) assigned to your
        inquiry and relevant supervisory or administrative staff — on a
        need-to-know basis.
      </p>
      <p>
        We share personal data with the following categories of third parties:
      </p>
      <ul>
        <li>
          Salesforce (our Customer Relationship Management platform), which
          stores and processes inquiry and client data on our behalf under a
          data processing agreement.
        </li>
        <li>
          Advertising and listing platforms (Meta, Google, LinkedIn, Property
          Finder, Bayut, Dubizzle) to the extent necessary to run campaigns
          and receive inquiries generated through them — governed also by
          those platforms&apos; own privacy policies.
        </li>
        <li>
          Developers or landlords, where necessary to progress a specific
          transaction you have inquired about, and only with your knowledge as
          part of that transaction.
        </li>
        <li>
          Regulatory authorities (including ADREC and DLD), law enforcement,
          or courts, where required by law.
        </li>
      </ul>
      <p>
        We do not sell, rent, or lease your personal data to any third party.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain personal data collected through inquiries for a period of 12
        months from the date of your last interaction with us, or for the
        duration of an active transaction plus any period required by
        ADREC/DLD record-keeping obligations, whichever is longer.
      </p>

      <h2>6. Cookies and Tracking Technologies</h2>
      <p>
        Our website uses cookies and similar technologies, including
        advertising pixels from Meta, Google, and LinkedIn, to operate the
        site, analyze traffic, and measure the performance of our advertising
        campaigns.
      </p>

      <h2>7. Data Security</h2>
      <p>
        We implement appropriate technical and organizational measures
        designed to protect personal data against unauthorized access, loss,
        misuse, or alteration, including restricted internal access, secure
        storage within our CRM, and confidentiality obligations on staff who
        handle client data. No method of transmission or storage over the
        internet is entirely secure, and we cannot guarantee absolute security
        of information transmitted to us online.
      </p>

      <h2>8. Your Rights</h2>
      <p>Subject to the PDPL, you have the right to:</p>
      <ul>
        <li>Request access to the personal data we hold about you.</li>
        <li>Request correction of inaccurate or incomplete data.</li>
        <li>
          Request deletion of your data, subject to our legal and regulatory
          retention obligations.
        </li>
        <li>
          Withdraw consent to marketing communications at any time, without
          affecting the lawfulness of processing carried out before
          withdrawal.
        </li>
        <li>
          Object to certain processing carried out on the basis of legitimate
          interest.
        </li>
      </ul>
      <p>
        To exercise any of these rights, please contact us using the details
        in Section 10.
      </p>

      <h2>9. International Transfers</h2>
      <p>
        If you interact with us from outside the UAE, or if we run marketing
        campaigns directed at audiences in other countries, your personal data
        may be transferred to and processed in the UAE.
      </p>

      <h2>10. Contact Us</h2>
      <p>
        If you have questions, concerns, or requests regarding this Privacy
        Policy or your personal data, please contact:
      </p>
      <ul>
        <li>
          Email:{" "}
          <a href="mailto:info@bazarrealestate.ae">info@bazarrealestate.ae</a>
        </li>
        <li>
          Address: Sheikha Salama Building, Office 4, Zayed The First Street,
          Al Bateen, Abu Dhabi, United Arab Emirates
        </li>
      </ul>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time to reflect changes
        in our practices or legal requirements. The &quot;Last updated&quot;
        date at the top of this Policy indicates when it was last revised.
        Material changes will be notified via our website.
      </p>
    </LegalDocFrame>
  );
}
