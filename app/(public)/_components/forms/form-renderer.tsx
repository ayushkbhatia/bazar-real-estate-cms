"use client";

/**
 * The one form component the CMS drives.
 *
 * It replaces the hand-written field lists in five separate components, and
 * the constraint that shaped it is that nothing may look different afterwards.
 * So it carries the two visual idioms the site already had rather than
 * inventing a third: `stacked` is the tall 44px-input card used by the home
 * and off-plan lead forms, `compact` is the shadcn Label + Input layout used
 * by the enquiry form and the service landings. Same for the confirmation —
 * three call sites had three different success panels, and `successStyle`
 * keeps each of them.
 *
 * Validation is built from the same resolved form the server validates
 * against (`lib/forms/validate.ts`), so the browser and the action can't
 * disagree about what "required" means after an editor changes it.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  FormFieldDef,
  FormOption,
  ResolvedForm,
} from "@/lib/forms/types";
import {
  formatRangeLabel,
  formatRangeValue,
  parseRangeValue,
  rangeBounds,
} from "@/lib/forms/types";
import { activeFields, renderFormCopy, visibleFields } from "@/lib/forms/resolve";
import { buildFormSchema, normaliseSubmission } from "@/lib/forms/validate";
import { optionsFor } from "@/lib/forms/submission";
import { buildSearchRedirect } from "@/lib/forms/search";
import { DualRangeSlider } from "../dual-range-slider";
import { submitForm, type FormSubmitContext } from "../../_actions/forms";

export type FormRendererProps = {
  form: ResolvedForm;
  /** Live option lists for fields whose options come from records. */
  dynamicOptions?: Record<string, FormOption[]>;
  context?: FormSubmitContext;
  /** Substituted into copy and the pre-filled message. */
  tokens?: Record<string, string | null | undefined>;
  /**
   * Copy that belongs to the page rather than to the form.
   *
   * Three of the service forms had their button, small print and confirmation
   * in Pages & blocks before the Forms Manager existed, and those fields stay
   * there — see `copyFromPage` in the registry. The page passes what it owns
   * and the manager's values fill the rest.
   */
  copyOverride?: Partial<ResolvedForm["copy"]>;
  successStyle?: "note" | "soft" | "serif";
  /** Offer "Send another" under the confirmation. */
  allowAnother?: boolean;
  /** Toast on success. Null (the default for stacked cards) stays quiet. */
  successToast?: string | null;
  /** Toast the server's message on failure, instead of only inlining it. */
  toastErrors?: boolean;
  /**
   * Run after a successful submit — the brochure gate opens the PDF here.
   * Fires inside the transition, so it may not run synchronously with the
   * click; the gate also renders a real link for the popup-blocker case.
   */
  onSuccess?: () => void;
  className?: string;
};

type Values = Record<string, unknown>;

function initialValues(
  form: ResolvedForm,
  tokens: Record<string, string | null | undefined>,
): Values {
  const out: Values = {};
  for (const f of visibleFields(form)) {
    if (f.type === "checkbox") {
      out[f.key] = false;
    } else if (f.mapping === "message" && form.def.messagePrefill) {
      out[f.key] = renderFormCopy(form.def.messagePrefill, tokens) ?? "";
    } else if (f.type === "chips" && f.required) {
      // A required pill row has always shipped with its first option chosen —
      // an empty segmented control reads as a bug rather than a question.
      out[f.key] = firstValue(f);
    } else {
      out[f.key] = "";
    }
  }
  return out;
}

function firstValue(field: FormFieldDef): string {
  const first = (field.options ?? [])[0];
  return first ? first.value || first.label : "";
}

