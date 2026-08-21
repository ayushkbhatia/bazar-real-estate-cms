import type { MasterPageDef } from "../types";
import { text, area } from "../fields";

/**
 * Terms of service and the cookie policy, as editable documents.
 *
 * Both were hardcoded JSX until now, which made them the only public copy on
 * the site the client could not change and the only pages with no Arabic. The
 * privacy policy already had both — the client supplied a bilingual PDF — so
 * this brings the other two level.
 *
 * ## Why this is a master page and not a bespoke table
 *
 * Everything needed already exists here: an admin editor that lists
 * `MASTER_PAGES`, derived `_ar` twins for every translatable field, a publish
 * gate, and `fillArabic` resolving a blank twin through the shared store. A
 * `legal_documents` table would have meant a migration, a CRUD screen and a
 * second translation path, to arrive at the same place.
 *
 * The clause list is a `list` field rather than one long textarea so the
 * client can add, remove and reorder clauses — legal documents grow by
 * clause — and so each clause gets its own Arabic twin instead of one
 * 4,000-character block that has to be re-translated whole when one sentence
 * changes.
 *
 * ## The Arabic is a placeholder and the code says so
 *
 * `lib/i18n/mt/targets.ts` lists `app/[locale]/(public)/legal/**` under
 * `PROTECTED_NON_COLUMNS` as "lawyer-signed copy", and the content plan puts
 * `/legal/*` off-limits to machine translation entirely. That protection was
 * written for good reason and is not being quietly dropped: the client asked
 * for placeholder Arabic so the surface is complete for review, on the
 * explicit understanding that they replace it before it means anything.
 *
 * So the English defaults below are the exact copy these pages already
 * rendered — an un-edited page is byte-identical to before — and the Arabic
 * arrives from the store, where it is marked `by: "machine"` like everything
 * else. `LegalDocFrame` shows a draft notice on any locale whose text has not
 * been confirmed, so a reader is never told a machine draft is the policy.
 */

