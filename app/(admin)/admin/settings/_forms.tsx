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
  type BrandSettingsInput,
  type DisplaySettingsInput,
  type EmailTemplateKey,
  type EmailTemplatesOverrides,
  type LeadRoutingSettings,
  type LeadRoutingRule,
} from "@/lib/schemas/site-settings";
import {
  resetEmailTemplate,
  updateBrandSettings,
  updateDisplaySettings,
  updateEmailTemplate,
  updateLeadRouting,
} from "./_actions";

export type AgentOption = { user_id: string; display_name: string };
export type AreaOption = { slug: string; name: string };

// ───────────────────────────────────────────────────────────────
// Brand & identity
// ───────────────────────────────────────────────────────────────
export function BrandForm({ initial }: { initial: BrandSettingsInput }) {
  const form = useForm<BrandSettingsInput>({
    resolver: zodResolver(brandSettingsSchema),
    defaultValues: initial,
  });
  const [pending, startTransition] = useTransition();

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
    <SectionCard title="Brand & identity" subtitle="Public-facing name, tagline, and footer contact info.">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-cols-2 gap-4"
      >
        <Field
          label="Brand name"
          error={form.formState.errors.brand_name?.message}
        >
          <Input {...form.register("brand_name")} />
        </Field>
        <Field
          label="Tagline"
          error={form.formState.errors.brand_tagline?.message}
        >
          <Input {...form.register("brand_tagline")} />
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
          <div className="grid grid-cols-2 gap-2.5">
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
                    "text-left p-4 rounded-lg border transition-colors",
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
            <span className="text-bz-muted-2 ml-1">
              (moss locked for the launch palette)
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
                className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center bg-bz-surface-2 px-3 py-2 rounded"
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

        <div className="grid grid-cols-2 gap-4 mt-1">
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
      <div className="grid grid-cols-[200px_1fr] gap-5 min-h-[280px]">
        <nav className="flex flex-col gap-1 border-r border-bz-border pr-3">
          {EMAIL_TEMPLATE_KEYS.map((k) => {
            const isActive = active === k;
            const hasOverride = overrides[k] != null;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActive(k)}
                className={cn(
                  "text-left px-2.5 py-2 rounded text-[13px] flex items-center justify-between transition-colors",
                  isActive
                    ? "bg-bz-ink text-bz-bg"
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
