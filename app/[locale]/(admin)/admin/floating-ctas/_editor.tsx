"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArabicTwin } from "../_fields/arabic-twin";
import {
  FLOATING_CTA_KINDS,
  FLOATING_CTA_KIND_LABELS,
  FLOATING_CTA_SCOPES,
  FLOATING_CTA_SCOPE_LABELS,
  FLOATING_CTA_SCOPE_HEADINGS,
  FLOATING_CTA_TOKEN_SCOPES,
  FLOATING_CTA_TOKENS,
  MAX_FLOATING_CTAS,
  blankFloatingCta,
  readableForeground,
  renderCtaTemplate,
  type FloatingCtaInput,
  type FloatingCtaKind,
  type FloatingCtaScope,
  type FloatingCtaTokenValues,
  type FloatingCtaTokenScope,
} from "@/lib/schemas/floating-cta";
import { saveFloatingCtas } from "./_actions";

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]";

const KIND_ICONS: Record<FloatingCtaKind, typeof Phone> = {
  whatsapp: MessageCircle,
  call: Phone,
  email: Mail,
};

/** What each kind's destination field actually holds. */
const DESTINATION_COPY: Record<
  FloatingCtaKind,
  { label: string; placeholder: string; hint: string }
> = {
  whatsapp: {
    label: "WhatsApp number",
    placeholder: "+971 50 123 4567",
    hint: "International format. Blank falls back to the number in the site's environment settings.",
  },
  call: {
    label: "Phone number",
    placeholder: "+971 2 123 4567",
    hint: "Blank falls back to the number in the site's environment settings.",
  },
  email: {
    label: "Email address",
    placeholder: "hello@bazar.ae",
    hint: "Where the mail is addressed when no advisor applies.",
  },
};

/**
 * The floating contact rail, as a list.
 *
 * Whole-list save (one button, one server round-trip) rather than per-row
 * saves: order matters here and is derived from position, so a per-row save
 * would need its own reorder call and could leave the two out of step.
 */
