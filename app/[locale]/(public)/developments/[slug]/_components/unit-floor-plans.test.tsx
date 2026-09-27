import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ submitForm: vi.fn() }));

// The gate files through the shared forms action. What this spec checks is
// what the gate hands it; what the action does next has its own tests.
vi.mock("@/app/[locale]/(public)/_actions/forms", () => ({
  submitForm: mocks.submitForm,
}));
// `FormRenderer` holds a router for the forms that redirect to search.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { UnitFloorPlans } from "./unit-floor-plans";
import { renderWithIntl } from "@/lib/i18n/test-utils";
import type { Locale } from "@/lib/i18n/locales";
import { localiseDeep, localiseRow } from "@/lib/i18n/localise";
import { arabicFor } from "@/lib/i18n/arabic-store";
import { defaultForm, type ResolvedForm } from "@/lib/forms";
import { PreferencesProvider } from "@/lib/preferences";
import type { PlanCard, UnitTypeCard } from "@/lib/queries/development-unit-plans";
import arDevelopment from "@/messages/ar/development.json";

function plan(over: Partial<PlanCard> & { id: string }): PlanCard {
  return {
    label: "Type 1",
    description: null,
    beds: 1,
    baths: 1,
    area_ft2: 900,
    image_url: `https://cdn.test/${over.id}.png`,
    image_alt: null,
    image_key: `brand/${over.id}.png`,
    ...over,
  };
}

function type(over: Partial<UnitTypeCard> & { id: string }): UnitTypeCard {
  return {
    label: "Studio",
    beds: 0,
    blurb: null,
    size_from_ft2: null,
    size_to_ft2: null,
    price_from_aed: null,
    plans: [plan({ id: `${over.id}-a` })],
    placeholder: false,
    ...over,
  };
}

const TYPES: UnitTypeCard[] = [
  type({ id: "studio", label: "Studio" }),
  type({
    id: "one-bed",
    label: "1 Bedroom",
    plans: [
      plan({ id: "one-a", label: "Type 1" }),
      plan({ id: "one-b", label: "Type 2" }),
    ],
  }),
];

/**
 * The `development_floorplan` form as `getForm` hands it to the page: the
 * registry defaults, folded to the visitor's language.
 */
function floorplanForm(
  locale: Locale = "en",
  over: Partial<ResolvedForm> = {},
): ResolvedForm {
  const form = defaultForm("development_floorplan")!;
  return {
    ...form,
    copy: localiseRow(
      form.copy as Record<string, unknown>,
      locale,
    ) as ResolvedForm["copy"],
    fields: localiseDeep(form.fields, locale),
    ...over,
  };
}

/**
 * `renderWithIntl`, not `render`: the gated card reads the visitor's locale so
 * the email it triggers answers in the language they were reading, and a bare
 * `render()` leaves `useLocale()` with no provider to read.
 */
function renderSection(
  over: Partial<Parameters<typeof UnitFloorPlans>[0]> = {},
  locale: Locale = "en",
) {
  return renderWithIntl(
    <PreferencesProvider>
      <UnitFloorPlans
        types={TYPES}
        developmentName="The Artery Residences"
        developmentId="dev-artery"
        gated={false}
        floorplanForm={floorplanForm(locale)}
        heading={null}
        intro={null}
        eyebrow={null}
        {...over}
      />
    </PreferencesProvider>,
    { locale },
  );
}

/** Opens the first gated card's dialog and fills the three boxes. */
async function requestFirstLayout(labels: {
  trigger: string;
  name: string;
  email: string;
  phone: string;
  submit: string;
}) {
  await userEvent.click(
    screen.getAllByRole("button", { name: labels.trigger })[0]!,
  );
  const dialog = screen.getByRole("dialog");
  await userEvent.type(within(dialog).getByLabelText(labels.name), "Amira Saleh");
  await userEvent.type(
    within(dialog).getByLabelText(labels.email),
    "amira@example.com",
  );
  await userEvent.type(
    within(dialog).getByLabelText(labels.phone),
    "+971 50 123 4567",
  );
  await userEvent.click(
    within(dialog).getByRole("button", { name: labels.submit }),
  );
  return dialog;
}

