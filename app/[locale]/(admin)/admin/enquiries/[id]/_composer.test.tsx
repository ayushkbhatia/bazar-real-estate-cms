import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnquiryComposer, type ComposerAsset } from "./_composer";
import type { SendTouchResult, TouchChannel } from "../_actions";

afterEach(cleanup);

const EMAIL_ASSET: ComposerAsset = {
  id: "a1",
  name: "First response",
  subject: "Re: {{property_reference}}",
  body: "Thank you for your enquiry about {{property_title}}, {{lead_first_name}}.",
  notes: "Send within two hours.",
  followUpAfterDays: 3,
  nextName: "Revival nudge",
};

const WA_ASSET: ComposerAsset = {
  id: "a2",
  name: "First touch",
  subject: null,
  body: "Hello {{lead_first_name}}, about {{property_reference}}.",
  notes: null,
  followUpAfterDays: null,
  nextName: null,
};

const FULL_CONTEXT = {
  lead_first_name: "Amira",
  lead_name: "Amira Haddad",
  property_reference: "BAZ-AD-04891",
  property_title: "3-bed on Al Reem",
};

function setup(
  overrides: Partial<Parameters<typeof EnquiryComposer>[0]> = {},
) {
  const send = vi.fn(
    async (
      _id: string,
      _input: { channel: TouchChannel; body: string; subject?: string | null },
    ): Promise<SendTouchResult> => ({
      status: "ok",
      messageId: "m1",
      message: "Sent.",
    }),
  );
  render(
    <EnquiryComposer
      enquiryId="e1"
      tokenContext={FULL_CONTEXT}
      hasEmail
      hasPhone
      assets={{ email: [EMAIL_ASSET], whatsapp: [WA_ASSET] }}
      send={send}
      {...overrides}
    />,
  );
  return { send };
}

describe("EnquiryComposer", () => {
  it("offers all three next steps", () => {
    setup();
    expect(screen.getByRole("button", { name: /email lead/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /whatsapp lead/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /log a call/i })).toBeTruthy();
  });

  it("fills subject and body from a template, tokens resolved", async () => {
    const user = userEvent.setup();
    setup();
    await user.selectOptions(screen.getByRole("combobox"), "a1");

    const body = screen.getByLabelText(/email lead/i) as HTMLTextAreaElement;
    expect(body.value).toBe(
      "Thank you for your enquiry about 3-bed on Al Reem, Amira.",
    );
    expect(body.value).not.toContain("{{");
    expect(
      (screen.getByPlaceholderText("Subject") as HTMLInputElement).value,
    ).toBe("Re: BAZ-AD-04891");
  });

  it("shows the sequencing note and what follows", async () => {
    const user = userEvent.setup();
    setup();
    await user.selectOptions(screen.getByRole("combobox"), "a1");
    expect(screen.getByText(/send within two hours/i)).toBeTruthy();
    expect(screen.getByText(/revival nudge/i)).toBeTruthy();
    // The sequence is advisory — the UI must not imply anything auto-sends.
    expect(screen.getByText(/manual step/i)).toBeTruthy();
  });

  it("warns when a token fell back to generic wording", async () => {
    const user = userEvent.setup();
    setup({ tokenContext: { lead_first_name: "Amira" } });
    await user.selectOptions(screen.getByRole("combobox"), "a1");
    // property_reference and property_title have no value on this lead.
    expect(screen.getByText(/property reference/i)).toBeTruthy();
    expect(screen.getByText(/generic wording/i)).toBeTruthy();
  });

  it("stays quiet when every token resolves", async () => {
    const user = userEvent.setup();
    setup();
    await user.selectOptions(screen.getByRole("combobox"), "a1");
    expect(screen.queryByText(/generic wording/i)).toBeNull();
  });

  it("sends on the channel of the active tab", async () => {
    const user = userEvent.setup();
    const { send } = setup();
    await user.type(screen.getByLabelText(/email lead/i), "Hello there");
    await user.click(screen.getByRole("button", { name: /send email/i }));
    expect(send).toHaveBeenCalledWith("e1", {
      channel: "email",
      body: "Hello there",
      subject: "",
    });
  });

  it("drops the subject on non-email channels", async () => {
    const user = userEvent.setup();
    const { send } = setup();
    await user.click(screen.getByRole("button", { name: /whatsapp lead/i }));
    await user.type(screen.getByLabelText(/whatsapp lead/i), "Hello there");
    await user.click(screen.getByRole("button", { name: /open whatsapp/i }));
    expect(send).toHaveBeenCalledWith("e1", {
      channel: "whatsapp",
      body: "Hello there",
      subject: null,
    });
  });

  it("clears the draft when switching channel", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/email lead/i), "email-shaped copy");
    await user.click(screen.getByRole("button", { name: /whatsapp lead/i }));
    expect((screen.getByLabelText(/whatsapp lead/i) as HTMLTextAreaElement).value)
      .toBe("");
  });

  it("explains why a channel is unavailable instead of failing on send", async () => {
    const user = userEvent.setup();
    const { send } = setup({ hasEmail: false });
    await user.click(screen.getByRole("button", { name: /email lead/i }));
    expect(screen.getByText(/no email address on file/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /send email/i })).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("opens on a channel the lead can actually be reached on", () => {
    setup({ hasEmail: false });
    // Defaults to WhatsApp rather than the dead email tab.
    expect(screen.getByLabelText(/whatsapp lead/i)).toBeTruthy();
  });

  it("says a logged call is not sent to the lead", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /log a call/i }));
    expect(screen.getByText(/nothing is sent to the lead/i)).toBeTruthy();
  });

  it("describes WhatsApp as a handoff, not a delivery", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /whatsapp lead/i }));
    expect(screen.getByText(/opens whatsapp with this message/i)).toBeTruthy();
  });

  it("won't send an empty message", async () => {
    setup();
    const button = screen.getByRole("button", {
      name: /send email/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