export function FloatingCtasEditor({
  initial,
}: {
  initial: FloatingCtaInput[];
}) {
  const router = useRouter();
  const [ctas, setCtas] = useState<FloatingCtaInput[]>(initial);
  const [open, setOpen] = useState<number | null>(initial.length ? 0 : null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(next: FloatingCtaInput[]) {
    setCtas(next);
    setDirty(true);
  }

  function setCta(i: number, patch: Partial<FloatingCtaInput>) {
    update(ctas.map((c, x) => (x === i ? { ...c, ...patch } : c)));
  }

  function move(i: number, delta: number) {
    const to = i + delta;
    if (to < 0 || to >= ctas.length) return;
    const next = ctas.slice();
    [next[i], next[to]] = [next[to]!, next[i]!];
    update(next);
    setOpen(open === i ? to : open === to ? i : open);
  }

  function remove(i: number) {
    update(ctas.filter((_, x) => x !== i));
    setOpen(null);
  }

  function add(kind: FloatingCtaKind) {
    if (ctas.length >= MAX_FLOATING_CTAS) return;
    const draft = blankFloatingCta(kind);
    // `key` is unique, so a second button of the same kind needs a distinct
    // one. Suffix rather than reject — the editor shouldn't have to know.
    const taken = new Set(ctas.map((c) => c.key));
    let key = draft.key;
    let n = 2;
    while (taken.has(key)) key = `${draft.key}_${n++}`;
    update([...ctas, { ...draft, key }]);
    setOpen(ctas.length);
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveFloatingCtas({ ctas });
      if (result.status === "ok") {
        toast.success(result.message);
        setDirty(false);
        router.refresh();
      } else if (result.status === "invalid") {
        toast.error(result.message, {
          description: result.issues.slice(0, 4).join("\n"),
        });
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {ctas.map((cta, i) => (
          <CtaRow
            key={cta.id ?? `new-${i}`}
            cta={cta}
            index={i}
            total={ctas.length}
            expanded={open === i}
            onToggle={() => setOpen(open === i ? null : i)}
            onChange={(patch) => setCta(i, patch)}
            onMove={(delta) => move(i, delta)}
            onRemove={() => remove(i)}
          />
        ))}
        {ctas.length === 0 ? (
          <p className="text-[13px] text-bz-muted border border-dashed border-bz-border rounded p-4">
            No floating buttons. The rail won&apos;t render at all until you add
            one.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FLOATING_CTA_KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind];
          return (
            <Button
              key={kind}
              type="button"
              variant="outline"
              size="sm"
              disabled={ctas.length >= MAX_FLOATING_CTAS}
              onClick={() => add(kind)}
            >
              <Plus size={13} strokeWidth={1.8} />
              <Icon size={13} strokeWidth={1.8} />
              {FLOATING_CTA_KIND_LABELS[kind]}
            </Button>
          );
        })}
        <span className="text-[12px] text-bz-muted">
          {ctas.length} of {MAX_FLOATING_CTAS}
        </span>
        <div className="ms-auto flex items-center gap-2">
          {dirty ? (
            <span className="text-[12px] text-bz-muted">Unsaved changes</span>
          ) : null}
          <Button type="button" onClick={onSave} disabled={pending || !dirty}>
            <Save size={14} strokeWidth={1.8} />
            {pending ? "Saving…" : "Save rail"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CtaRow({
  cta,
  index,
  total,
  expanded,
  onToggle,
  onChange,
  onMove,
  onRemove,
}: {
  cta: FloatingCtaInput;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<FloatingCtaInput>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const copy = DESTINATION_COPY[cta.kind];

  return (
    <div
      className={cn(
        "border border-bz-border rounded bg-bz-surface",
        !cta.enabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 min-w-0 flex-1 text-start"
          aria-expanded={expanded}
        >
          <Preview cta={cta} />
          <span className="text-[12px] text-bz-muted truncate">
            {FLOATING_CTA_KIND_LABELS[cta.kind]} ·{" "}
            {FLOATING_CTA_SCOPE_LABELS[cta.scope]}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.8}
            className={cn(
              "shrink-0 text-bz-muted transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        <IconButton
          label={cta.enabled ? "Hide this button" : "Show this button"}
          onClick={() => onChange({ enabled: !cta.enabled })}
        >
          {cta.enabled ? (
            <Eye size={14} strokeWidth={1.8} />
          ) : (
            <EyeOff size={14} strokeWidth={1.8} />
          )}
        </IconButton>
        <IconButton
          label="Move up"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ChevronUp size={14} strokeWidth={1.8} />
        </IconButton>
        <IconButton
          label="Move down"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ChevronDown size={14} strokeWidth={1.8} />
        </IconButton>
        <IconButton label="Delete this button" onClick={onRemove} destructive>
          <Trash2 size={14} strokeWidth={1.8} />
        </IconButton>
      </div>

      {expanded ? (
        <div className="border-t border-bz-border p-3 grid gap-3 md:grid-cols-2">
          <Field
            label="Button text"
            hint="Phones share one row between the buttons, so keep this short — past about 10 characters it clips when three are showing."
          >
            <input
              className={fieldCls}
              value={cta.label}
              maxLength={40}
              onChange={(e) => onChange({ label: e.target.value })}
            />
            <ArabicTwin
              field={{ key: "label_ar", label: "Button text", kind: "text", max: 40 }}
              value={cta.label_ar ?? ""}
              onChange={(v) => onChange({ label_ar: v || null })}
            />
          </Field>

          <Field label="Type">
            <select
              className={fieldCls}
              value={cta.kind}
              onChange={(e) =>
                onChange({ kind: e.target.value as FloatingCtaKind })
              }
            >
              {FLOATING_CTA_KINDS.map((k) => (
                <option key={k} value={k}>
                  {FLOATING_CTA_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>

          <Field label={copy.label} hint={copy.hint}>
            <input
              className={fieldCls}
              value={cta.destination ?? ""}
              placeholder={copy.placeholder}
              inputMode={cta.kind === "email" ? "email" : "tel"}
              onChange={(e) => onChange({ destination: e.target.value })}
            />
          </Field>

          <Field label="Show on">
            <select
              className={fieldCls}
              value={cta.scope}
              onChange={(e) =>
                onChange({ scope: e.target.value as FloatingCtaScope })
              }
            >
              {FLOATING_CTA_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {FLOATING_CTA_SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>

          {cta.kind === "email" ? (
            <Field
              label="Always copy in"
              hint="Added as CC on every mail this button opens. The visitor can see and delete it before sending, so treat it as a courtesy copy — the click log below is the actual record."
            >
              <input
                className={fieldCls}
                value={cta.cc_destination ?? ""}
                placeholder="enquiries@bazar.ae"
                inputMode="email"
                onChange={(e) => onChange({ cc_destination: e.target.value })}
              />
            </Field>
          ) : null}

          {cta.kind === "email" ? (
            <Field
              label="Subject line"
              hint="What the visitor's mail client fills the subject with."
              className="md:col-span-2"
            >
              <input
                className={fieldCls}
                value={cta.subject_template ?? ""}
                maxLength={200}
                placeholder="Bazar enquiry · {context}"
                onChange={(e) => onChange({ subject_template: e.target.value })}
              />
              <ArabicTwin
                field={{
                  key: "subject_template_ar",
                  label: "Subject",
                  kind: "text",
                  max: 200,
                }}
                value={cta.subject_template_ar ?? ""}
                onChange={(v) => onChange({ subject_template_ar: v || null })}
              />
            </Field>
          ) : null}

          <Field
            label={
              cta.kind === "call" ? "Draft message (unused for calls)" : "Draft message"
            }
            hint="What the chat or mail window opens with."
            className="md:col-span-2"
          >
            <textarea
              className={cn(fieldCls, "min-h-[84px] resize-y font-normal")}
              value={cta.message_template ?? ""}
              maxLength={1200}
              disabled={cta.kind === "call"}
              placeholder={
                cta.kind === "call"
                  ? "A phone call has no message to draft."
                  : "Hi {advisor}, I'm enquiring about {context} on bazar.ae"
              }
              onChange={(e) => onChange({ message_template: e.target.value })}
            />
            {/* Keep {advisor} and {context} in the Arabic — they are
                substituted after the locale fold, so dropping one silently
                loses the name the message was meant to greet someone by. */}
            <ArabicTwin
              field={{
                key: "message_template_ar",
                label: "Draft message",
                kind: "textarea",
                max: 1200,
              }}
              value={cta.message_template_ar ?? ""}
              onChange={(v) => onChange({ message_template_ar: v || null })}
            />
            {cta.kind !== "call" ? (
              <TokenLegend
                scope={cta.scope}
                onInsert={(token) =>
                  onChange({
                    message_template: `${cta.message_template ?? ""}${token}`,
                  })
                }
              />
            ) : null}
          </Field>

          <Field
            label="Colour"
            hint="Leave blank for the default pill. Text colour is picked automatically so it stays readable."
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick a colour"
                className="h-8 w-10 rounded border border-bz-border bg-bz-bg p-0.5"
                value={cta.color ?? "#25D366"}
                onChange={(e) =>
                  onChange({ color: e.target.value.toUpperCase() })
                }
              />
              <input
                className={cn(fieldCls, "mono")}
                value={cta.color ?? ""}
                placeholder="#25D366"
                maxLength={7}
                onChange={(e) => onChange({ color: e.target.value })}
              />
              {cta.color ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ color: null })}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </Field>

          <Field
            label="Advisor routing"
            hint="On a listing, project or service page, use that advisor's own number or address."
          >
            <label className="flex items-center gap-2 text-[12.5px] h-[34px]">
              <input
                type="checkbox"
                checked={cta.use_advisor_contact}
                onChange={(e) =>
                  onChange({ use_advisor_contact: e.target.checked })
                }
              />
              Prefer the page&apos;s advisor
            </label>
          </Field>

          <Field
            label="Internal key"
            hint="Used in reports and support. Not shown to visitors."
          >
            <input
              className={cn(fieldCls, "mono")}
              value={cta.key}
              maxLength={40}
              onChange={(e) =>
                onChange({ key: e.target.value.toLowerCase().trim() })
              }
            />
          </Field>

          <MessagePreview cta={cta} />
        </div>
      ) : null}
    </div>
  );
}

/** The button, rendered the way the public rail will render it. */
function Preview({ cta }: { cta: FloatingCtaInput }) {
  const Icon = KIND_ICONS[cta.kind];
  const style = cta.color
    ? { backgroundColor: cta.color, color: readableForeground(cta.color) }
    : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 h-8 px-3 rounded-full text-[12.5px] shrink-0",
        !cta.color && "bg-bz-bg border border-bz-border text-bz-ink",
      )}
      style={style}
    >
      <Icon size={13} strokeWidth={1.8} />
      {cta.label || "Untitled"}
    </span>
  );
}

/**
 * The draft as a visitor on a listing page would receive it. Worth the space:
 * the tokens are the one part of this screen where what you type isn't what
 * they read.
 */
/**
 * The draft as a visitor on a listing page would receive it.
 *
 * Worth the space: the tokens are the one part of this screen where what you
 * type is not what they read. Every token in the registry has a value here, so
 * the preview never renders a hole that the real message would fill — a
 * preview that quietly drops half the sentence is worse than none.
 */
const PREVIEW_VALUES: FloatingCtaTokenValues = {
  brand: "Bazar",
  context: "Marina Bay Tower, 2-bed with full sea view",
  url: "https://www.bazarrealestate.ae/p/marina-bay-tower-baz-ad-04891",
  path: "/p/marina-bay-tower-baz-ad-04891",
  page_title: "Marina Bay Tower, 2-bed with full sea view",
  locale: "en",
  date: "16 August 2026",
  advisor: "Layla Al Mansoori",
  advisor_first: "Layla",
  advisor_title: "Senior Advisor",
  advisor_phone: "+971 50 123 4567",
  advisor_email: "layla@bazar.ae",
  advisor_brn: "BRN-40291",
  property_title: "Marina Bay Tower, 2-bed with full sea view",
  reference: "BAZ-AD-04891",
  price: "AED 2,400,000",
  beds: "2",
  baths: "3",
  property_type: "Apartment",
  area_name: "Al Reem Island",
  development_name: "Marina Bay",
  developer_name: "Aldar Properties",
  handover: "Q4 2027",
};

function MessagePreview({ cta }: { cta: FloatingCtaInput }) {
  if (cta.kind === "call") return null;
  const subject =
    cta.kind === "email"
      ? renderCtaTemplate(cta.subject_template, PREVIEW_VALUES)
      : "";
  const body = renderCtaTemplate(cta.message_template, PREVIEW_VALUES);
  if (!subject && !body) return null;
  return (
    <div className="md:col-span-2">
      <Label className="text-[11px] uppercase tracking-wider text-bz-ink-2">
        Preview · as it would arrive from a listing page
      </Label>
      <div className="mt-1 rounded border border-bz-border bg-bz-bg p-2.5 text-[12.5px] whitespace-pre-wrap">
        {subject ? <div className="font-medium">{subject}</div> : null}
        {body}
      </div>
    </div>
  );
}

function TokenLegend({
  scope,
  onInsert,
}: {
  scope: FloatingCtaScope;
  onInsert: (token: string) => void;
}) {
  return (
    <div className="mt-2 grid gap-2">
      {FLOATING_CTA_TOKEN_SCOPES.map((group) => {
        const tokens = FLOATING_CTA_TOKENS.filter((t) => t.scope === group);
        if (tokens.length === 0) return null;
        // A button pinned to every page still shows the listing groups, but
        // dimmed: the tokens work when it happens to be on a listing, and
        // hiding them would read as "these don't exist".
        const reachable = group === "always" || scope === "detail_pages";
        return (
          <div key={group}>
            <div className="text-[10.5px] uppercase tracking-wider text-bz-ink-2">
              {FLOATING_CTA_SCOPE_HEADINGS[group as FloatingCtaTokenScope]}
              {reachable ? null : " · only on listing pages"}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tokens.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  title={t.hint}
                  onClick={() => onInsert(t.token)}
                  className={cn(
                    "mono text-[11px] rounded border border-bz-border px-1.5 py-0.5 hover:bg-bz-surface-2",
                    reachable ? "text-bz-ink-2" : "text-bz-muted",
                  )}
                >
                  {t.token}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1", className)}>
      <Label className="text-[11px] uppercase tracking-wider text-bz-ink-2">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11.5px] text-bz-muted">{hint}</p> : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 w-7 grid place-items-center rounded border border-bz-border text-bz-ink-2 shrink-0",
        "hover:bg-bz-surface-2 disabled:opacity-40 disabled:pointer-events-none",
        destructive && "hover:text-[oklch(0.55_0.19_25)]",
      )}
    >
      {children}
    </button>
  );
}
