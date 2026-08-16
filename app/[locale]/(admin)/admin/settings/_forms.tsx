"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArabicTwin } from "../_fields/arabic-twin";
import {
  HERO_VARIANTS,
  HERO_VARIANT_DESCRIPTION,
  HERO_VARIANT_LABEL,
  ACCENT_TOKENS,
  ACCENT_TOKEN_HEX,
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_LABEL,
  brandSettingsSchema,
  displaySettingsSchema,
  emailTemplateOverrideSchema,
  leadRoutingSettingsSchema,
  mortgageSettingsSchema,
  MORTGAGE_SETTINGS_DEFAULTS,
  type BrandSettingsInput,
  type DisplaySettingsInput,
  type EmailTemplateKey,
  type EmailTemplatesOverrides,
  type LeadRoutingSettings,
  type LeadRoutingRule,
  type MortgageSettings,
} from "@/lib/schemas/site-settings";
import {
  resetEmailTemplate,
  updateBrandSettings,
  updateDisplaySettings,
  updateEmailTemplate,
  updateLeadRouting,
  updateMortgageSettings,
} from "./_actions";
import {
  FaviconField,
  FooterLogoField,
  LogoField,
  type LogoOption,
} from "./_brand-image-fields";

export type AgentOption = { user_id: string; display_name: string };
export type AreaOption = { slug: string; name: string };