export const LEGAL_TERMS_PAGE: MasterPageDef = {
  key: "legal-terms",
  label: "Terms of service",
  description: "The terms a visitor agrees to by using the site.",
  path: "/legal/terms",
  sections: [
    {
      key: "doc",
      label: "Document",
      description: "The document heading, its effective date, and every clause in order.",
      fields: [
        text("title", "Title", { max: 120 }),
        // Editable because the frame's fixed "Effective" prefix has already
        // been fought once: an editor typed "Last updated: August 2026" into
        // the date field and the page published "Effective Last updated:
        // August 2026". Privacy declares the same pair.
        text("date_label", "Date label", {
          max: 40,
          help: 'Sits before the date — "Effective" or "Last updated".',
        }),
        text("effective", "Date", { max: 40 }),
        text("contact_email", "Contact mailbox", {
          max: 160,
          // A mailbox, not prose — see sections/legal-privacy.ts.
          i18n: false,
          help: "Printed under the document as the route for PDPL requests.",
        }),
        area("intro", "Standfirst", { max: 400, optional: true }),
        {
          key: "clauses",
          label: "Clauses",
          kind: "list",
          itemLabel: "clause",
          max: 40,
          help: "Numbered in the order shown. Leave a blank line between paragraphs; a line starting with • becomes a bullet.",
          fields: [
            text("heading", "Heading", { max: 200 }),
            area("body", "Body", { max: 4000 }),
          ],
        },
      ],
      defaults: {
        title: "Terms of service",
        date_label: "Effective",
        effective: "22 May 2026",
        contact_email: "dpo@bazarrealestate.ae",
        intro: "The terms you agree to by using bazar.ae and the services it links to.",
        clauses: [
            { heading: "1. Acceptance of Terms", body: "By using bazar.ae and the services it links to (the \"Service\")\nyou agree to these terms. The Service is operated by Bazar Real Estate\nBrokerage LLC (\"Bazar\", \"we\"), a UAE-licensed\nbrokerage (ORN 28041). If you don't agree, don't use the\nService." },
            { heading: "2. Eligibility and Accounts", body: "You must be at least 18 to create an account. You're responsible\nfor keeping your login credentials confidential and for all activity\nunder your account. Tell us immediately at \ndpo@bazarrealestate.ae if\nyou suspect unauthorised access." },
            { heading: "3. Description of Service", body: "• \nYou may browse the marketplace, submit enquiries, save listings, and\nuse the calculator tools without an account. Some features (saved\nsearches, viewings)\nrequire an account.\n• \nThe catalogue is curated. Bazar selects which listings appear; we do\nnot guarantee that any specific property is or remains available.\n• \nPrices and figures shown are estimates unless explicitly described\nas a final offer. Final terms are confirmed in writing per\ntransaction.\n• We may add, change, or discontinue features at any time." },
            { heading: "4. Advisor / Agency Relationship", body: "Bazar acts as a fiduciary advisor to its clients. Where there is no\nsigned advisory or buyer-representation agreement, Bazar represents\nthe seller of any specific listing. We disclose this upfront on every\nenquiry, consistent with UAE brokerage disclosure requirements." },
            { heading: "5. Fees", body: "Advisory fees are disclosed in your engagement letter — typically a\npercentage of the closed transaction value, paid by the engaging\nparty. Marketplace use is free for buyers and tenants. Valuation and\nmortgage tool outputs are free and do not create an advisory\nrelationship on their own." },
            { heading: "6. Listings &amp; Compliance", body: "• \nEvery published listing carries a valid Trakheesi/DARI permit number\nand an assigned BRN-licensed advisor. Listings without valid permits\nare not publishable through the CMS.\n• \nWe do not knowingly publish listings sourced from another agency\nwithout a cooperating-broker arrangement.\n• \nListing data is provided by the assigned advisor and reviewed by our\ncompliance team, but Bazar does not independently verify every\nphysical detail of a property before publication." },
            { heading: "7. User Content and Conduct", body: "When you submit an enquiry, review, or other content, you grant Bazar\na worldwide, non-exclusive licence to use it to provide the Service.\nDon't submit content you don't have the right to share, and\ndon't submit content that is false, defamatory, or infringes a\nthird party's rights." },
            { heading: "8. AI Tools (Concierge, Valuation)", body: "Outputs from the AI concierge and the auto-valuation tool are\ninformational. They are not financial, legal, or tax advice, and do\nnot replace a licensed advisor's judgment. We review and\noverride AI-generated valuations before they are used in any binding\ncontext. Concierge conversations may be retained per our \nPrivacy Policy to improve response\nquality." },
            { heading: "9. Intellectual Property", body: "Bazar owns or licenses all content on the Service — text, design,\nlisting photography we commission, and software. You may not copy,\nrepublish, or create derivative works from it outside of normal\nbrowsing use, except as these terms expressly allow." },
            { heading: "10. Prohibited Use", body: "• No scraping, automated downloading, or bulk extraction. \n• No publishing of listings sourced from this Service elsewhere. \n• No attempt to circumvent rate limits, bot protection, or auth. \n• No misrepresentation of identity, residency, or proof of funds. \n• \nNo use of the Service to send unsolicited communications to other\nusers." },
            { heading: "11. Third-Party Links and Services", body: "The Service may link to developer microsites, property portals, or\npayment processors we don't control. We aren't responsible\nfor their content, availability, or practices — review their own\nterms before relying on them." },
            { heading: "12. Disclaimers", body: "The Service is provided on an as-is, as-available basis. To the\nmaximum extent permitted by UAE law, Bazar disclaims implied\nwarranties of merchantability, fitness for a particular purpose, and\nnon-infringement. We don't warrant that the Service will be\nuninterrupted, error-free, or that listing data is complete or\ncurrent at every moment." },
            { heading: "13. Limitation of Liability", body: "Bazar's aggregate liability arising from your use of the Service\nis capped at the lesser of AED 10,000 or fees paid to Bazar in the\ntwelve months preceding the claim. This cap does not apply to\nliability that cannot be limited under UAE law (including liability\nfor fraud or wilful misconduct)." },
            { heading: "14. Indemnification", body: "You agree to indemnify Bazar against claims arising from your breach\nof these terms or your misuse of the Service, to the extent permitted\nby UAE law." },
            { heading: "15. Termination", body: "We may suspend or terminate access for anyone who violates these\nterms. To have the personal data we hold about you erased, email \ndpo@bazarrealestate.ae .\nSections that by their nature should survive termination (fees owed,\nliability caps, governing law) continue to apply." },
            { heading: "16. Governing Law and Dispute Resolution", body: "These terms are governed by the laws of the Emirate of Abu Dhabi and\nthe federal laws of the UAE. Disputes are subject to the exclusive\njurisdiction of the Abu Dhabi courts." },
            { heading: "17. Changes to These Terms", body: "We will notify registered users of material changes by email and\nsurface a banner on sign-in. Continued use after the effective date\nconstitutes acceptance." },
            { heading: "18. Contact Us", body: "Bazar Real Estate Brokerage LLC\nAbu Dhabi, United Arab Emirates\nORN 28041\nEmail: \ndpo@bazarrealestate.ae" },
        ],
      },
    },
  ],
};

