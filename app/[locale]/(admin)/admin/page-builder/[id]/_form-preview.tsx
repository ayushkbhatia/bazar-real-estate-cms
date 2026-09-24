import Link from "next/link";
import { AlertTriangle, ChevronDown, ExternalLink, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FormPreview,
  FormPreviewField,
} from "@/lib/page-builder/form-preview";

/**
 * A sketch of the chosen form, under the form picker.
 *
 * Drawn from plain divs rather than by mounting the public `FormRenderer`:
 * that component is wired to `submitForm`, and a preview an editor can type
 * into and press is one that files a real lead with the desk. A sketch also
 * gets to say things the live form never would — which questions are
 * required, which only appear after another answer, what kind of input each
 * one is — which is what choosing between 22 forms actually needs.
 */
export function FormMiniPreview({
  formKey,
  preview,
}: {
  formKey: string | null;
  preview: FormPreview | undefined;
}) {
  if (!formKey) {
    return (
      <p className="rounded border border-dashed border-bz-border px-3 py-2.5 text-[11.5px] text-bz-muted">
        Choose a form to see its questions here.
      </p>
    );
  }

  // An unknown key already gets "no longer available" from the picker itself;
  // a second warning here would only repeat it.
  if (!preview) return null;

  const required = preview.fields.filter((f) => f.required).length;
  const conditional = preview.fields.filter((f) => f.condition).length;

  return (
    <section
      aria-label={`Preview of ${preview.name}`}
      data-testid="form-mini-preview"
      className="rounded-lg border border-bz-border bg-bz-surface-2 overflow-hidden"
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2.5 border-b border-bz-border">
        <div className="me-auto min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-medium">{preview.name}</span>
            <StatusPill enabled={preview.enabled} />
          </div>
          <p className="text-[11px] text-bz-muted">
            From {preview.surface} · {preview.fields.length} question
            {preview.fields.length === 1 ? "" : "s"} · {required} required
            {conditional > 0 ? ` · ${conditional} conditional` : ""}
            {preview.hiddenFields > 0
              ? ` · ${preview.hiddenFields} switched off`
              : ""}
          </p>
        </div>
        <Link
          href={preview.editHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] text-bz-accent hover:underline"
        >
          Edit in Forms <ExternalLink size={11} strokeWidth={1.8} />
        </Link>
      </header>

      {!preview.enabled ? (
        <p className="mx-3 mt-2.5 rounded border border-[oklch(0.85_0.09_28)] bg-[oklch(0.97_0.02_28)] px-2.5 py-2 text-[11.5px] text-[oklch(0.42_0.13_28)] flex items-start gap-1.5">
          <AlertTriangle size={12} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          This form is switched off in Forms, so the section would show no form
          and the page can&apos;t be published with it. Switch it on there or
          pick another.
        </p>
      ) : null}

      <div className="p-3">
        {/* The sketch itself — a card like the one on the page, at a smaller
            scale. Nothing in it is focusable or submittable. */}
        <div
          aria-hidden="true"
          className="rounded-md border border-bz-border bg-bz-bg p-3 flex flex-col gap-2.5 select-none"
        >
          {preview.title ? (
            <div>
              <p className="serif text-[16px] leading-tight">{preview.title}</p>
              {preview.subtitle ? (
                <p className="text-[10.5px] text-bz-muted mt-0.5">
                  {preview.subtitle}
                </p>
              ) : null}
            </div>
          ) : null}

          {preview.fields.length === 0 ? (
            <p className="text-[11px] text-bz-muted">
              This form has no questions switched on.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
              {preview.fields.map((f) => (
                <SketchField key={f.key} field={f} />
              ))}
            </div>
          )}

          <div className="h-7 rounded bg-bz-ink text-bz-bg text-[11px] font-medium inline-flex items-center justify-center px-3">
            {preview.submitLabel}
          </div>
          {preview.consentNote ? (
            <p className="text-[9.5px] text-bz-muted-2 leading-snug">
              {preview.consentNote}
            </p>
          ) : null}
        </div>

        <p className="mt-2 text-[11px] text-bz-muted">{preview.handlerLabel}.</p>
      </div>
    </section>
  );
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[10px] font-medium",
        enabled
          ? "bg-[oklch(0.94_0.05_160)] text-[oklch(0.38_0.09_160)]"
          : "bg-[oklch(0.95_0.03_28)] text-[oklch(0.45_0.13_28)]",
      )}
    >
      {enabled ? "On" : "Off"}
    </span>
  );
}

const box =
  "h-6 rounded border border-bz-border bg-bz-surface px-1.5 text-[10px] text-bz-muted-2 flex items-center min-w-0";

