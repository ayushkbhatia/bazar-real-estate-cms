import type { SelectFieldDef } from "@/lib/master-pages";
import type { BlockDef } from "../types";

/**
 * Project sections — the bands of a project's own page, placed on a campaign.
 *
 * A launch campaign wants exactly what /developments/<slug> already shows: the
 * payment plan and its calculator, the master plan, the unit types with their
 * layouts, the map. Rebuilding those per campaign would mean retyping a
 * payment schedule into a page that then drifts from the record the day the
 * developer changes it. So each block here names a project and renders that
 * project's own section through the component the project page uses, and an
 * edit in Developments reaches every campaign that shows it.
 *
 * What the editor owns is the framing — eyebrow, heading, standfirst — and the
 * defaults are the wording every project page already publishes
 * (`lib/master-pages/development-page.ts`), so an unedited block says what the
 * project page says.
 *
 * All five read ONE fetch between them (`sharedQuery: "projects"`), however
 * many are on the page and however many projects they name.
 */

/** The pick every project section starts with. */
const projectPick: SelectFieldDef = {
  key: "development",
  label: "Project",
  kind: "select",
  optionsKey: "developments",
  placeholder: "Choose a project",
  help: "The section below the heading comes from this project's record",
};

const DATA_NOTE =
  "Everything below the heading comes from the project's record in Developments — edit it there and every page showing it follows.";

/** The project's headline figures — a light band under the hero. */
export const projectFacts: BlockDef = {
  key: "project_facts",
  label: "Key facts",
  description:
    "The project's headline figures — starting price, bedrooms, total units, handover and payment plan — read live from its record.",
  group: "project",
  needs: ["project"],
  sharedQuery: "projects",
  pickRequired: { key: "development", noun: "project" },
  dataNote: DATA_NOTE,
  fields: [
    projectPick,
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 80, optional: true },
    {
      key: "heading",
      label: "Heading",
      kind: "text",
      max: 160,
      optional: true,
      placeholder: "Blank uses the project's name",
    },
    {
      key: "intro",
      label: "Standfirst",
      kind: "textarea",
      max: 400,
      optional: true,
      placeholder: "Blank uses the project's own description, if it has one",
    },
  ],
  defaults: {
    development: null,
    eyebrow: "At a glance",
    heading: null,
    intro: null,
  },
};

/** Cash-flow timeline + calculator — `PaymentPlanSection`. */
export const projectPaymentPlan: BlockDef = {
  key: "project_payment_plan",
  label: "Payment plan",
  description:
    "The project's payment schedule as a timeline, with the calculator that prices each milestone and the PDF download.",
  group: "project",
  needs: ["project", "project_units"],
  sharedQuery: "projects",
  pickRequired: {
    key: "development",
    noun: "project",
    requires: "payment_plan",
  },
  dataNote: DATA_NOTE,
  fields: [
    projectPick,
    {
      key: "eyebrow",
      label: "Eyebrow",
      kind: "text",
      max: 80,
      optional: true,
      placeholder: "Blank shows “Payment plan · ” and the plan's name",
    },
    { key: "heading", label: "Heading", kind: "text", max: 160 },
    {
      key: "intro",
      label: "Standfirst",
      kind: "textarea",
      max: 400,
      optional: true,
    },
  ],
  defaults: {
    development: null,
    eyebrow: null,
    heading: "Payment Plan",
    intro: null,
  },
};

/** The site plan with its numbered pins. */
export const projectMasterPlan: BlockDef = {
  key: "project_master_plan",
  label: "Master plan",
  description:
    "The project's site plan — the layout of the community — with its numbered points of interest.",
  group: "project",
  needs: ["project"],
  sharedQuery: "projects",
  pickRequired: {
    key: "development",
    noun: "project",
    requires: "master_plan",
  },
  dataNote: `${DATA_NOTE} The site plan is the image in the project's Page images card.`,
  fields: [
    projectPick,
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 80, optional: true },
    { key: "heading", label: "Heading", kind: "text", max: 160 },
    {
      key: "intro",
      label: "Standfirst",
      kind: "textarea",
      max: 400,
      optional: true,
    },
  ],
  defaults: {
    development: null,
    eyebrow: "Explore the Project",
    heading: "Master Plan",
    intro: null,
  },
};

/** Unit-type tabs and their layouts — `UnitFloorPlans`. */
export const projectUnitPlans: BlockDef = {
  key: "project_unit_plans",
  label: "Floor plans",
  description:
    "A button per unit type — studio, one bedroom, and so on — each opening its layouts, with a full-screen viewer.",
  group: "project",
  needs: ["project", "project_unit_types"],
  sharedQuery: "projects",
  pickRequired: {
    key: "development",
    noun: "project",
    requires: "unit_types",
  },
  dataNote: `${DATA_NOTE} If the project gates its layouts behind a form, this section does too.`,
  fields: [
    projectPick,
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 80, optional: true },
    { key: "heading", label: "Heading", kind: "text", max: 160 },
    {
      key: "intro",
      label: "Standfirst",
      kind: "textarea",
      max: 400,
      optional: true,
    },
  ],
  defaults: {
    development: null,
    eyebrow: "Browse the Options",
    heading: "Units & Floor Plans",
    intro: "Choose the layout that best suits your lifestyle.",
  },
};

/** The project's pin on the map — `MapEmbed`. */
export const projectLocation: BlockDef = {
  key: "project_location",
  label: "Location map",
  description:
    "An interactive map centred on the project. The map loads only as the visitor scrolls to it.",
  group: "project",
  needs: ["project"],
  sharedQuery: "projects",
  pickRequired: {
    key: "development",
    noun: "project",
    requires: "location",
  },
  dataNote: `${DATA_NOTE} The pin is the project's map location.`,
  fields: [
    projectPick,
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 80, optional: true },
    { key: "heading", label: "Heading", kind: "text", max: 160 },
    {
      key: "intro",
      label: "Standfirst",
      kind: "textarea",
      max: 400,
      optional: true,
    },
  ],
  defaults: {
    development: null,
    eyebrow: "Explore the Area",
    heading: "Location",
    intro: "See where the community is located and what’s nearby.",
  },
};

export const PROJECT_BLOCKS = [
  projectFacts,
  projectPaymentPlan,
  projectMasterPlan,
  projectUnitPlans,
  projectLocation,
];
