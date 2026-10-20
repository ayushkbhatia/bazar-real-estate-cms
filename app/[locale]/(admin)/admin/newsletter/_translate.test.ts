import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://project-one.supabase.co" },
  isSupabaseConfigured: true,
}));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({ user: { id: "u" } })) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
const configured = { value: true };
vi.mock("@/lib/concierge/env", () => ({
  anthropicEnv: { ANTHROPIC_API_KEY: "test" },
  get isAnthropicConfigured() {
    return configured.value;
  },
}));
vi.mock("@/lib/i18n/mt/hf-client", () => ({
  mtClientFromEnv: async () => ({ client: {}, proseModel: "m", fastModel: "m", provider: "anthropic" }),
}));
// A "model" that wraps every unit in Arabic brackets, markers untouched, and
// refuses any unit containing the word REFUSE.
const translateField = vi.fn(async ({ text }: { text: string }) =>
  text.includes("REFUSE") ? { ok: false, issues: [], raw: "" } : { ok: true, text: `«${text}»`, model: "m", retried: false },
);
vi.mock("@/lib/i18n/mt/translate", () => ({ translateField: (a: { text: string }) => translateField(a) }));

const { translateNewsletter } = await import("./_translate");
const { featureBlocksIn } = await import("@/lib/content-assets/email-feature");

const P1 = "11111111-0000-0000-0000-000000000001";
const block = `<div data-email-feature="property" data-ids="${P1}" data-layout="grid" data-labels="[&quot;Villa&quot;]"></div>`;

beforeEach(() => {
  configured.value = true;
  translateField.mockClear();
});

describe("translateNewsletter", () => {
  it("translates text, carries featured blocks over untouched, and points site links at /ar", async () => {
    const r = await translateNewsletter("c1", {
      subject: "October",
      preheader: "",
      body: `<h2>New</h2><p>See <a href="/insights/x">this</a>.</p>${block}<a data-email-button href="{{contact_url}}">Talk</a>`,
    });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.subject_ar).toBe("«October»");
    expect(r.body_ar).toContain("«New»");
    expect(r.body_ar).toContain('href="/ar/insights/x"');
    expect(r.body_ar).toContain("{{contact_url}}");
    expect(featureBlocksIn(r.body_ar)).toEqual(featureBlocksIn(block));
    // The block has no words, so nothing of it went to the model.
    expect(translateField.mock.calls.every(([a]) => !String(a.text).includes("data-ids"))).toBe(true);
    expect(r.notes).toEqual([]);
  });

  it("keeps the English of a rejected paragraph and says so", async () => {
    const r = await translateNewsletter("c1", { subject: "S", preheader: "", body: "<p>One</p><p>REFUSE two</p>" });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.body_ar).toContain("REFUSE two");
    expect(r.notes.join(" ")).toMatch(/1 of 2 paragraphs kept their English/);
  });

  it("fails closed without a model key, and refuses an empty English", async () => {
    configured.value = false;
    expect((await translateNewsletter("c1", { subject: "S", preheader: "", body: "<p>x</p>" })).status).toBe("error");
    configured.value = true;
    expect((await translateNewsletter("c1", { subject: "", preheader: "", body: "<p></p>" })).status).toBe("error");
    expect(translateField).not.toHaveBeenCalled();
  });
});