export function FormRenderer({
  form,
  dynamicOptions = {},
  context,
  tokens = {},
  copyOverride,
  successStyle,
  allowAnother = false,
  successToast = null,
  toastErrors = false,
  onSuccess,
  className,
}: FormRendererProps) {
  const stacked = form.def.variant === "stacked";
  const style = successStyle ?? (stacked ? "note" : "soft");

  const router = useRouter();
  const [values, setValues] = useState<Values>(() =>
    initialValues(form, tokens),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  // Bumped after "Send another". The slider holds its handle positions in its
  // own state, so clearing `values` alone would leave it showing a range the
  // form no longer has an answer for; remounting the tree is the honest reset.
  const [attempt, setAttempt] = useState(0);

  // What the form is asking right now. A branching form re-reads this on every
  // keystroke — the Buy hero swaps its property-type dropdown and drops its
  // bedroom question the moment the purpose control changes.
  const fields = useMemo(() => activeFields(form, values), [form, values]);

  // Blank strings from the page's own editor mean "not set" and fall through
  // to the manager's value, the same way an unset master-page field does.
  const merged = { ...form.copy };
  for (const [key, value] of Object.entries(copyOverride ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  const copy = {
    title: renderFormCopy(merged.title, tokens),
    subtitle: renderFormCopy(merged.subtitle, tokens),
    successTitle: renderFormCopy(merged.success_title, tokens) ?? "",
    successBody: renderFormCopy(merged.success_body, tokens) ?? "",
  };

  function set(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const normalised = normaliseSubmission(form, values);
    const parsed = buildFormSchema(
      form,
      dynamicOptions,
      normalised,
    ).safeParse(normalised);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await submitForm(form.key, normalised, {
        ...context,
        path:
          context?.path ??
          (typeof window === "undefined" ? null : window.location.pathname),
      });
      if (result.status === "ok") {
        setDone(true);
        setValues(initialValues(form, tokens));
        if (successToast) toast.success(successToast);
        onSuccess?.();
        // Navigation last, and only once the lead is filed. A form that
        // promises results owes the visitor results; a push that doesn't
        // land costs them a page, never us the enquiry.
        const next = buildSearchRedirect(form, normalised, dynamicOptions);
        if (next) router.push(next);
        return;
      }
      setFormError(result.message);
      if (result.fieldErrors) setErrors(result.fieldErrors);
      if (toastErrors) toast.error(result.message);
    });
  }

  if (done) {
    return (
      <SuccessPanel
        style={style}
        title={copy.successTitle}
        body={copy.successBody}
        onAnother={
          allowAnother
            ? () => {
                setAttempt((n) => n + 1);
                setDone(false);
              }
            : null
        }
        className={className}
      />
    );
  }

  return (
    <form
      key={attempt}
      onSubmit={onSubmit}
      noValidate
      className={cn(
        "flex flex-col",
        stacked ? "gap-4" : "gap-3.5",
        className,
      )}
    >
      {copy.title ? (
        <h2
          className="serif text-[26px] md:text-[30px] leading-[1.1]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {copy.title}
        </h2>
      ) : null}
      {copy.subtitle ? (
        <p className="text-[14px] text-bz-ink-2 leading-relaxed -mt-1.5">
          {copy.subtitle}
        </p>
      ) : null}

      {rows(fields).map((row, index) =>
        row.length > 1 ? (
          <div
            key={row.map((f) => f.key).join("-")}
            className={cn(
              "grid grid-cols-1 gap-3 sm:grid-cols-2",
              stacked && "gap-4",
            )}
          >
            {row.map((f) => (
              <FieldControl
                key={f.key}
                field={withTokens(f, tokens)}
                stacked={stacked}
                value={values[f.key]}
                error={errors[f.key]}
                options={optionsFor(f, dynamicOptions)}
                onChange={(v) => set(f.key, v)}
              />
            ))}
          </div>
        ) : (
          <FieldControl
            key={row[0]?.key ?? index}
            field={withTokens(row[0]!, tokens)}
            stacked={stacked}
            value={values[row[0]!.key]}
            error={errors[row[0]!.key]}
            options={optionsFor(row[0]!, dynamicOptions)}
            onChange={(v) => set(row[0]!.key, v)}
          />
        ),
      )}

      {formError ? (
        <p className="text-[13px] text-bz-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className={stacked ? "mt-2 h-11 self-start px-6" : "mt-1"}
      >
        {stacked ? null : <Send size={14} strokeWidth={1.8} />}
        {pending ? merged.pending_label : merged.submit_label}
      </Button>
      {merged.consent_note ? (
        <p className="text-[11.5px] text-bz-muted -mt-1">{merged.consent_note}</p>
      ) : null}
    </form>
  );
}

/**
 * Labels, placeholders and hints take the same `{token}` substitution the copy
 * does — the area guide's message box asks "What are you looking for in
 * {area}?", and an editor rewriting it must be able to keep the community's
 * name in the sentence.
 */
function withTokens(
  field: FormFieldDef,
  tokens: Record<string, string | null | undefined>,
): FormFieldDef {
  if (Object.keys(tokens).length === 0) return field;
  return {
    ...field,
    label: renderFormCopy(field.label, tokens) ?? field.label,
    placeholder: renderFormCopy(field.placeholder ?? null, tokens),
    help: renderFormCopy(field.help ?? null, tokens),
  };
}

/** Adjacent half-width fields share a row; everything else spans. */
function rows(fields: FormFieldDef[]): FormFieldDef[][] {
  const out: FormFieldDef[][] = [];
  let index = 0;
  while (index < fields.length) {
    const field = fields[index]!;
    const next = fields[index + 1];
    if (field.width === "half" && next?.width === "half") {
      out.push([field, next]);
      index += 2;
    } else {
      out.push([field]);
      index += 1;
    }
  }
  return out;
}

// ── controls ─────────────────────────────────────────────────────────────

const STACKED_INPUT =
  "h-11 w-full rounded-md border border-bz-border bg-bz-surface px-3 text-[13.5px] outline-none focus:border-bz-accent";
const STACKED_LABEL = "text-[12px] font-medium text-bz-ink-2";

function FieldError({ message, stacked }: { message?: string; stacked: boolean }) {
  if (!message) return null;
  return (
    <span
      className={cn(
        "text-[12px]",
        stacked ? "text-bz-danger" : "text-[oklch(0.45_0.13_28)]",
      )}
    >
      {message}
    </span>
  );
}

function FieldControl({
  field,
  stacked,
  value,
  error,
  options,
  onChange,
}: {
  field: FormFieldDef;
  stacked: boolean;
  value: unknown;
  error?: string;
  options: FormOption[];
  onChange: (value: unknown) => void;
}) {
  const id = `bzf-${field.key}`;
  const text = typeof value === "string" ? value : "";

  const labelNode =
    field.type === "checkbox" ? null : stacked ? (
      <label htmlFor={id} className={STACKED_LABEL}>
        {field.label}
      </label>
    ) : (
      <Label htmlFor={id}>{field.label}</Label>
    );

  const help = field.help ? (
    <span className="text-[11.5px] text-bz-muted">{field.help}</span>
  ) : null;

  let control: React.ReactNode;

  switch (field.type) {
    case "textarea":
      control = (
        <textarea
          id={id}
          name={field.key}
          value={text}
          rows={field.rows ?? 4}
          placeholder={field.placeholder ?? undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "resize-y outline-none",
            stacked
              ? "rounded-md border border-bz-border bg-bz-surface px-3 py-2 text-[13.5px] focus:border-bz-accent"
              : "border border-bz-border rounded p-2 text-[14px] bg-bz-surface focus:border-bz-accent",
          )}
        />
      );
      break;

    case "select":
      control = (
        <select
          id={id}
          name={field.key}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "outline-none focus:border-bz-accent",
            stacked
              ? "h-11 rounded-md border border-bz-border bg-bz-surface px-3 text-[13.5px]"
              : "h-9 rounded border border-bz-border bg-bz-surface px-2 text-[14px]",
          )}
        >
          <option value="">{field.placeholder ?? "Select an option"}</option>
          {options.map((o) => (
            <option key={o.value || o.label} value={o.value || o.label}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;

    case "chips":
      control = (
        <div
          className={cn(
            "flex flex-wrap",
            stacked ? "flex-col gap-2 sm:flex-row" : "gap-1.5",
          )}
        >
          {options.map((o) => {
            const optionValue = o.value || o.label;
            const active = text === optionValue;
            return (
              <button
                key={optionValue}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange(active && !field.required ? "" : optionValue)
                }
                className={cn(
                  "transition-colors",
                  stacked
                    ? "h-11 rounded-md px-4 text-[13.5px] sm:h-9"
                    : "h-9 px-3 rounded text-[13px] border",
                  active
                    ? stacked
                      ? "border border-bz-navy bg-bz-navy text-bz-bg"
                      : "bg-bz-navy text-bz-bg border-bz-navy"
                    : stacked
                      ? "border border-bz-border-strong bg-bz-surface text-bz-ink-2 hover:bg-bz-surface-2"
                      : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
      break;

    case "radio":
      control = (
        <div className="flex flex-col gap-1.5">
          {options.map((o) => {
            const optionValue = o.value || o.label;
            return (
              <label
                key={optionValue}
                className="flex items-center gap-2 text-[13.5px] text-bz-ink-2"
              >
                <input
                  type="radio"
                  name={field.key}
                  value={optionValue}
                  checked={text === optionValue}
                  onChange={() => onChange(optionValue)}
                  className="accent-bz-navy"
                />
                {o.label}
              </label>
            );
          })}
        </div>
      );
      break;

    case "checkbox":
      control = (
        <label className="flex items-start gap-2 text-[13px] text-bz-ink-2">
          <input
            id={id}
            name={field.key}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 accent-bz-navy"
          />
          <span>{field.label}</span>
        </label>
      );
      break;

    case "phone_dial":
      control = (
        <DialPhone
          id={id}
          name={field.key}
          value={text}
          options={options}
          placeholder={field.placeholder ?? undefined}
          stacked={stacked}
          onChange={onChange}
        />
      );
      break;

    case "range":
      control = <RangeField field={field} value={text} onChange={onChange} />;
      break;

    case "number":
      control = stacked ? (
        <input
          id={id}
          name={field.key}
          inputMode="numeric"
          value={text}
          placeholder={field.placeholder ?? undefined}
          onChange={(e) => onChange(e.target.value)}
          className={STACKED_INPUT}
        />
      ) : (
        <Input
          id={id}
          name={field.key}
          inputMode="numeric"
          value={text}
          placeholder={field.placeholder ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;

    default: {
      const autoComplete =
        field.mapping === "email"
          ? "email"
          : field.mapping === "phone"
            ? "tel"
            : field.mapping === "name"
              ? "name"
              : field.mapping === "first_name"
                ? "given-name"
                : field.mapping === "last_name"
                  ? "family-name"
                  : undefined;
      const inputType = field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text";
      // A text field with options gets a datalist rather than a dropdown: the
      // list covers what we have on file, and someone whose building isn't on
      // it still has to be able to type it. That is how the management form's
      // location box has always worked.
      const listId = options.length > 0 ? `${id}-list` : undefined;
      const shared = {
        id,
        name: field.key,
        type: inputType,
        inputMode: field.type === "tel" ? ("tel" as const) : undefined,
        autoComplete,
        value: text,
        list: listId,
        placeholder: field.placeholder ?? undefined,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value),
      };
      control = (
        <>
          {stacked ? (
            <input {...shared} className={STACKED_INPUT} />
          ) : (
            <Input {...shared} />
          )}
          {listId ? (
            <datalist id={listId}>
              {options.map((o) => (
                <option key={o.value || o.label} value={o.label} />
              ))}
            </datalist>
          ) : null}
        </>
      );
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {labelNode}
      {control}
      {help}
      <FieldError message={error} stacked={stacked} />
    </div>
  );
}

/**
 * Two handles over a scale, submitted as one `"min:max"` string.
 *
 * Wraps the slider the search filters already use, so the budget control on a
 * lead form drags like the budget control on /buy/search rather than like a
 * second thing that happens to do the same job.
 *
 * A handle parked at its end of the scale means "no bound that side", not
 * "zero" — the slider reports it as null and the value carries a blank half.
 * Both ends parked is a blank string, which is the answer of a visitor who
 * never touched it: no budget on the lead, no budget line in the brief.
 */
function RangeField({
  field,
  value,
  onChange,
}: {
  field: FormFieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  const bounds = rangeBounds(field);
  const current = parseRangeValue(value);
  const summary = formatRangeLabel(field, value);
  const prefix = field.unit ? `${field.unit} ` : "";

  return (
    <div className="flex flex-col gap-1">
      <DualRangeSlider
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        initial={current}
        format={(n) => `${prefix}${n.toLocaleString("en-US")}`}
        onChange={(range) => onChange(formatRangeValue(range.min, range.max))}
      />
      <span className="text-[12px] text-bz-ink-2" aria-live="polite">
        {summary || "Any budget"}
      </span>
    </div>
  );
}

/**
 * Dial code + national number, submitted as one string.
 *
 * The split is presentational: `enquiries.phone` is a single column and the
 * desk dials what it is given, so joining here keeps one canonical value and
 * spares the server from having to know that two inputs meant one number.
 *
 * Only the number carries the field's `name`; the dial-code select is a
 * control over that one value, not a second answer.
 */
function DialPhone({
  id,
  name,
  value,
  options,
  placeholder,
  stacked,
  onChange,
}: {
  id: string;
  name: string;
  value: string;
  options: FormOption[];
  placeholder?: string;
  stacked: boolean;
  onChange: (value: string) => void;
}) {
  const codes = options.length > 0 ? options : [{ label: "+971", value: "+971" }];
  const match = codes.find((c) => value.startsWith(c.value || c.label));
  const dial = match ? match.value || match.label : codes[0]!.value || codes[0]!.label;
  const national = match ? value.slice(dial.length).trim() : value;

  const join = (nextDial: string, nextNational: string) =>
    nextNational.trim() ? `${nextDial} ${nextNational.trim()}` : "";

  return (
    <div className="flex gap-2">
      <select
        aria-label="Dialing code"
        value={dial}
        onChange={(e) => onChange(join(e.target.value, national))}
        className={cn(
          "shrink-0 outline-none focus:border-bz-accent",
          stacked
            ? "h-11 w-[92px] rounded-md border border-bz-border bg-bz-surface px-2 text-[13.5px]"
            : "h-9 w-[86px] rounded border border-bz-border bg-bz-surface px-2 text-[14px]",
        )}
      >
        {codes.map((c) => (
          <option key={c.value || c.label} value={c.value || c.label}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        id={id}
        name={name}
        inputMode="tel"
        autoComplete="tel"
        value={national}
        placeholder={placeholder}
        onChange={(e) => onChange(join(dial, e.target.value))}
        className={cn(
          "w-full outline-none focus:border-bz-accent",
          stacked
            ? "h-11 rounded-md border border-bz-border bg-bz-surface px-3 text-[13.5px]"
            : "h-9 rounded border border-bz-border bg-bz-surface px-3 text-[14px]",
        )}
      />
    </div>
  );
}

function SuccessPanel({
  style,
  title,
  body,
  onAnother,
  className,
}: {
  style: "note" | "soft" | "serif";
  title: string;
  body: string;
  onAnother: (() => void) | null;
  className?: string;
}) {
  if (style === "serif") {
    return (
      <div className={cn("flex flex-col", className)}>
        <div className="serif text-[24px]" style={{ letterSpacing: "-0.015em" }}>
          {title}
        </div>
        <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">{body}</p>
        {onAnother ? (
          <button
            type="button"
            onClick={onAnother}
            className="mt-5 self-start text-[12.5px] text-bz-ink-2 underline underline-offset-4"
          >
            Send another
          </button>
        ) : null}
      </div>
    );
  }

  if (style === "soft") {
    return (
      <div className={cn("bg-bz-accent-soft text-bz-accent rounded-lg p-5", className)}>
        <div className="font-medium text-[14px]">{title}</div>
        <p className="text-[13px] mt-1.5 leading-relaxed text-bz-ink-2">{body}</p>
        {onAnother ? (
          <button
            type="button"
            onClick={onAnother}
            className="text-[12.5px] text-bz-ink-2 underline mt-3"
          >
            Send another
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-bz-border bg-bz-surface-2 p-5",
        className,
      )}
    >
      <Check size={18} className="mt-0.5 text-bz-accent" />
      <div>
        <div className="text-[15px] font-medium">{title}</div>
        <p className="mt-1 text-[13.5px] text-bz-ink-2">{body}</p>
        {onAnother ? (
          <button
            type="button"
            onClick={onAnother}
            className="mt-3 text-[12.5px] text-bz-ink-2 underline"
          >
            Send another
          </button>
        ) : null}
      </div>
    </div>
  );
}