// ───────────────────────────────────────────────────────────────
// Brand & identity
// ───────────────────────────────────────────────────────────────
export function BrandForm({
  initial,
  logoOptions = [],
}: {
  initial: BrandSettingsInput;
  logoOptions?: LogoOption[];
}) {
  const form = useForm<BrandSettingsInput>({
    resolver: zodResolver(brandSettingsSchema),
    defaultValues: initial,
  });
  const [pending, startTransition] = useTransition();
  const logoUrl = form.watch("logo_url");
  const logoStyle = form.watch("logo_style");
  const faviconUrl = form.watch("favicon_url");
  const footerLogoUrl = form.watch("footer_logo_url");

  function onSubmit(values: BrandSettingsInput) {
    startTransition(async () => {
      const r = await updateBrandSettings(values);
      if (r.status === "ok") toast.success(r.message ?? "Saved.");
      else {
        toast.error(r.message);
        if (r.fieldErrors)
          for (const [k, v] of Object.entries(r.fieldErrors))
            form.setError(k as keyof BrandSettingsInput, { message: v });
      }
    });
  }

  return (
    <SectionCard
      title="Brand & identity"
      subtitle="Logo, favicon, footer logo, public-facing name, tagline, and footer contact info."
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <LogoField
          value={logoUrl ?? ""}
          style={logoStyle ?? "mark_and_name"}
          options={logoOptions}
          onChange={(url) =>
            form.setValue("logo_url", url === "" ? null : url, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          onStyleChange={(style) =>
            form.setValue("logo_style", style, { shouldDirty: true })
          }
          error={form.formState.errors.logo_url?.message}
        />
        <FaviconField
          value={faviconUrl ?? ""}
          options={logoOptions}
          onChange={(url) =>
            form.setValue("favicon_url", url === "" ? null : url, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          error={form.formState.errors.favicon_url?.message}
        />
        <FooterLogoField
          value={footerLogoUrl ?? ""}
          options={logoOptions}
          onChange={(url) =>
            form.setValue("footer_logo_url", url === "" ? null : url, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          error={form.formState.errors.footer_logo_url?.message}
        />
        <Field
          label="Brand name"
          error={form.formState.errors.brand_name?.message}
        >
          <Input {...form.register("brand_name")} />
          <ArabicTwin
            field={{ key: "brand_name_ar", label: "Brand name", kind: "text", max: 80 }}
            value={form.watch("brand_name_ar") ?? ""}
            onChange={(v) =>
              form.setValue("brand_name_ar", v === "" ? null : v, {
                shouldDirty: true,
              })
            }
          />
        </Field>
        <Field
          label="Tagline"
          error={form.formState.errors.brand_tagline?.message}
        >
          <Input {...form.register("brand_tagline")} />
          <ArabicTwin
            field={{ key: "brand_tagline_ar", label: "Tagline", kind: "text", max: 160 }}
            value={form.watch("brand_tagline_ar") ?? ""}
            onChange={(v) =>
              form.setValue("brand_tagline_ar", v === "" ? null : v, {
                shouldDirty: true,
              })
            }
          />
        </Field>
        <Field label="ORN (DMT licence)" error={form.formState.errors.orn?.message}>
          <Input
            {...form.register("orn")}
            placeholder="ORN-28041-AD"
          />
        </Field>
        <Field
          label="Contact email"
          error={form.formState.errors.contact_email?.message}
        >
          <Input
            type="email"
            {...form.register("contact_email")}
            placeholder="hello@bazar.ae"
          />
        </Field>
        <Field
          label="Contact phone"
          error={form.formState.errors.contact_phone?.message}
        >
          <Input
            {...form.register("contact_phone")}
            placeholder="+971 2 …"
          />
        </Field>
        <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-bz-border mt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save brand"}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

// ───────────────────────────────────────────────────────────────
// Hero & display
// ───────────────────────────────────────────────────────────────
export function DisplayForm({ initial }: { initial: DisplaySettingsInput }) {
  const form = useForm<DisplaySettingsInput>({
    resolver: zodResolver(displaySettingsSchema),
    defaultValues: initial,
  });
  const [pending, startTransition] = useTransition();
  const selectedVariant = form.watch("hero_variant");
  const selectedAccent = form.watch("accent_token");

  function onSubmit(values: DisplaySettingsInput) {
    startTransition(async () => {
      const r = await updateDisplaySettings(values);
      if (r.status === "ok") toast.success(r.message ?? "Saved.");
      else toast.error(r.message);
    });
  }

  return (
    <SectionCard
      title="Hero & accent"
      subtitle="Marketplace homepage hero variant and primary accent token."
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        <div>
          <Label className="text-[12px] text-bz-ink-2 font-normal mb-2 block">
            Homepage hero
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {HERO_VARIANTS.map((v) => {
              const active = selectedVariant === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    form.setValue("hero_variant", v, { shouldDirty: true })
                  }
                  className={cn(
                    "text-start p-4 rounded-lg border transition-colors",
                    active
                      ? "border-bz-ink bg-bz-surface-2"
                      : "border-bz-border bg-bz-surface hover:border-bz-ink-2",
                  )}
                  aria-pressed={active}
                >
                  <div className="text-[14px] font-medium">
                    {HERO_VARIANT_LABEL[v]}
                  </div>
                  <div className="text-[11.5px] text-bz-muted mt-1 leading-[1.5]">
                    {HERO_VARIANT_DESCRIPTION[v]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-[12px] text-bz-ink-2 font-normal mb-2 block">
            Accent token{" "}
            <span className="text-bz-muted-2 ms-1">
              (brand teal locked for the launch palette)
            </span>
          </Label>
          <div className="flex gap-2.5">
            {ACCENT_TOKENS.map((tok) => {
              const active = selectedAccent === tok;
              const locked = tok !== "moss";
              return (
                <button
                  key={tok}
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    form.setValue("accent_token", tok, { shouldDirty: true })
                  }
                  className={cn(
                    "p-3 rounded-lg border transition-colors flex flex-col items-center gap-2 min-w-[80px]",
                    active
                      ? "border-bz-ink bg-bz-surface-2"
                      : "border-bz-border bg-bz-surface",
                    locked
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:border-bz-ink-2",
                  )}
                  aria-pressed={active}
                >
                  <span
                    className="w-8 h-8 rounded-full block"
                    style={{ background: ACCENT_TOKEN_HEX[tok] }}
                  />
                  <span className="text-[11.5px] capitalize">{tok}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-bz-border mt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save display"}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}


// ───────────────────────────────────────────────────────────────
// Mortgage calculator
// ───────────────────────────────────────────────────────────────

/**
 * One editable assumption. `suffix` is the unit, drawn inside the input's
 * trailing edge so a percentage and a dirham figure are told apart without
 * reading the label — the whole panel is numbers, and "4" meaning 4% sitting
 * above "4,200" meaning AED 4,200 is exactly the confusion that produces a
 * calculator quoting four hundred percent.
 */
const MORTGAGE_GROUPS: {
  title: string;
  blurb: string;
  fields: {
    key: keyof MortgageSettings;
    label: string;
    suffix: "%" | "AED" | "years";
    step?: string;
    help?: string;
  }[];
}[] = [
  {
    title: "What the calculator opens on",
    blurb:
      "The figures a visitor sees before touching anything. They are a starting point, not a limit — every one is editable on the page.",
    fields: [
      { key: "default_price_aed", label: "Property price", suffix: "AED" },
      { key: "default_down_payment_pct", label: "Down payment", suffix: "%", step: "0.5" },
      { key: "default_rate_pct", label: "Interest rate", suffix: "%", step: "0.05" },
      { key: "default_term_years", label: "Term", suffix: "years" },
      {
        key: "default_annual_income_aed",
        label: "Annual income",
        suffix: "AED",
        help: "Only feeds the affordability gauge.",
      },
    ],
  },
  {
    title: "Cash to close",
    blurb:
      "The closing table under the monthly payment. Percentages of the property price unless noted; the flat fees are charged whatever the price.",
    fields: [
      { key: "dld_transfer_pct", label: "DLD transfer fee", suffix: "%", step: "0.05" },
      {
        key: "mortgage_registration_pct",
        label: "Mortgage registration",
        suffix: "%",
        step: "0.05",
        help: "Charged on the loan amount, not the price.",
      },
      {
        key: "bank_arrangement_pct",
        label: "Bank arrangement fee",
        suffix: "%",
        step: "0.05",
        help: "Charged on the loan amount, not the price.",
      },
      { key: "advisory_pct", label: "Bazar advisory", suffix: "%", step: "0.05" },
      { key: "trustee_office_fee_aed", label: "Trustee office fee", suffix: "AED" },
      { key: "property_valuation_fee_aed", label: "Property valuation", suffix: "AED" },
      { key: "noc_misc_fee_aed", label: "NOC & disbursements", suffix: "AED" },
    ],
  },
  {
    title: "Minimum deposit (Central Bank LTV)",
    blurb:
      "What the page warns a buyer they will need down. Two tiers either side of a price threshold, plus the non-resident figure most lenders hold to.",
    fields: [
      { key: "ltv_high_tier_price_aed", label: "Higher-tier threshold", suffix: "AED" },
      {
        key: "min_down_resident_pct",
        label: "Resident / GCC — below threshold",
        suffix: "%",
        step: "0.5",
      },
      {
        key: "min_down_resident_high_pct",
        label: "Resident / GCC — at or above",
        suffix: "%",
        step: "0.5",
      },
      { key: "min_down_non_resident_pct", label: "Non-resident", suffix: "%", step: "0.5" },
    ],
  },
  {
    title: "Affordability (debt-burden ratio)",
    blurb:
      "Monthly payment as a share of monthly income. The Central Bank caps total debt servicing at 50%; the comfort line is a house view.",
    fields: [
      {
        key: "dbr_comfortable_pct",
        label: "Comfortable up to",
        suffix: "%",
        step: "0.5",
        help: "At or below this the gauge reads comfortable.",
      },
      {
        key: "dbr_max_pct",
        label: "Maximum",
        suffix: "%",
        step: "0.5",
        help: "Above this it reads over the limit.",
      },
    ],
  },
];

export function MortgageForm({ initial }: { initial: MortgageSettings }) {
  const form = useForm<MortgageSettings>({
    resolver: zodResolver(mortgageSettingsSchema),
    defaultValues: initial,
  });
  const [pending, startTransition] = useTransition();

  function onSubmit(values: MortgageSettings) {
    startTransition(async () => {
      const r = await updateMortgageSettings(values);
      if (r.status === "ok") toast.success(r.message ?? "Saved.");
      else {
        toast.error(r.message);
        if (r.fieldErrors)
          for (const [k, v] of Object.entries(r.fieldErrors))
            form.setError(k as keyof MortgageSettings, { message: v });
      }
    });
  }

  return (
    <SectionCard
      title="Mortgage calculator"
      subtitle="What /tools/mortgage computes with. The words around the calculator live in Pages & blocks → Mortgage calculator; the pre-approval form's own fields live in Forms."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-7">
        {MORTGAGE_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-[13px] font-medium">{group.title}</h3>
            <p className="text-[12px] text-bz-muted mt-0.5 leading-[1.55] max-w-[70ch]">
              {group.blurb}
            </p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.fields.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  error={form.formState.errors[f.key]?.message}
                >
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step={f.step ?? "1"}
                      className="mono pe-14"
                      {...form.register(f.key, { valueAsNumber: true })}
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[11.5px] text-bz-muted">
                      {f.suffix}
                    </span>
                  </div>
                  {f.help ? (
                    <p className="text-[11.5px] text-bz-muted-2">{f.help}</p>
                  ) : null}
                </Field>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save assumptions"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => form.reset(MORTGAGE_SETTINGS_DEFAULTS)}
          >
            <RotateCcw size={14} strokeWidth={1.6} />
            Reset to built-in figures
          </Button>
        </div>
        <p className="text-[11.5px] text-bz-muted-2 -mt-4">
          Resetting fills the form with the figures the tool shipped with — it
          is not saved until you press Save.
        </p>
      </form>
    </SectionCard>
  );
}

// ───────────────────────────────────────────────────────────────
// Lead routing
// ───────────────────────────────────────────────────────────────
export function LeadRoutingForm({
  initial,
  agents,
  areas,
}: {
  initial: LeadRoutingSettings;
  agents: AgentOption[];
  areas: AreaOption[];
}) {
  const form = useForm<LeadRoutingSettings>({
    resolver: zodResolver(leadRoutingSettingsSchema),
    defaultValues: initial,
  });
  const [pending, startTransition] = useTransition();
  const rules = form.watch("rules") ?? [];

  function addRule() {
    const next: LeadRoutingRule = {
      area_slug: areas[0]?.slug ?? "",
      agent_id: agents[0]?.user_id ?? "",
    };
    form.setValue("rules", [...rules, next], { shouldDirty: true });
  }

  function updateRule(i: number, patch: Partial<LeadRoutingRule>) {
    const copy = rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    form.setValue("rules", copy, { shouldDirty: true });
  }

  function removeRule(i: number) {
    const copy = rules.filter((_, idx) => idx !== i);
    form.setValue("rules", copy, { shouldDirty: true });
  }

  function onSubmit(values: LeadRoutingSettings) {
    startTransition(async () => {
      const r = await updateLeadRouting(values);
      if (r.status === "ok") toast.success(r.message ?? "Saved.");
      else toast.error(r.message);
    });
  }

  return (
    <SectionCard
      title="Lead routing"
      subtitle="When an enquiry lands, route it to a named advisor based on the property's area. First matching rule wins; the fallback agent handles anything unrouted."
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-3"
      >
        {rules.length === 0 ? (
          <p className="text-[12.5px] text-bz-muted py-2">
            No rules yet. All enquiries route to the fallback advisor.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((rule, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center bg-bz-surface-2 px-3 py-2 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] text-bz-muted shrink-0">
                    if area =
                  </span>
                  <select
                    value={rule.area_slug}
                    onChange={(e) => updateRule(i, { area_slug: e.target.value })}
                    className="h-8 rounded border border-bz-border bg-bz-bg px-2 text-[12.5px] flex-1"
                  >
                    {areas.map((a) => (
                      <option key={a.slug} value={a.slug}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] text-bz-muted shrink-0">
                    route to
                  </span>
                  <select
                    value={rule.agent_id}
                    onChange={(e) => updateRule(i, { agent_id: e.target.value })}
                    className="h-8 rounded border border-bz-border bg-bz-bg px-2 text-[12.5px] flex-1"
                  >
                    {agents.map((a) => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeRule(i)}
                  className="w-8 h-8 inline-flex items-center justify-center text-bz-muted hover:text-bz-danger rounded transition-colors"
                  aria-label="Remove rule"
                >
                  <Trash2 size={13} strokeWidth={1.7} />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRule}
          disabled={areas.length === 0 || agents.length === 0}
          className="self-start"
        >
          <Plus size={13} strokeWidth={1.8} />
          Add rule
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
          <Field label="Fallback advisor">
            <select
              {...form.register("fallback_agent_id")}
              className="h-9 w-full rounded border border-bz-border bg-bz-bg px-2 text-[13px]"
            >
              <option value="">— none —</option>
              {agents.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.display_name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-bz-border mt-1">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save routing"}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

// ───────────────────────────────────────────────────────────────
// Email templates
// ───────────────────────────────────────────────────────────────
export function EmailTemplatesEditor({
  overrides,
}: {
  overrides: EmailTemplatesOverrides;
}) {
  const [active, setActive] = useState<EmailTemplateKey>(
    EMAIL_TEMPLATE_KEYS[0],
  );
  return (
    <SectionCard
      title="Email templates"
      subtitle="Overrides for the system-generated transactional emails. Leave empty to use the bundled default."
    >
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 min-h-[280px]">
        <nav className="flex flex-col gap-1 md:border-e border-bz-border md:pe-3">
          {EMAIL_TEMPLATE_KEYS.map((k) => {
            const isActive = active === k;
            const hasOverride = overrides[k] != null;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActive(k)}
                className={cn(
                  "text-start px-2.5 py-2 rounded text-[13px] flex items-center justify-between transition-colors",
                  isActive
                    ? "bg-bz-navy text-bz-bg"
                    : "text-bz-ink-2 hover:bg-bz-surface-2",
                )}
              >
                <span>{EMAIL_TEMPLATE_LABEL[k]}</span>
                {hasOverride ? (
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isActive ? "bg-bz-bg" : "bg-bz-accent",
                    )}
                    aria-label="overridden"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
        <EmailTemplateEditor
          key={active}
          templateKey={active}
          initial={overrides[active] ?? null}
        />
      </div>
    </SectionCard>
  );
}

function EmailTemplateEditor({
  templateKey,
  initial,
}: {
  templateKey: EmailTemplateKey;
  initial: { subject: string; body: string } | null;
}) {
  const form = useForm<{ subject: string; body: string }>({
    resolver: zodResolver(emailTemplateOverrideSchema),
    defaultValues: initial ?? { subject: "", body: "" },
  });
  const [pending, startTransition] = useTransition();

  function onSubmit(values: { subject: string; body: string }) {
    startTransition(async () => {
      const r = await updateEmailTemplate(templateKey, values);
      if (r.status === "ok") toast.success(r.message ?? "Saved.");
      else toast.error(r.message);
    });
  }

  function onReset() {
    startTransition(async () => {
      const r = await resetEmailTemplate(templateKey);
      if (r.status === "ok") {
        toast.success(r.message ?? "Reverted.");
        form.reset({ subject: "", body: "" });
      } else toast.error(r.message);
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-3"
    >
      <Field
        label="Subject"
        error={form.formState.errors.subject?.message}
      >
        <Input
          {...form.register("subject")}
          placeholder="Default subject"
        />
      </Field>
      <Field label="Body (Markdown OK)" error={form.formState.errors.body?.message}>
        <textarea
          {...form.register("body")}
          rows={10}
          className="w-full rounded border border-bz-border bg-bz-bg px-3 py-2 text-[13px] leading-[1.55] font-mono"
        />
      </Field>
      <div className="flex justify-between gap-2 pt-2 border-t border-bz-border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={pending || initial == null}
        >
          <RotateCcw size={12} strokeWidth={1.8} />
          Revert to default
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save template"}
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────────────────────────────────────────
// Shared bits
// ───────────────────────────────────────────────────────────────
function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-bz-surface border border-bz-border rounded-lg p-6">
      <div className="mb-4 pb-4 border-b border-bz-border">
        <h2 className="text-[15px] font-medium tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="text-[12.5px] text-bz-muted mt-1 leading-[1.55]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12px] text-bz-ink-2 font-normal">{label}</Label>
      {children}
      {error ? (
        <div className="text-[11.5px] text-bz-danger">{error}</div>
      ) : null}
    </div>
  );
}
