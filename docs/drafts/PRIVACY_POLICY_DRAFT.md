# Bazar Real Estate — Privacy Policy (Draft)

**Effective date:** [to confirm on publish]
**Last reviewed:** 8 July 2026

> Draft for review. Benchmarked against Allsopp & Allsopp, Haus & Haus, and
> Metropolitan Properties privacy pages (structure, section coverage, plain-
> language tone), then rewritten against Bazar's actual data flows, vendor
> list, and UAE PDPL (Federal Decree-Law No. 45 of 2021) obligations. Once
> approved this replaces the copy in `app/(public)/legal/privacy/page.tsx`.

---

## 1. Introduction

Bazar Real Estate Brokerage LLC ("**Bazar**", "**we**", "**us**") operates
[bazar.ae](https://bazar.ae): a curated property marketplace and advisory
service across the United Arab Emirates. We are licensed by the Abu Dhabi
Department of Municipalities and Transport (**ORN 28041**).

This policy explains what personal data we collect, why, how long we keep
it, who we share it with, and the rights you have over it. It applies to
everyone who browses bazar.ae, creates an account, contacts us, or transacts
with us — buyers, tenants, landlords, sellers, and site visitors alike.

Our Data Protection Officer can be reached at
[dpo@bazarrealestate.ae](mailto:dpo@bazarrealestate.ae) for any question about this policy or
your data.

## 2. Scope

This policy covers bazar.ae and the Bazar CMS. It does not cover third-party
sites we link to (developer microsites, portal syndication targets, payment
processors) — those are governed by their own policies.

## 3. Information We Collect

**Information you give us directly**

- **Account details** — name, email, phone number, residency status.
- **Enquiries** — when you contact us about a listing, submit the contact
  form, or message the AI concierge: your name, contact details, message
  body, and the property or development referenced.
- **Saved items** — properties and searches you save, and the alert
  frequency you choose (daily / weekly / on-change).
- **Viewing requests and deal documents** — once you progress to an offer,
  identity documents and proof-of-funds for KYC, deal notes, and any files
  you upload to a deal room.
- **Valuation and mortgage tool inputs** — property address, size, condition,
  and financial assumptions you enter to generate a report.
- **Newsletter signup** — email address and, if you tell us, your areas of
  interest.

**Information we collect automatically**

- **Usage data** — pages viewed, search filters applied, device and browser
  type, approximate location (IP-derived), referrer.
- **Cookies and similar technologies** — see [Section 6](#6-cookies).

**Information from third parties**

- Portal syndication partners and developers may pass us enquiry data they
  collected on their own channels, where you've consented to that hand-off.
- Public UAE property registries (e.g. DLD transaction data) used for
  valuation comparables — this is not personal data about you specifically.

## 4. How We Use Your Information

| Purpose | Examples |
|---|---|
| Deliver the service you asked for | Responding to enquiries, scheduling viewings, progressing a deal, sending the report you requested |
| Run your account | Authentication, saved searches, alert emails |
| Legal and regulatory compliance | AML/CFT checks and KYC record-keeping, audit logging, DLD-related reporting |
| Improve the product | Aggregated/anonymised analytics on search and listing performance |
| Marketing (only with consent) | The Bazar Brief newsletter, campaign emails |
| Security | Fraud prevention, abuse detection, access logging |

We do not use your data to make any decision with legal or similarly
significant effect about you without a human in the loop.

## 5. Legal Basis for Processing

Under UAE PDPL, we rely on one or more of the following bases for each use
above:

- **Performance of a contract** — delivering the marketplace and advisory
  service you've asked for.
- **Legal obligation** — AML/CFT record-keeping, regulatory reporting.
- **Legitimate interest** — product analytics, fraud prevention, service
  improvement — balanced against your right to privacy, and only where you
  wouldn't reasonably object.
- **Consent** — newsletter emails, non-essential cookies, WhatsApp messaging
  you initiate. You can withdraw consent at any time (see [Section 9](#9-your-rights-under-uae-pdpl)).

## 6. Cookies

We use strictly-necessary cookies (session, security) without asking, and
analytics/marketing cookies only after you accept them in the consent
banner. Full detail — including current vendors and retention — is in our
[Cookie Policy](/legal/cookies), which is part of this policy by reference.

## 7. How We Share Your Information

We share personal data with the vendors that operate the service. We do not
sell personal data, and we do not share it with third parties for their own
marketing purposes.

| Vendor | Purpose | Data shared |
|---|---|---|
| Supabase (EU, Frankfurt) | Database, authentication, file storage | All account and enquiry data |
| Resend (EU, Frankfurt) | Transactional email | Email address, message content |
| Vercel | Hosting | Request logs, IP address |
| Meta WhatsApp Business Cloud | Messaging | Only for users who message us on WhatsApp first |
| Anthropic (Claude) | AI concierge | Concierge conversation content |
| Meilisearch | Search | Publicly listed property attributes only (no personal data) |
| Mapbox | Geocoding, isochrones, maps | Addresses/coordinates you search |
| Mailchimp | Newsletter campaigns | Email address, subscription status |
| PostHog, Vercel Analytics | Product analytics | Only after cookie consent |
| Sentry | Error monitoring | Technical error context; we scrub personal data from error payloads where feasible |

We may also disclose data where required by UAE law, court order, or
regulator request (e.g. DLD, Central Bank AML reporting), or to a successor
entity in the event of a merger or acquisition of Bazar, subject to
equivalent privacy protections.

## 8. International Data Transfers

Most processing happens within the European Economic Area (Frankfurt). Where
a vendor processes data outside the EEA or UAE (for example, US-based
observability tooling), we rely on standard contractual clauses or the
vendor's equivalent safeguard, consistent with UAE PDPL's cross-border
transfer requirements.

## 9. Your Rights Under UAE PDPL

You have the right to:

- **Access** the personal data we hold about you — via
  `/account/data-export`, or by writing to [dpo@bazarrealestate.ae](mailto:dpo@bazarrealestate.ae).
- **Rectify** inaccurate data — edit your profile, or contact us.
- **Erase** your data — via `/account/data-deletion`. KYC records tied to a
  closed transaction are retained per Section 10 and anonymised where
  deletion isn't legally permitted.
- **Restrict or object to processing**, including direct marketing —
  unsubscribe from the newsletter, or contact us.
- **Data portability** — request your data in a structured, machine-readable
  format.
- **Withdraw consent** at any time, without affecting processing already
  carried out.
- **Lodge a complaint** with the UAE Data Office if you believe we've
  mishandled your data.

We respond within 30 days. If we can't fully honour a request — for example
because of an AML retention obligation — we'll explain why.

## 10. Data Retention

| Data | Retention |
|---|---|
| Account data | While your account is active, plus 30 days after deletion request processing |
| KYC / AML records | 7 years from the end of the relationship (UAE AML/CFT requirement) |
| Audit logs | 7 years, immutable |
| Marketing analytics | 13 months |
| Newsletter subscription | Until you unsubscribe or request deletion |
| Support/enquiry threads | 2 years after resolution, unless tied to an active or closed deal (then per KYC retention) |

## 11. Data Security

We encrypt data in transit (TLS 1.2+) and at rest (AES-256). CMS access
requires multi-factor authentication and is role-gated. Production secrets
are managed outside application code. We run quarterly disaster-recovery
tests. No system is 100% secure; if we experience a breach affecting your
data, we'll notify you and the relevant authority as UAE PDPL requires.

## 12. Children's Privacy

Bazar's services are intended for adults entering property transactions. We
do not knowingly collect data from anyone under 18. If we learn we've
collected such data, we'll delete it.

## 13. Third-Party Links

Listings may link to developer microsites, portals, or payment processors
outside our control. Their privacy practices are governed by their own
policies — we encourage you to review them.

## 14. Marketing Communications

We only send marketing email (the Bazar Brief, campaigns) to those who've
opted in via double opt-in. Every marketing email includes a one-click
unsubscribe. Transactional emails (viewing confirmations, deal updates,
account notices) are not marketing and can't be opted out of while your
account is active.

## 15. Changes to This Policy

We'll notify you of material changes by email and a sign-in banner. The
effective date at the top of this page reflects the latest revision.
Continued use of bazar.ae after a change takes effect means you accept the
update.

## 16. Contact Us

**Bazar Real Estate Brokerage LLC**
Abu Dhabi, United Arab Emirates
ORN 28041
Data Protection Officer: [dpo@bazarrealestate.ae](mailto:dpo@bazarrealestate.ae)