function SketchField({ field }: { field: FormPreviewField }) {
  // A checkbox is its own label; everything else sits under one.
  const full = field.width === "full" || field.type === "checkbox";
  return (
    <div className={cn("flex flex-col gap-1 min-w-0", full && "col-span-2")}>
      {field.type !== "checkbox" ? (
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[10.5px] font-medium truncate">
            {field.label}
            {field.required ? (
              <span className="text-[oklch(0.5_0.15_28)]"> *</span>
            ) : null}
          </span>
          <span className="mono text-[9px] text-bz-muted-2 shrink-0">
            {field.typeLabel}
          </span>
        </div>
      ) : null}

      <SketchInput field={field} />

      {field.condition ? (
        <span className="text-[9.5px] text-bz-muted inline-flex items-center gap-1">
          <GitBranch size={9} strokeWidth={1.8} className="shrink-0" />
          {field.condition}
        </span>
      ) : null}
    </div>
  );
}

function SketchInput({ field }: { field: FormPreviewField }) {
  const hint = field.placeholder ?? "";
  const more =
    field.moreOptions > 0 ? (
      <span className="text-[9.5px] text-bz-muted-2">+{field.moreOptions} more</span>
    ) : null;

  switch (field.type) {
    case "textarea":
      return (
        <div className={cn(box, "h-12 items-start pt-1")}>
          <span className="truncate">{hint}</span>
        </div>
      );

    case "phone_dial":
      return (
        <div className="flex gap-1">
          <div className={cn(box, "w-12 shrink-0 justify-between")}>
            +971 <ChevronDown size={9} />
          </div>
          <div className={cn(box, "flex-1")}>
            <span className="truncate">{hint}</span>
          </div>
        </div>
      );

    case "select":
      return (
        <>
          <div className={cn(box, "justify-between gap-1")}>
            <span className="truncate">
              {hint || field.options[0] || "Choose…"}
            </span>
            <ChevronDown size={9} className="shrink-0" />
          </div>
          {field.optionSource ? (
            <SourceNote source={field.optionSource} />
          ) : null}
        </>
      );

    case "chips":
      if (field.optionSource) return <SourceNote source={field.optionSource} />;
      return (
        <div className="flex flex-wrap gap-1 items-center">
          {field.options.map((o, i) => (
            <span
              key={`${o}-${i}`}
              className={cn(
                "rounded-full border px-1.5 py-px text-[9.5px]",
                i === 0
                  ? "border-bz-ink bg-bz-ink text-bz-bg"
                  : "border-bz-border text-bz-muted",
              )}
            >
              {o}
            </span>
          ))}
          {more}
        </div>
      );

    case "radio":
      if (field.optionSource) return <SourceNote source={field.optionSource} />;
      return (
        <div className="flex flex-col gap-0.5">
          {field.options.map((o, i) => (
            <span
              key={`${o}-${i}`}
              className="flex items-center gap-1 text-[9.5px] text-bz-muted"
            >
              <span className="h-2 w-2 rounded-full border border-bz-border-strong shrink-0" />
              <span className="truncate">{o}</span>
            </span>
          ))}
          {more}
        </div>
      );

    case "checkbox":
      return (
        <span className="flex items-start gap-1.5 text-[10px] text-bz-muted">
          <span className="mt-px h-2.5 w-2.5 rounded-sm border border-bz-border-strong shrink-0" />
          <span>
            {field.label}
            {field.required ? (
              <span className="text-[oklch(0.5_0.15_28)]"> *</span>
            ) : null}
          </span>
        </span>
      );

    case "range": {
      const fmt = (n: number | null) =>
        n == null
          ? ""
          : `${field.unit ? `${field.unit} ` : ""}${n.toLocaleString("en-US")}`;
      return (
        <div className="flex flex-col gap-0.5 pt-1">
          <div className="relative h-1 rounded bg-bz-border mx-1">
            <span className="absolute inset-y-0 start-[15%] end-[25%] bg-bz-ink rounded" />
            <span className="absolute -top-1 start-[15%] h-3 w-3 -ms-1.5 rounded-full border border-bz-ink bg-bz-bg" />
            <span className="absolute -top-1 end-[25%] h-3 w-3 -me-1.5 rounded-full border border-bz-ink bg-bz-bg" />
          </div>
          <div className="flex justify-between text-[9px] text-bz-muted-2 mono">
            <span>{fmt(field.min)}</span>
            <span>{fmt(field.max)}</span>
          </div>
        </div>
      );
    }

    default:
      // text, email, tel, number
      return (
        <div className={box}>
          <span className="truncate">{hint}</span>
        </div>
      );
  }
}

function SourceNote({ source }: { source: string }) {
  return (
    <span className="text-[9.5px] text-bz-muted italic">Options: {source}</span>
  );
}
