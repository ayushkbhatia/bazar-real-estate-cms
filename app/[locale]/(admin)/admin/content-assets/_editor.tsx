"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import {
  CONTENT_ASSET_CATEGORIES,
  CONTENT_ASSET_KINDS,
  CONTENT_ASSET_KIND_LABELS,
  slugifyAssetName,
  type ContentAssetKind,
  type ContentAssetStatus,
} from "@/lib/schemas/content-asset";
import { TOKENS, renderSample, unknownTokens } from "@/lib/content-assets/tokens";
import type { AssetActionResult } from "./_actions";

export type AssetDraft = {
  kind: ContentAssetKind;
  slug: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  notes: string;
  follow_up_after_days: string;
  next_asset_id: string;
  status: ContentAssetStatus;
};

export const EMPTY_DRAFT: AssetDraft = {
  kind: "email",
  slug: "",
  name: "",
  category: "enquiry",
  subject: "",
  body: "",
  notes: "",
  follow_up_after_days: "",
  next_asset_id: "",
  status: "draft",
};

export function ContentAssetEditor({
  initial,
  candidates,
  save,
  isNew,
}: {
  initial: AssetDraft;
  candidates: { id: string; name: string; kind: ContentAssetKind }[];
  /**
   * Passed by reference from the server page — `createContentAsset`, or
   * `updateContentAsset.bind(null, id)`. Wrapping it in an arrow here would
   * make it a plain function and the page 500s on the server/client boundary.
   */
  save: (raw: Record<string, unknown>) => Promise<AssetActionResult>;
  isNew: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<AssetDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Once the slug has been typed (or loaded from an existing row) it stops
  // tracking the name — renaming a published asset shouldn't silently change
  // the key other code looks it up by.
  const [slugLocked, setSlugLocked] = useState(!isNew);

  const isEmail = draft.kind === "email";
  const badTokens = useMemo(
    () => [...new Set([...unknownTokens(draft.body), ...unknownTokens(draft.subject)])],
    [draft.body, draft.subject],
  );
  const preview = useMemo(() => renderSample(draft.body), [draft.body]);
  const previewSubject = useMemo(
    () => renderSample(draft.subject),
    [draft.subject],
  );

  function set<K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key]: "" } : e));
  }

  function onNameChange(value: string) {
    setDraft((d) => ({
      ...d,
      name: value,
      slug: slugLocked ? d.slug : slugifyAssetName(value),
    }));
  }

  /** Insert a token at the cursor rather than at the end. */
  function insertToken(token: string) {
    const el = bodyRef.current;
    const snippet = `{{${token}}}`;
    if (!el) {
      set("body", `${draft.body}${snippet}`);
      return;
    }
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? start;
    const next = draft.body.slice(0, start) + snippet + draft.body.slice(end);
    set("body", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  function onSave() {
    setErrors({});
    start(async () => {
      const result = await save({
        kind: draft.kind,
        slug: draft.slug,
        name: draft.name,
        category: draft.category,
        subject: isEmail ? draft.subject : null,
        body: draft.body,
        notes: draft.notes,
        follow_up_after_days: draft.follow_up_after_days,
        next_asset_id: draft.next_asset_id,
        status: draft.status,
      });
      if (result.status === "error") {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      toast.success(result.message ?? "Saved.");
      if (isNew && result.id) router.push(`/admin/content-assets/${result.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="flex flex-col gap-5 min-w-0">
        <Card>
          <Eyebrow>Asset</Eyebrow>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" error={errors.name}>
              <input
                value={draft.name}
                onChange={(e) => onNameChange(e.target.value)}
                className={inputCls}
                placeholder="First response — new enquiry"
              />
            </Field>
            <Field
              label="Slug"
              error={errors.slug}
              hint="How code refers to this asset."
            >
              <input
                value={draft.slug}
                onChange={(e) => {
                  setSlugLocked(true);
                  set("slug", e.target.value);
                }}
                className={cn(inputCls, "mono text-[12.5px]")}
                placeholder="enquiry-first-response"
              />
            </Field>
            <Field label="Channel" error={errors.kind}>
              <div className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
                {CONTENT_ASSET_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set("kind", k)}
                    className={cn(
                      "h-7 px-3 rounded text-[12px] transition-colors",
                      draft.kind === k
                        ? "bg-bz-navy text-bz-bg font-medium"
                        : "text-bz-ink-2 hover:text-bz-ink",
                    )}
                  >
                    {CONTENT_ASSET_KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Category" error={errors.category}>
              <input
                list="asset-categories"
                value={draft.category}
                onChange={(e) => set("category", e.target.value)}
                className={inputCls}
              />
              <datalist id="asset-categories">
                {CONTENT_ASSET_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>
        </Card>

        <Card>
          <Eyebrow>Message</Eyebrow>
          {isEmail ? (
            <div className="mt-3">
              <Field label="Subject" error={errors.subject}>
                <input
                  value={draft.subject}
                  onChange={(e) => set("subject", e.target.value)}
                  className={inputCls}
                  placeholder="Re: {{property_reference}}"
                />
              </Field>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-bz-muted">
              WhatsApp messages have no subject line.
            </p>
          )}

          <div className="mt-4">
            <Field
              label="Body"
              error={errors.body}
              hint={
                isEmail
                  ? "The middle of the email. The greeting and advisor signature are added when it sends."
                  : "Sent as written. Keep it short — long WhatsApp messages get skimmed."
              }
            >
              <textarea
                ref={bodyRef}
                value={draft.body}
                onChange={(e) => set("body", e.target.value)}
                rows={12}
                className={cn(inputCls, "resize-y leading-relaxed")}
              />
            </Field>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-bz-muted mr-1">Insert:</span>
              {TOKENS.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => insertToken(t.name)}
                  title={`Example: ${t.sample}`}
                  className="mono text-[11px] h-6 px-1.5 rounded border border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong hover:text-bz-ink transition-colors"
                >
                  {`{{${t.name}}}`}
                </button>
              ))}
            </div>
            {badTokens.length > 0 ? (
              <p className="mt-2 text-[12px] text-[oklch(0.45_0.13_28)]">
                Unknown token{badTokens.length > 1 ? "s" : ""}:{" "}
                <span className="mono">
                  {badTokens.map((t) => `{{${t}}}`).join(", ")}
                </span>{" "}
                — these won&apos;t render. Use one from the list above.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Eye size={13} strokeWidth={1.8} className="text-bz-muted" />
            <Eyebrow>Preview</Eyebrow>
          </div>
          <p className="mt-1 text-[11.5px] text-bz-muted">
            Tokens filled with example values.
          </p>
          <div className="mt-3 rounded-md border border-bz-border bg-bz-bg p-4">
            {isEmail && previewSubject ? (
              <div className="text-[13px] font-medium pb-2 mb-3 border-b border-bz-border">
                {previewSubject}
              </div>
            ) : null}
            <div className="text-[13.5px] leading-relaxed whitespace-pre-line text-bz-ink-2">
              {preview || (
                <span className="text-bz-muted italic">
                  Nothing written yet.
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>

      <aside className="flex flex-col gap-4 sticky top-6 self-start">
        <Card>
          <Eyebrow>Publish</Eyebrow>
          <div className="mt-3 inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5 w-full">
            {(["draft", "published"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("status", s)}
                className={cn(
                  "flex-1 h-7 rounded text-[12px] transition-colors capitalize",
                  draft.status === s
                    ? "bg-bz-navy text-bz-bg font-medium"
                    : "text-bz-ink-2 hover:text-bz-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-bz-muted">
            Only published assets appear in the enquiry composer.
          </p>
          <Button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="w-full mt-4"
          >
            <Save size={14} strokeWidth={1.8} />
            {pending ? "Saving…" : isNew ? "Create asset" : "Save changes"}
          </Button>
        </Card>

        <Card>
          <Eyebrow>Sequencing</Eyebrow>
          <p className="mt-1 text-[11.5px] text-bz-muted">
            Notes for the advisor. Nothing sends automatically.
          </p>
          <div className="mt-3 flex flex-col gap-4">
            <Field label="When to use this" error={errors.notes}>
              <textarea
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={4}
                className={cn(inputCls, "resize-y")}
                placeholder="Send within two hours of the enquiry landing…"
              />
            </Field>
            <Field
              label="Follow up after"
              error={errors.follow_up_after_days}
              hint="Days. Leave blank if there's no follow-up."
            >
              <input
                type="number"
                min={1}
                max={365}
                value={draft.follow_up_after_days}
                onChange={(e) => set("follow_up_after_days", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Then send" error={errors.next_asset_id}>
              <select
                value={draft.next_asset_id}
                onChange={(e) => set("next_asset_id", e.target.value)}
                className={inputCls}
              >
                <option value="">— nothing —</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({CONTENT_ASSET_KIND_LABELS[c.kind]})
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>
      </aside>
    </div>
  );
}

const inputCls =
  "w-full border border-bz-border rounded p-2 text-[13px] bg-bz-surface focus:border-bz-accent outline-none";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-bz-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="text-[11.5px] text-[oklch(0.45_0.13_28)]">
          {error}
        </span>
      ) : hint ? (
        <span className="text-[11.5px] text-bz-muted">{hint}</span>
      ) : null}
    </label>
  );
}
