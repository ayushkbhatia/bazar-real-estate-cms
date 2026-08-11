/**
 * Every lead-capture form on the public site, declared once.
 *
 * The defaults in here are not aspirational — they are what each form renders
 * today, field for field, label for label, button for button. That is the
 * whole contract: an editor who opens /admin/forms and changes nothing must
 * leave the site byte-identical, and `lib/forms/registry.test.ts` holds the
 * literal strings to that promise.
 *
 * Adding a form: declare it here, and the manager lists it, resolves it and
 * records its responses without a migration. Wiring the public component to
 * `FormRenderer` is what upgrades it from `control: "copy"` to `"full"`.
 */

import {
  dialPhone,
  email,
  field,
  firstName,
  fullName,
  intentChips,
  lastName,
  message,
  options,
  phone,
  recordSelect,
  timelineChips,
} from "./fields";
import type { FormCopy, FormDef, FormFieldDef } from "./types";

// ── shared copy ──────────────────────────────────────────────────────────

const CONSENT = "By submitting you agree to be contacted by a Bazar advisor.";

/** The confirmation the shared `EnquiryForm` shows today. */
const ENQUIRY_SUCCESS = {
  success_title: "Thank you.",
  success_body:
    "We've received your brief. An advisor will reach out within 2 hours during business hours, and by next morning otherwise.",
};

function copy(overrides: Partial<FormCopy>): FormCopy {
  return {
    title: null,
    subtitle: null,
    submit_label: "Submit",
    pending_label: "Sending…",
    success_title: "Thank you.",
    success_body: "An advisor will be in touch shortly.",
    consent_note: CONSENT,
    ...overrides,
  };
}

// ── shared field sets ────────────────────────────────────────────────────

/**
 * The generic enquiry form's fields, in the order it renders them: name and
 * phone share a row, email spans, the intent control is optional, the brief
 * closes. Callers pass what differs — mostly the brief's label and the
 * presence of the intent row.
 */
function enquiryFields(opts: {
  intent: boolean;
  messageLabel: string;
  messagePlaceholder: string;
  messageRows: number;
  /** compact stacks every field; the wide form pairs name + phone. */
  paired: boolean;
}): FormFieldDef[] {
  const half = opts.paired ? ("half" as const) : ("full" as const);
  return [
    fullName({ width: half }),
    phone({ width: half }),
    // No helper text: the "email or phone" rule is enforced on submit and was
    // never spelled out on the page. Saying it up front would be a copy change
    // dressed up as a refactor.
    email(),
    ...(opts.intent ? [intentChips()] : []),
    message(opts.messageLabel, {
      placeholder: opts.messagePlaceholder,
      rows: opts.messageRows,
      locked: true,
    }),
  ];
}

/** The "List your property" card on the home and Areas pages. */
function listPropertyFields(): FormFieldDef[] {
  return [
    firstName(),
    lastName(),
    email({ required: true }),
    dialPhone(),
    field("purpose", "Property purpose", "chips", "intent", {
      required: true,
      options: [
        { label: "Sell Your Property", value: "sell", intent: "sell" },
        { label: "Rent Your Property", value: "rent", intent: "rent" },
        { label: "Manage Your Property", value: "manage", intent: "manage" },
      ],
    }),
  ];
}

/** The contact block both service landings share. */
function serviceContactFields(): FormFieldDef[] {
  return [
    fullName({ label: "Full Name" }),
    phone({ label: "Phone Number", required: true, width: "half" }),
    email({ label: "Email Address", required: true, width: "half" }),
  ];
}

// ── the registry ─────────────────────────────────────────────────────────