export const LEGAL_COOKIES_PAGE: MasterPageDef = {
  key: "legal-cookies",
  label: "Cookie policy",
  description: "What the site stores on a visitor's device, and how they change it.",
  path: "/legal/cookies",
  sections: [
    {
      key: "doc",
      label: "Document",
      description: "The document heading, its effective date, and every clause in order.",
      fields: [
        text("title", "Title", { max: 120 }),
        // Editable because the frame's fixed "Effective" prefix has already
        // been fought once: an editor typed "Last updated: August 2026" into
        // the date field and the page published "Effective Last updated:
        // August 2026". Privacy declares the same pair.
        text("date_label", "Date label", {
          max: 40,
          help: 'Sits before the date — "Effective" or "Last updated".',
        }),
        text("effective", "Date", { max: 40 }),
        text("contact_email", "Contact mailbox", {
          max: 160,
          // A mailbox, not prose — see sections/legal-privacy.ts.
          i18n: false,
          help: "Printed under the document as the route for PDPL requests.",
        }),
        area("intro", "Standfirst", { max: 400, optional: true }),
        {
          key: "clauses",
          label: "Clauses",
          kind: "list",
          itemLabel: "clause",
          max: 40,
          help: "Numbered in the order shown. Leave a blank line between paragraphs; a line starting with • becomes a bullet.",
          fields: [
            text("heading", "Heading", { max: 200 }),
            area("body", "Body", { max: 4000 }),
          ],
        },
      ],
      defaults: {
        title: "Cookie policy",
        date_label: "Effective",
        effective: "22 May 2026",
        contact_email: "dpo@bazarrealestate.ae",
        intro: "What we store on your device, why, and how to change it.",
        clauses: [
            { heading: "1. What Are Cookies", body: "Cookies are small text files a website stores on your device to\nremember information between visits. We also use similar\ntechnologies (local storage, pixels) for the same purposes — this\npolicy covers all of them under \"cookies\" for simplicity." },
            { heading: "2. How We Use Cookies", body: "We use three categories. Essential cookies are required for the site\nto function and are always on. Analytics and marketing cookies are\noff until you accept them in the consent banner, and you can\nwithdraw consent at any time.\n• \nEssential — sign-in, CSRF protection, your cookie-banner\nchoice. These can't be disabled without breaking core\nfunctionality.\n• \nAnalytics — PostHog and Vercel Analytics, used to understand\nwhich listings and pages work, and to improve search relevance.\n• \nMarketing — retargeting pixels. None currently wired;\nreserved for future use. Off by default and will require a policy\nupdate and fresh consent before activation." },
            { heading: "3. Specific Cookies", body: "Name \nCategory \nProvider \nPurpose \nRetention \n))}\nWe'll add a row here (and bump the effective date) before\nactivating any new cookie, including marketing pixels." },
            { heading: "4. Third-Party Cookies", body: "Some cookies above are set by vendors we use to run the Service\n(Supabase, PostHog, Vercel), not by Bazar directly. Their processing\nof data collected via cookies is also covered by our \nPrivacy Policy ." },
            { heading: "5. Managing Your Preferences", body: "You can change your cookie choice at any time. The banner re-opens\nwhenever the policy is materially revised. To reset your preference\nbefore then, clear the bz_consent cookie from your\nbrowser and reload the page; the banner will reappear. You can also\nblock cookies entirely in your browser settings, though this may\nbreak sign-in and saved searches." },
            { heading: "6. Do-Not-Track / Global Privacy Control", body: "We respect the browser's Global Privacy Control signal where it\nis present: when GPC is set, analytics and marketing default to off\nregardless of your prior choice." },
            { heading: "7. Changes to This Policy", body: "We'll update the effective date whenever this policy changes\nmaterially, and re-surface the consent banner if the change affects\nwhat we collect." },
            { heading: "8. Questions", body: "Email \ndpo@bazarrealestate.ae \nwith any questions about the cookies we use or your stored\npreferences." },
        ],
      },
    },
  ],
};
