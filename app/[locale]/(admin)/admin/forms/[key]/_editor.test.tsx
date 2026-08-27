import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const saveForm = vi.fn(
  async (_payload: unknown) => ({ status: "ok" as const, message: "Saved." }),
);
vi.mock("../_actions", () => ({
  saveForm: (payload: unknown) => saveForm(payload),
  resetForm: vi.fn(),
  registryFieldsFor: vi.fn(async () => []),
  setSubmissionStatus: vi.fn(),
}));

import { FormEditor } from "./_editor";
import { resolveForm, type StoredField } from "@/lib/forms/resolve";
import type { FormSaveInput } from "@/lib/schemas/form";

/**
 * The admin route is auth-gated, so this is where the field editor is actually
 * exercised — and what it guards is the promise the Arabic epic made: every
 * string a visitor reads is reachable in both languages from the CMS.
 *
 * An option's label is the chip the visitor taps. It was the one string on
 * this panel with no Arabic control, and `toSaveField` dropped `label_ar` on
 * the way out, so a save destroyed whatever was stored. Both halves fail
 * silently — the generated store refills a blank twin from the English on
 * read, which hides the loss right up until an editor renames an option.
 */

/** Exactly the shape production holds for `contact_enquiry`'s intent field. */
function storedIntent(options?: unknown[]): StoredField {
  return {
    key: "intent",
    label: "I'm looking to",
    label_ar: null,
    type: "chips",
    mapping: "intent",
    placeholder: null,
    placeholder_ar: null,
    help: null,
    help_ar: null,
    required: false,
    enabled: true,
    width: "full",
    options: options ?? [
      { label: "Buy", value: "buy", intent: "buy" },
      { label: "Sell", value: "sell", intent: "sell" },
      { label: "Rent", value: "rent", intent: "rent" },
    ],
    optionSource: null,
    position: 40,
  } as unknown as StoredField;
}

function mount(fields: StoredField[] = [storedIntent()]) {
  const form = resolveForm(
    "contact_enquiry",
    { enabled: true, copy: {}, notify_emails: [] } as never,
    fields,
  )!;
  return render(
    <FormEditor form={form} submissions={[]} submissionsError={null} />,
  );
}

/** Open the Fields tab and expand the intent field. */
async function openIntent(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^fields$/i }));
  await user.click(screen.getByText(/I'm looking to/i));
}

/** The option row holding a given English label, twin and all. */
function optionRow(label: string): HTMLElement {
  return screen.getByDisplayValue(label).closest("div.flex-col") as HTMLElement;
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /save changes/i }));
}

function savedOptions(key: string) {
  const payload = saveForm.mock.calls.at(-1)![0] as FormSaveInput;
  return payload.fields.find((f) => f.key === key)?.options ?? [];
}

describe("option labels", () => {
  it("offers an Arabic twin for every option", async () => {
    const user = userEvent.setup();
    mount();
    await openIntent(user);

    for (const label of ["Buy", "Sell", "Rent"]) {
      expect(
        within(optionRow(label)).getByRole("button", { name: /العربية/ }),
      ).toBeInTheDocument();
    }
  });

  it("saves the Arabic an editor types against an option", async () => {
    saveForm.mockClear();
    const user = userEvent.setup();
    mount();
    await openIntent(user);

    const row = optionRow("Buy");
    await user.click(within(row).getByRole("button", { name: /العربية/ }));
    // The twin opens pre-filled from the generated store — the machine first
    // draft ADR-0008 describes — so this is an editor overriding it, which is
    // the whole point of the control.
    const twin = row.querySelector("input[lang='ar']") as HTMLInputElement;
    expect(twin.value).toBe("شراء");
    await user.clear(twin);
    await user.type(twin, "شراء عقار");
    await save(user);

    expect(savedOptions("intent")[0]).toMatchObject({
      label: "Buy",
      label_ar: "شراء عقار",
    });
  });

  it("keeps a stored Arabic through a save that never touched it", async () => {
    saveForm.mockClear();
    const user = userEvent.setup();
    mount([
      storedIntent([
        { label: "Buy", value: "buy", intent: "buy", label_ar: "شراء" },
        { label: "Sell", value: "sell", intent: "sell", label_ar: "بيع" },
        { label: "Rent", value: "rent", intent: "rent", label_ar: "إيجار" },
      ]),
    ]);
    await openIntent(user);

    // Renaming is the exact move that used to take the Arabic with it: a
    // renamed label no longer matches the generated store's key, so nothing
    // refilled the twin the save had just dropped.
    const buy = screen.getByDisplayValue("Buy");
    await user.clear(buy);
    await user.type(buy, "Purchase");
    await save(user);

    expect(savedOptions("intent")).toEqual([
      { label: "Purchase", label_ar: "شراء", value: "buy", intent: "buy" },
      { label: "Sell", label_ar: "بيع", value: "sell", intent: "sell" },
      { label: "Rent", label_ar: "إيجار", value: "rent", intent: "rent" },
    ]);
  });

  it("names each option's delete button after the option", async () => {
    // "Remove this option" three times reads as one control to anyone
    // navigating by accessible name, and they do different things.
    const user = userEvent.setup();
    mount();
    await openIntent(user);

    expect(
      screen.getByRole("button", { name: /remove the buy option/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove the sell option/i }),
    ).toBeInTheDocument();
  });
});