export const FORM_DEFS: FormDef[] = [
  // ─────────────────────────── master pages ───────────────────────────
  {
    key: "home_list_property",
    name: "List your property",
    surface: "Home page",
    path: "/",
    description:
      "The split lead card on the home page — owner details plus what they want done with the property.",
    group: "master",
    handler: "enquiry",
    control: "full",
    variant: "stacked",
    enquirySource: "contact_page",
    headingSource: {
      pageKey: "home",
      sectionKey: "list_your_property",
      note: "Eyebrow, heading, body copy and the photo beside the form.",
    },
    briefPrefix: "List my property — {purpose}.",
    copy: copy({
      submit_label: "Submit",
      pending_label: "Submitting…",
      success_title: "Thanks — we've got it.",
      success_body:
        "An advisor will be in touch shortly about listing your property.",
      consent_note: null,
    }),
    fields: listPropertyFields(),
  },
  {
    key: "areas_list_property",
    name: "List your property",
    surface: "Areas",
    path: "/areas",
    description:
      "The same owner lead card as the home page, with its own copy and its own responses.",
    group: "master",
    handler: "enquiry",
    control: "full",
    variant: "stacked",
    enquirySource: "contact_page",
    headingSource: {
      pageKey: "areas",
      sectionKey: "list_your_property",
      note: "Eyebrow, heading, body copy and the photo beside the form.",
    },
    briefPrefix: "List my property — {purpose}.",
    copy: copy({
      submit_label: "Submit",
      pending_label: "Submitting…",
      success_title: "Thanks — we've got it.",
      success_body:
        "An advisor will be in touch shortly about listing your property.",
      consent_note: null,
    }),
    fields: listPropertyFields(),
  },
  {
    key: "offplan_project_interest",
    name: "Interested in a new project?",
    surface: "New projects",
    path: "/off-plan",
    description:
      "Registers a visitor against a named launch so the advisor can follow up with availability, floor plans and payment plans.",
    group: "master",
    handler: "enquiry",
    control: "full",
    variant: "stacked",
    enquirySource: "contact_page",
    headingSource: {
      pageKey: "off-plan",
      sectionKey: "interest_form",
      note: "Eyebrow, heading, body copy and the render beside the form.",
    },
    briefPrefix: "New project interest — {project|Not sure yet}.",
    copy: copy({
      submit_label: "Register interest",
      pending_label: "Submitting…",
      success_title: "Thanks — we've got it.",
      success_body:
        "An advisor will be in touch shortly about the project you registered for.",
    }),
    fields: [
      firstName(),
      lastName(),
      email({ required: true }),
      dialPhone(),
      recordSelect(
        "project",
        "Project of interest",
        "development_id",
        "offplan_projects",
        { placeholder: "Not sure yet — help me choose" },
      ),
      timelineChips({ required: true }),
      // The "(optional)" is part of the label the visitor reads, not a
      // separate hint — so it lives in the label an editor can rewrite.
      field("note", "Anything else? (optional)", "textarea", "message", {
        placeholder: "Budget, bedrooms, must-haves…",
        rows: 3,
      }),
    ],
  },
  {
    key: "insights_newsletter",
    name: "Subscribe to market insights",
    surface: "Insights",
    path: "/insights",
    description:
      "The double opt-in newsletter box in the Insights hero. Sends a confirmation email before anyone is added to the list.",
    group: "master",
    handler: "newsletter",
    // One locked email box, by law and by design: a double opt-in signup that
    // collected anything else would be a lead form wearing a newsletter's
    // clothes. Copy and visibility are managed; there is no field list to edit.
    control: "copy",
    variant: "compact",
    newsletterSource: "insights_header",
    headingSource: {
      pageKey: "insights",
      sectionKey: "hero",
      note: "The heading and blurb around the subscribe box.",
    },
    alsoOn: ["Home page teaser", "Article sidebar"],
    copy: copy({
      submit_label: "Subscribe",
      pending_label: "Subscribing…",
      success_title: "Check your inbox.",
      success_body:
        "We've sent a confirmation link — click it and you're on the list.",
      consent_note: null,
    }),
    fields: [
      email({
        placeholder: "you@email.com",
        required: true,
        locked: true,
        note: "The only field a newsletter signup can carry.",
      }),
    ],
  },
  {
    key: "contact_enquiry",
    name: "Submit your enquiry",
    surface: "Contact",
    path: "/contact",
    description:
      "The main enquiry box on the contact page. The one form the site can't be without.",
    group: "master",
    handler: "enquiry",
    control: "full",
    variant: "stacked",
    enquirySource: "contact_page",
    alwaysOn: true,
    headingSource: {
      pageKey: "contact",
      sectionKey: "enquiry_form",
      note: "Form title, sub-copy and the WhatsApp link label beside it.",
    },
    copy: copy({ ...ENQUIRY_SUCCESS, submit_label: "Submit" }),
    fields: enquiryFields({
      intent: true,
      messageLabel: "Tell us more",
      messagePlaceholder: "Tell us about your brief — area, budget, timeline.",
      messageRows: 5,
      paired: true,
    }),
  },
  {
    key: "buy_hero_enquiry",
    name: "Find your next property",
    surface: "Buy",
    path: "/buy",
    description: "The enquiry card beside the Buy hero.",
    group: "master",
    handler: "enquiry",
    control: "full",
    variant: "stacked",
    enquirySource: "contact_page",
    headingSource: {
      pageKey: "buy",
      sectionKey: "hero_form",
      note: "The card's heading and sub-copy.",
    },
    copy: copy({ ...ENQUIRY_SUCCESS, submit_label: "Submit" }),
    fields: enquiryFields({
      intent: true,
      messageLabel: "Tell us more",
      messagePlaceholder: "Tell us about your brief — area, budget, timeline.",
      messageRows: 5,
      paired: true,
    }),
  },
  {
    key: "buy_lead_band",
    name: "Please tell us what you're looking for",
    surface: "Buy",
    path: "/buy",
    description:
      "The full-width lead band lower down the Buy page — a second chance at the same enquiry.",
    group: "master",
    handler: "enquiry",
    control: "full",
    variant: "stacked",
    enquirySource: "contact_page",
    headingSource: {
      pageKey: "buy",
      sectionKey: "lead_band",
      note: "Eyebrow, headline, sub-copy and the photo beside the form.",
    },
    copy: copy({ ...ENQUIRY_SUCCESS, submit_label: "Submit" }),
    fields: enquiryFields({
      intent: true,
      messageLabel: "Tell us more",
      messagePlaceholder: "Tell us about your brief — area, budget, timeline.",
      messageRows: 5,
      paired: true,
    }),
  },
  {
    key: "rent_hero_enquiry",
    name: "Rent a property",
    surface: "Rent",
    path: "/rent",
    description: "The enquiry card beside the Rent hero.",
    group: "master",
    handler: "enquiry",
    control: "full",
    variant: "stacked",
    enquirySource: "contact_page",
    headingSource: {
      pageKey: "rent",
      sectionKey: "hero_form",
      note: "The card's heading and sub-copy.",
    },
    copy: copy({ ...ENQUIRY_SUCCESS, submit_label: "Submit" }),
    fields: enquiryFields({
      intent: true,
      messageLabel: "Tell us more",
      messagePlaceholder: "Tell us about your brief — area, budget, timeline.",
      messageRows: 5,
      paired: true,
    }),
  },
  {
    key: "rent_lead_band",
    name: "Tell us what you're looking to rent",
    surface: "Rent",
    path: "/rent",
    description: "The full-width lead band lower down the Rent page.",
    group: "master",
    handler: "enquiry",
    control: "full",
    variant: "stacked",
    enquirySource: "contact_page",
    headingSource: {
      pageKey: "rent",
      sectionKey: "lead_band",
      note: "Eyebrow, headline, sub-copy and the photo beside the form.",
    },
    copy: copy({ ...ENQUIRY_SUCCESS, submit_label: "Submit" }),
    fields: enquiryFields({
      intent: true,
      messageLabel: "Tell us more",
      messagePlaceholder: "Tell us about your brief — area, budget, timeline.",
      messageRows: 5,
      paired: true,
    }),
  },
  {
    key: "commercial_hero_enquiry",
    name: "Commercial enquiry",
    surface: "Commercial",
    path: "/commercial",
    description: "The enquiry card beside the Commercial hero.",
    group: "master",
    handler: "enquiry",
    control: "full",
    variant: "stacked",
    enquirySource: "contact_page",
    headingSource: {
      pageKey: "commercial",
      sectionKey: "hero_form",
      note: "The card's heading and sub-copy.",
    },
    copy: copy({ ...ENQUIRY_SUCCESS, submit_label: "Submit" }),
    fields: enquiryFields({
      intent: true,
      messageLabel: "Tell us more",
      messagePlaceholder: "Tell us about your brief — area, budget, timeline.",
      messageRows: 5,
      paired: true,
    }),
  },
  {
    key: "commercial_lead_band",
    name: "Commercial lead band",
    surface: "Commercial",
    path: "/commercial",
    description: "The full-width lead band lower down the Commercial page.",
    group: "master",
    handler: "enquiry",
    control: "full",
    variant: "stacked",
    enquirySource: "contact_page",
    headingSource: {
      pageKey: "commercial",
      sectionKey: "lead_band",
      note: "Eyebrow, headline, sub-copy and the photo beside the form.",
    },
    copy: copy({ ...ENQUIRY_SUCCESS, submit_label: "Submit" }),
    fields: enquiryFields({
      intent: true,
      messageLabel: "Tell us more",
      messagePlaceholder: "Tell us about your brief — area, budget, timeline.",
      messageRows: 5,
      paired: true,
    }),
  },

  // ──────────────────────────── sub-pages ─────────────────────────────
  {
    key: "development_interest",
    name: "Register your interest",
    surface: "Project page",
    path: "/developments",
    description:
      "The dialog behind the hero button on every off-plan project page. The lead is stamped with the project it came from.",
    group: "sub",
    handler: "enquiry",
    control: "full",
    variant: "compact",
    enquirySource: "development_interest",
    messagePrefill: "I'd like to register my interest in {project}.",
    copy: copy({
      ...ENQUIRY_SUCCESS,
      title: "Express your interest in {project}",
      subtitle:
        "Leave your details and the advisor for {project} will come back with pricing, availability and the payment plan.",
      submit_label: "Register my interest",
      success_title: "Interest registered.",
    }),
    fields: enquiryFields({
      intent: false,
      messageLabel: "Message",
      messagePlaceholder: "What would you like to know?",
      messageRows: 3,
      paired: false,
    }),
  },
  {
    key: "development_brochure",
    name: "Download the brochure",
    surface: "Project page",
    path: "/developments",
    description:
      "The gate in front of a project's brochure PDF. Captures a contactable lead, then opens the file.",
    group: "sub",
    handler: "enquiry",
    control: "full",
    variant: "compact",
    enquirySource: "brochure",
    briefPrefix: "Brochure request — {project}.",
    copy: copy({
      title: "Get the {project} brochure",
      subtitle: "Tell us where to reach you and the PDF opens straight away.",
      submit_label: "Request the brochure",
      pending_label: "Sending…",
      success_title: "Your {project} brochure",
      success_body:
        "We've passed your details to the advisor for this project — they'll send the brochure shortly.",
      consent_note: null,
    }),
    fields: [
      fullName({ label: "Full name", placeholder: null }),
      email({ required: true }),
      phone({
        label: "Phone number",
        placeholder: "+971 50 123 4567",
        required: true,
      }),
    ],
  },
  {
    key: "development_floorplan",
    name: "Unlock a floor plan",
    surface: "Project page",
    path: "/developments",
    description:
      "The gate in front of an individual floor plan. Shorter than the brochure gate on purpose — email and name only.",
    group: "sub",
    handler: "enquiry",
    control: "copy",
    variant: "compact",
    enquirySource: "brochure",
    copy: copy({
      title: "See this floor plan",
      subtitle: "Leave an email and the plan opens right here.",
      submit_label: "Show me the plan",
      pending_label: "Unlocking…",
      success_title: "Unlocked.",
      success_body: "The plan is below, and a copy is on its way to your inbox.",
      consent_note: null,
    }),
    fields: [
      email({ required: true, locked: true }),
      fullName({ label: "Your name", placeholder: null }),
    ],
  },
  {
    key: "property_enquiry",
    name: "Enquire about this property",
    surface: "Property page",
    path: "/p",
    description:
      "The enquiry dialog on a listing. Routes straight to the advisor who owns the listing.",
    group: "sub",
    handler: "enquiry",
    control: "full",
    variant: "compact",
    enquirySource: "property_page",
    messagePrefill: "I'd like to know more about {reference}.",
    copy: copy({
      ...ENQUIRY_SUCCESS,
      submit_label: "Send enquiry",
    }),
    fields: enquiryFields({
      intent: false,
      messageLabel: "Message",
      messagePlaceholder: "What would you like to know?",
      messageRows: 3,
      paired: false,
    }),
  },
  {
    key: "services_sell_list_property",
    name: "List Your Property",
    surface: "Sell with Bazar",
    path: "/services/sell",
    description:
      "The two-step owner qualification form: the property first, the callback second. Issues a BZ-SL / BZ-RL reference the owner can quote.",
    group: "sub",
    handler: "list_property",
    control: "copy",
    variant: "stacked",
    enquirySource: "list_property",
    headingSource: {
      pageKey: "sell",
      sectionKey: "form",
      note: "Step headings, helper copy and the confirmation panel.",
    },
    copyFromPage: true,
    copy: copy({
      submit_label: "Book my call",
      pending_label: "Sending…",
      success_title: "You're booked.",
      success_body:
        "An advisor will call you in the window you picked. Your reference is on screen — quote it if you call us first.",
      consent_note:
        "Consented to contact by phone, WhatsApp and email.",
    }),
    fields: [
      field("intent", "I want to", "chips", "intent", {
        required: true,
        options: options(["Sell", "sell"], ["Rent out", "rent_out"]),
      }),
      field("location", "Where is the property?", "text", "custom", {
        placeholder: "Community or building",
        required: true,
        optionSource: "areas",
      }),
      field("category", "Category", "chips", "custom", {
        required: true,
        options: options(["Residential", "residential"], ["Commercial", "commercial"]),
      }),
      field("property_type", "Property type", "select", "custom", {
        required: true,
        optionSource: "property_types",
      }),
      field("bedrooms", "Bedrooms", "select", "custom", {
        options: options("Studio", "1", "2", "3", "4", "5", "6", "7", "8+"),
        note: "Hidden for land and commercial plots.",
      }),
      field("area_sqft", "Built-up area", "number", "custom", {
        placeholder: "1,450",
        min: 100,
        max: 2_000_000,
      }),
      field("furnishing", "Furnishing", "select", "custom", {
        options: options(
          ["Unfurnished", "unfurnished"],
          ["Semi-furnished", "semi_furnished"],
          ["Fully furnished", "fully_furnished"],
        ),
      }),
      field("urgency", "How soon?", "chips", "timeline", {
        options: options(
          ["This month", "this_month"],
          ["Within 2 months", "two_months"],
          ["Flexible", "flexible"],
        ),
      }),
      fullName({ label: "Your name", placeholder: null, locked: true }),
      field("mobile", "Mobile", "tel", "phone", {
        placeholder: "50 123 4567",
        required: true,
        locked: true,
        note: "UAE numbers only — validated against the national format.",
      }),
      email({ required: true, locked: true }),
      field("call_window", "Best time to call", "chips", "custom", {
        required: true,
        options: options(
          ["Morning", "morning"],
          ["Afternoon", "afternoon"],
          ["Evening", "evening"],
        ),
      }),
      field("consent", "Consent to be contacted", "checkbox", "consent", {
        required: true,
        locked: true,
      }),
    ],
  },
  {
    key: "services_manage_lead",
    name: "Let Us Manage Your Property",
    surface: "Property management",
    path: "/services/manage",
    description:
      "The owner lead on the management landing — contact block plus where the property is and what it is.",
    group: "sub",
    handler: "service_lead",
    control: "full",
    variant: "compact",
    enquirySource: "property_management",
    headingSource: {
      pageKey: "manage",
      sectionKey: "hero_form",
      note: "The card's heading and sub-heading.",
    },
    copyFromPage: true,
    copy: copy({
      submit_label: "Send",
      pending_label: "Sending…",
      success_title: "Thank you — we have your details.",
      success_body:
        "One of our property consultants will be in contact with you shortly.",
      consent_note: null,
    }),
    fields: [
      ...serviceContactFields(),
      field("location", "Property Location", "text", "custom", {
        placeholder: "Community or building",
        // The suggestions are a datalist, not a dropdown — the list covers the
        // communities on file and an owner whose building isn't on it still has
        // to be able to type it. No helper text: the page never had any.
        optionSource: "areas",
        width: "half",
      }),
      field("property_type", "Property Type", "select", "custom", {
        placeholder: "Select a type",
        optionSource: "property_types",
        width: "half",
      }),
      message("Message", {
        required: false,
        rows: 4,
        placeholder:
          "Anything we should know about the property or the tenancy?",
      }),
    ],
  },
  {
    key: "services_consultation_lead",
    name: "Get a Free Property Consultation",
    surface: "Property consultation",
    path: "/services/consultation",
    description:
      "The consultation lead — contact block plus what the visitor is trying to do.",
    group: "sub",
    handler: "service_lead",
    control: "full",
    variant: "compact",
    enquirySource: "property_consultation",
    headingSource: {
      pageKey: "consultation",
      sectionKey: "hero_form",
      note: "The card's heading, sub-heading and the interest options.",
    },
    copyFromPage: true,
    copy: copy({
      submit_label: "Send",
      pending_label: "Sending…",
      success_title: "Thank you — we have your details.",
      success_body:
        "One of our property consultants will be in contact with you shortly.",
      consent_note: null,
    }),
    fields: [
      ...serviceContactFields(),
      field("interest", "I'm Interested In", "chips", "custom", {
        optionSource: "consultation_interests",
        note: "The options are edited on the Property consultation page in Pages & blocks.",
      }),
      message("Message", {
        required: false,
        rows: 4,
        placeholder: "Tell us what you're looking for.",
      }),
    ],
  },

  {
    key: "contact_qr_enquiry",
    name: "Tell us what you're after",
    surface: "QR contact card",
    path: "/contact-qr",
    description:
      "The short enquiry form on the scan-to-contact card, for visitors who would rather write than call. Off by default on the page itself.",
    group: "sub",
    handler: "enquiry",
    control: "full",
    variant: "compact",
    enquirySource: "contact_page",
    headingSource: {
      pageKey: "contact-qr",
      sectionKey: "enquiry_form",
      note: "The eyebrow, heading and blurb above the form — and whether the section shows at all.",
    },
    copy: copy({ ...ENQUIRY_SUCCESS, submit_label: "Send enquiry" }),
    fields: enquiryFields({
      intent: false,
      messageLabel: "Message",
      messagePlaceholder: "What would you like to know?",
      messageRows: 3,
      paired: false,
    }),
  },

  {
    key: "areas_guide_consultation",
    name: "Request a free consultation",
    surface: "Area guide",
    path: "/areas",
    description:
      "The consultation form in every area guide's sidebar. Asks two things the generic enquiry form doesn't — property type and budget band — and stamps the brief with the community.",
    group: "sub",
    handler: "enquiry",
    control: "full",
    variant: "compact",
    enquirySource: "property_consultation",
    briefPrefix: "Area: {area}.",
    copy: copy({
      submit_label: "Request a free consultation",
      pending_label: "Sending…",
      ...ENQUIRY_SUCCESS,
      success_body:
        "We've received your brief for {area}. An advisor will reach out within 2 hours during business hours, and by next morning otherwise.",
    }),
    fields: [
      fullName({ label: "Full name", width: "half" }),
      phone({ label: "Phone number", width: "half" }),
      email({ label: "Email address" }),
      field("intent", "I'm interested in", "chips", "intent", {
        options: [
          { label: "Buying", value: "buy", intent: "buy" },
          { label: "Renting", value: "rent", intent: "rent" },
          { label: "Investing", value: "invest", intent: "invest" },
          { label: "Selling", value: "sell", intent: "sell" },
        ],
      }),
      field("property_type", "Property type", "chips", "custom", {
        options: options(
          "Apartment",
          "Villa",
          "Townhouse",
          "Penthouse",
          "Plot / land",
          "Commercial",
        ),
      }),
      // Bounds ride in the option value as "min:max", blank meaning open-ended
      // — see the `budget_band` case in lib/forms/submission.ts.
      field("budget", "Budget", "chips", "budget_band", {
        options: options(
          ["Under AED 1M", ":1000000"],
          ["AED 1M – 2M", "1000000:2000000"],
          ["AED 2M – 4M", "2000000:4000000"],
          ["AED 4M – 8M", "4000000:8000000"],
          ["AED 8M – 15M", "8000000:15000000"],
          ["AED 15M+", "15000000:"],
        ),
      }),
      message("Message", {
        required: false,
        rows: 4,
        placeholder: "What are you looking for in {area}?",
      }),
    ],
  },

  // ───────────────────────── dialogs & tools ──────────────────────────
  {
    key: "valuation_report_gate",
    name: "Get the full advisor report",
    surface: "Valuation tool",
    path: "/tools/valuation",
    description:
      "The email-verified gate in front of the advisor-prepared valuation report. Sends a six-digit code before the lead is written, so only verified addresses land in Responses.",
    group: "dialog",
    handler: "valuation",
    // The two-step OTP flow draws its own inputs. Visibility, copy, the button
    // and the responses are managed; the field list is shown read-only.
    control: "copy",
    variant: "compact",
    alsoOn: ["Area guides", "Property pages"],
    copy: copy({
      title: "Get the full advisor report",
      subtitle:
        "A Bazar advisor reviews the instant estimate against the latest comparables and sends you the prepared PDF within 24 hours.",
      submit_label: "Email me a code",
      pending_label: "Sending…",
      success_title: "You're verified.",
      success_body:
        "A Bazar advisor will review your figures and send the full report within 24 hours.",
      consent_note:
        "We use your email for the verification code and the report delivery. See our privacy notice for what happens next.",
    }),
    fields: [
      email({ required: true, locked: true }),
      fullName({
        label: "Name (optional)",
        placeholder: "So we know how to address the report",
        required: false,
      }),
      phone({ label: "Phone (optional)", placeholder: "+971 50 …" }),
      field("intent", "I'm thinking about…", "select", "custom", {
        required: true,
        options: options(
          ["Just curious about value", "curious"],
          ["Selling soon", "sell"],
          ["Refinancing", "refinance"],
          ["Something else", "other"],
        ),
      }),
    ],
  },
];

export const FORM_KEYS = FORM_DEFS.map((f) => f.key);

export function getFormDef(key: string): FormDef | null {
  return FORM_DEFS.find((f) => f.key === key) ?? null;
}

export function isFormKey(key: string): boolean {
  return FORM_DEFS.some((f) => f.key === key);
}
