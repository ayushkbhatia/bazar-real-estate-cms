"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEVELOPMENT_STATUSES,
  developmentEditSchema,
  type DevelopmentEditInput,
} from "@/lib/schemas/development";
import { updateDevelopment } from "./_actions";

type DeveloperOption = { id: string; name: string };
type AreaOption = { id: string; name: string; kind: string };

export function DevelopmentEditForm({
  developmentId,
  initial,
  developers,
  areas,
}: {
  developmentId: string;
  initial: DevelopmentEditInput;
  developers: DeveloperOption[];
  areas: AreaOption[];
}) {
  const form = useForm<DevelopmentEditInput>({
    resolver: zodResolver(developmentEditSchema),
    defaultValues: initial,
  });
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  function onSubmit(values: DevelopmentEditInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateDevelopment(developmentId, values);
      if (result.status === "ok") {
        toast.success(result.message ?? "Saved.");
      } else {
        setServerError(result.message);
        if (result.fieldErrors) {
          for (const [k, v] of Object.entries(result.fieldErrors)) {
            form.setError(k as keyof DevelopmentEditInput, { message: v });
          }
        }
        toast.error(result.message);
      }
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
    >
      <Section title="Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
          </Field>
          <Field label="Slug" error={form.formState.errors.slug?.message}>
            <Input {...form.register("slug")} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <Field
            label="Status"
            error={form.formState.errors.status?.message}
          >
            <select
              {...form.register("status")}
              className="h-9 w-full rounded border border-bz-border bg-bz-bg px-2 text-[13px]"
            >
              {DEVELOPMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Developer"
            error={form.formState.errors.developer_id?.message}
          >
            <select
              {...form.register("developer_id")}
              className="h-9 w-full rounded border border-bz-border bg-bz-bg px-2 text-[13px]"
            >
              <option value="">—</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Area" error={form.formState.errors.area_id?.message}>
            <select
              {...form.register("area_id")}
              className="h-9 w-full rounded border border-bz-border bg-bz-bg px-2 text-[13px]"
            >
              <option value="">—</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.kind}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <Field
            label="Tagline (e.g. 'Bazar exclusive · pre-launch access')"
            error={form.formState.errors.tagline?.message}
          >
            <Input {...form.register("tagline")} />
          </Field>
        </div>
      </Section>

      <Section title="Inventory & pricing">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field
            label="Handover date"
            error={form.formState.errors.handover_date?.message}
          >
            <Input type="date" {...form.register("handover_date")} />
          </Field>
          <Field
            label="Total units"
            error={form.formState.errors.total_units?.message}
          >
            <Input
              type="number"
              {...form.register("total_units", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Starting price (AED)"
            error={form.formState.errors.starting_price?.message}
          >
            <Input
              type="number"
              {...form.register("starting_price", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Bedrooms label (e.g. '3-6 bed')"
            error={form.formState.errors.bedrooms_text?.message}
          >
            <Input {...form.register("bedrooms_text")} />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field
            label="Escrow account"
            error={form.formState.errors.escrow_account?.message}
          >
            <Input
              {...form.register("escrow_account")}
              placeholder="ADCB · #04881"
            />
          </Field>
        </div>
      </Section>

      <Section title="Description">
        <Field
          label="Short description (search-card snippet)"
          error={form.formState.errors.description?.message}
        >
          <textarea
            {...form.register("description")}
            rows={3}
            className="w-full rounded border border-bz-border bg-bz-bg px-3 py-2 text-[13px] leading-[1.55]"
          />
        </Field>
        <div className="mt-4">
          <Field
            label="Vision (long copy, overview section). Use blank lines for paragraphs."
            error={form.formState.errors.vision?.message}
          >
            <textarea
              {...form.register("vision")}
              rows={6}
              className="w-full rounded border border-bz-border bg-bz-bg px-3 py-2 text-[13px] leading-[1.55]"
            />
          </Field>
        </div>
      </Section>

      {serverError ? (
        <div className="text-[13px] text-bz-danger">{serverError}</div>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-bz-border rounded-lg bg-bz-surface p-6">
      <h3 className="text-[13px] font-medium uppercase tracking-wider text-bz-muted mb-4">
        {title}
      </h3>
      {children}
    </div>
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