const ENGLISH = {
  trigger: "Request layout",
  name: "Your name",
  email: "Email",
  phone: "Phone number",
  submit: "Show me the plan",
};

beforeEach(() => {
  mocks.submitForm.mockReset();
  mocks.submitForm.mockResolvedValue({ status: "ok", enquiryId: "enq-1" });
});

describe("UnitFloorPlans", () => {
  /**
   * The performance fix, as an assertion: an unselected type that isn't in the
   * DOM can't have been pre-loaded, so pressing its tab pays for the images.
   */
  it("mounts every type's layouts, not only the selected one", () => {
    renderSection();
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(panels).toHaveLength(2);
    expect(
      panels.flatMap((p) => within(p).getAllByRole("img", { hidden: true })),
    ).toHaveLength(3);
  });

  it("hides the unselected panels and points each tab at its own", () => {
    renderSection();
    const [studio, oneBed] = screen.getAllByRole("tabpanel", { hidden: true });
    expect(studio).not.toHaveAttribute("hidden");
    expect(oneBed).toHaveAttribute("hidden");
    // One panel each, not every tab pointing at whichever one is showing.
    const controlled = screen
      .getAllByRole("tab")
      .map((tab) => document.getElementById(tab.getAttribute("aria-controls")!));
    expect(controlled).toEqual([studio, oneBed]);
  });

  it("swaps which panel is hidden without unmounting the other", async () => {
    renderSection();
    const before = screen.getAllByRole("tabpanel", { hidden: true });
    await userEvent.click(screen.getByRole("tab", { name: "1 Bedroom" }));
    const after = screen.getAllByRole("tabpanel", { hidden: true });
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[0]).toHaveAttribute("hidden");
    expect(after[1]).not.toHaveAttribute("hidden");
  });

  /** No separate control: the drawing itself is the trigger. */
  it("opens the layout full screen from the image, with no enlarge button", async () => {
    renderSection();
    expect(screen.queryByRole("button", { name: /enlarge/i })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Type 1 — open full screen" }),
    );
    const dialog = screen.getByRole("dialog");
    // Asserts the modal CONTRACT, not the `aria-modal` attribute.
    //
    // This used to read `toHaveAttribute("aria-modal", "true")`, which the
    // hand-rolled overlay satisfied by writing the attribute on a plain div
    // while enforcing none of what it claims. Measured on the sibling gallery
    // before it was converted: the page scrolled 600px behind the open
    // lightbox and 12 of 15 tabs escaped it. The attribute was decoration.
    //
    // Radix does not set `aria-modal` — it takes the other route the spec
    // allows, marking the rest of the tree `aria-hidden` and holding focus.
    // So the honest assertion is that focus actually moved inside, which the
    // old markup would have failed and this one passes.
    expect(dialog.contains(document.activeElement)).toBe(true);
    // `selector: "p"` picks the VISIBLE caption. The overlay moved onto Radix
    // Dialog, which requires a Dialog.Title — it renders as an `sr-only` <h2>
    // carrying the same layout name, so a bare getByText now matches twice.
    // Both are wanted: the heading names the dialog for a screen reader, the
    // paragraph shows the caption. This asserts the one a sighted user reads.
    expect(
      within(dialog).getByText(/Studio · Type 1/, { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("walks the open type's other layouts and closes on Escape", async () => {
    renderSection();
    await userEvent.click(screen.getByRole("tab", { name: "1 Bedroom" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Type 1 — open full screen" }),
    );
    const dialog = screen.getByRole("dialog");
    // `selector: "p"` — see the note in the test above; Radix's Dialog.Title
    // renders the same name a second time as an sr-only heading.
    expect(
      within(dialog).getByText(/1 Bedroom · Type 1/, { selector: "p" }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Next layout" }),
    );
    expect(
      within(dialog).getByText(/1 Bedroom · Type 2/, { selector: "p" }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  /** The gated variant blurs the drawing behind a lead form — it must not open. */
  it("leaves gated layouts behind the request form", () => {
    renderSection({ gated: true });
    expect(screen.queryByRole("button", { name: /open full screen/i })).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /request layout/i }).length,
    ).toBeGreaterThan(0);
  });

  /**
   * The gate used to POST to the valuation route's code step, which never
   * wrote an enquiry and, once that route required a phone, answered every
   * request with a 400. It files through the forms action now — the one the
   * brochure gate uses — so the lead reaches Enquiries against the project.
   */
  it("files a gated request as a floor-plan lead against the project", async () => {
    renderSection({ gated: true, developmentId: "dev-files" });
    await requestFirstLayout(ENGLISH);

    expect(mocks.submitForm).toHaveBeenCalledTimes(1);
    const [key, values, context] = mocks.submitForm.mock.calls[0]!;
    expect(key).toBe("development_floorplan");
    // All three contact fields: Salesforce refuses a lead without a phone.
    expect(values).toMatchObject({
      name: "Amira Saleh",
      email: "amira@example.com",
      phone: "+971 50 123 4567",
    });
    expect(context).toMatchObject({
      developmentId: "dev-files",
      developmentName: "The Artery Residences",
      // Which drawing was asked for, so the brief can say.
      scenario: "Studio · Type 1",
      locale: "en",
    });
  });

  it("opens every layout of the project once the request is filed", async () => {
    renderSection({ gated: true, developmentId: "dev-unlocks" });
    const dialog = await requestFirstLayout(ENGLISH);

    expect(await within(dialog).findByText("Unlocked.")).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "See the plan" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    // Every layout in every tab, not only the one asked for — a second
    // request for the next drawing would file the same lead twice.
    expect(
      screen.queryAllByRole("button", { name: /request layout/i, hidden: true }),
    ).toHaveLength(0);
    expect(
      screen.getAllByRole("button", { name: /open full screen/i, hidden: true }),
    ).toHaveLength(3);

    // The button that opened the dialog is gone, so focus lands on the
    // drawing it revealed rather than falling back to the top of the page.
    const revealed = screen.getByRole("button", {
      name: "Type 1 — open full screen",
    });
    await waitFor(() => {
      // Not `body` — which would contain the card too, and is exactly where
      // focus falls when nothing hands it on.
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement?.contains(revealed)).toBe(true);
    });
  });

  it("keeps the layouts locked when the request is refused", async () => {
    mocks.submitForm.mockResolvedValueOnce({
      status: "error",
      message: "This form is closed at the moment.",
    });
    renderSection({ gated: true, developmentId: "dev-refused" });
    const dialog = await requestFirstLayout(ENGLISH);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "This form is closed at the moment.",
    );
    expect(within(dialog).queryByText("Unlocked.")).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getAllByRole("button", { name: /request layout/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /open full screen/i })).toBeNull();
  });

  /**
   * A lock with nothing behind it is a dead end: with the form switched off in
   * /admin/forms, or never loaded, the drawings show as if ungated.
   */
  it.each([
    ["switched off", floorplanForm("en", { enabled: false })],
    ["not loaded", null],
  ])("shows the layouts openly when the form is %s", (_, form) => {
    renderSection({ gated: true, floorplanForm: form });
    expect(screen.queryByRole("button", { name: /request layout/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Type 1 — open full screen" }),
    ).toBeInTheDocument();
  });

  /**
   * The advisor's reply to a gated request is written in the language the
   * visitor was reading, and that language is only knowable in the browser —
   * the email itself is sent later, from a request that no longer exists. So
   * the locale has to travel with the lead, and this asserts it leaves. The
   * gate itself asks in Arabic: the trigger from the catalogue, the dialog
   * and its fields from the form's own Arabic.
   */
  it("asks in Arabic on /ar and sends the visitor's locale", async () => {
    renderSection({ gated: true, developmentId: "dev-arabic" }, "ar");
    const ar = (english: string) => arabicFor(english)!;
    await userEvent.click(
      screen.getAllByRole("button", {
        name: arDevelopment.floorplanGate.request,
      })[0]!,
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(
        ar("Leave your details and the plan opens right here."),
      ),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await requestFirstLayout({
      trigger: arDevelopment.floorplanGate.request,
      name: ar("Your name"),
      email: ar("Email"),
      phone: ar("Phone number"),
      submit: ar("Show me the plan"),
    });
    expect(mocks.submitForm).toHaveBeenCalledTimes(1);
    expect(mocks.submitForm.mock.calls[0]![2]).toMatchObject({ locale: "ar" });
  });
});
