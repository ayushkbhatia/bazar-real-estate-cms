"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Loader2, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import { TOKENS } from "@/lib/content-assets/tokens";
import { FORM_REPLY_TOKENS } from "@/lib/content-assets/form-replies";
import type { EmailLocale } from "@/lib/content-assets/tokens";
import { LangToggle, withLang } from "../../_lang-toggle";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import type { BlogMediaOption } from "../../../blog/_image-insert-dialog";
import { EmailBodyEditor } from "../../emails/_body-editor";
import {
  EmailFrame,
  InboxHeader,
  ViewportToggle,
  type EmailViewport,
} from "../../emails/_email-frame";
import { trashContentAsset } from "../../_actions";
import {
  assignFormReply,
  previewFormReplyDraft,
  saveFormReply,
  sendFormReplyTest,
} from "../_actions";

type Copy = {
  name: string;
  subject: string;
  body: string;
  notes: string;
  status: "draft" | "published";
};

type FormOption = {
  key: string;
  name: string;
  surface: string;
  /** The name of the reply already answering this form, if another one is. */
  assignedElsewhere: string | null;
};

export function FormReplyEditor({
  id,
  lang,
  english,
  initial,
  updatedAt,
  trashed,
  usedBy,
  assignableForms,
  initialPreview,
  media: initialMedia,
  canWrite,
  from,
  replyTo,
}: {
  id: string;
  /** The half of the reply being edited. */
  lang: EmailLocale;
  /** The English, to translate from. */
  english: { subject: string; body: string };
  initial: Copy;
  updatedAt: string;
  trashed: boolean;
  usedBy: { key: string; name: string; surface: string; path: string }[];
  assignableForms: FormOption[];
  initialPreview: RenderedEmail;
  media: BlogMediaOption[];
  canWrite: boolean;
  from: string;
  replyTo: string;
}) {
  const router = useRouter();
  const [copy, setCopy] = useState<Copy>(initial);
  const [saved, setSaved] = useState<Copy>(initial);
  const [media, setMedia] = useState(initialMedia);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(initialPreview);
  const [viewport, setViewport] = useState<EmailViewport>("desktop");
  const [rendering, setRendering] = useState(false);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [assigning, startAssign] = useTransition();
  const request = useRef(0);
  const subjectRef = useRef<HTMLInputElement>(null);

  const tokens = useMemo(
    () =>
      FORM_REPLY_TOKENS.map((name) => TOKENS.find((t) => t.name === name)).filter(
        (t): t is (typeof TOKENS)[number] => Boolean(t),
      ),
    [],
  );

  const dirty =
    copy.name !== saved.name ||
    copy.subject !== saved.subject ||
    copy.body !== saved.body ||
    copy.notes !== saved.notes ||
    copy.status !== saved.status;

  useEffect(() => {
    const id = ++request.current;
    const t = window.setTimeout(async () => {
      setRendering(true);
      try {
        const result = await previewFormReplyDraft(
          { subject: copy.subject, body: copy.body, lang },
          usedBy[0]?.key ?? null,
        );
        if (id !== request.current) return;
        setPreview(result.email);
        setProblems(result.problems);
      } finally {
        if (id === request.current) setRendering(false);
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [copy.subject, copy.body, usedBy, lang]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function set<K extends keyof Copy>(key: K, value: Copy[K]) {
    setCopy((c) => ({ ...c, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  function insertSubjectToken(name: string) {
    const el = subjectRef.current;
    const snippet = `{{${name}}}`;
    const start = el?.selectionStart ?? copy.subject.length;
    const end = el?.selectionEnd ?? start;
    set("subject", copy.subject.slice(0, start) + snippet + copy.subject.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  function save(status: Copy["status"]) {
    setErrors({});
    const next = { ...copy, status };
    startSave(async () => {
      const result = await saveFormReply(id, { ...next, lang });
      if (result.status === "error") {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      setCopy(next);
      setSaved(next);
      toast.success(result.message);
      router.refresh();
    });
  }

  function toggleForm(formKey: string, on: boolean) {
    startAssign(async () => {
      const result = await assignFormReply(formKey, on ? id : null);
      if (result.status === "error") toast.error(result.message);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  }

  function remove() {
    if (
      !window.confirm(
        usedBy.length > 0
          ? `“${copy.name}” answers ${usedBy.length} ${usedBy.length === 1 ? "form" : "forms"}. Move it to the trash? Those forms go back to Bazar's acknowledgement.`
          : `Move “${copy.name}” to the trash?`,
      )
    )
      return;
    startSave(async () => {
      const result = await trashContentAsset(id);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message ?? "Moved to trash.");
      router.push("/admin/content-assets/replies");
    });
  }

  const isPublished = saved.status === "published";
  const problemList = Object.values(problems).filter(Boolean);
  const assignedKeys = new Set(usedBy.map((f) => f.key));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,620px)] gap-6 items-start">
      <div className="flex flex-col gap-5 min-w-0">
        {trashed ? (
          <div className="rounded-lg border border-bz-border bg-bz-surface-2 px-4 py-3 text-[13px] text-bz-ink-2">
            This reply is in the trash, so no form sends it. Restore it from the{" "}
            <Link href="/admin/content-assets?view=trash" className="underline">
              trash view
            </Link>
            .
          </div>
        ) : null}

        <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>Reply</Eyebrow>
            <LangToggle
              lang={lang}
              className="ms-auto"
              hrefFor={(l) => withLang(`/admin/content-assets/replies/${id}`, l)}
            />
          </div>
          <p className="text-[12px] text-bz-muted -mt-1">
            {lang === "ar"
              ? "What a lead who filled in an Arabic form receives. Clear both boxes and they receive the English."
              : "What a lead from the English site receives."}
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-bz-ink-2">Name</span>
            <input
              value={copy.name}
              onChange={(e) => set("name", e.target.value)}
              className={cn(
                "w-full border rounded p-2 text-[13px] bg-bz-bg outline-none focus:border-bz-accent",
                errors.name ? "border-[oklch(0.6_0.15_28)]" : "border-bz-border",
              )}
            />
            <span className="text-[11.5px] text-bz-muted">
              {errors.name || "Only the team sees this."}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-bz-ink-2">Subject</span>
            <div className="flex gap-2">
              <input
                ref={subjectRef}
                dir={lang === "ar" ? "rtl" : "ltr"}
                lang={lang}
                value={copy.subject}
                onChange={(e) => set("subject", e.target.value)}
                className={cn(
                  "flex-1 min-w-0 border rounded p-2 text-[13px] bg-bz-bg outline-none focus:border-bz-accent",
                  errors.subject ? "border-[oklch(0.6_0.15_28)]" : "border-bz-border",
                )}
              />
              <select
                value=""
                aria-label="Insert a field into the subject"
                onChange={(e) => {
                  if (e.target.value) insertSubjectToken(e.target.value);
                  e.target.value = "";
                }}
                className="shrink-0 w-[118px] border border-bz-border rounded px-2 text-[12px] bg-bz-bg text-bz-ink-2"
              >
                <option value="">Insert field…</option>
                {tokens
                  .filter((t) => t.kind === "text")
                  .map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.label}
                    </option>
                  ))}
              </select>
            </div>
            {errors.subject ? (
              <span className="text-[11.5px] text-[oklch(0.45_0.13_28)]">{errors.subject}</span>
            ) : null}
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-bz-ink-2">Message</span>
            <EmailBodyEditor
              key={lang}
              defaultValue={initial.body}
              onChange={(html) => set("body", html)}
              tokens={tokens}
              media={media}
              onMediaUploaded={(m) => setMedia((list) => [m, ...list])}
              dir={lang === "ar" ? "rtl" : "ltr"}
              lang={lang}
            />
            {errors.body ? (
              <span className="text-[11.5px] text-[oklch(0.45_0.13_28)]">{errors.body}</span>
            ) : (
              <span className="text-[11.5px] text-bz-muted">
                The whole message, greeting to sign-off. The logo, colours and
                footer come from{" "}
                <Link href="/admin/content-assets/design" className="underline">
                  Email design
                </Link>
                . A line whose only field is empty is left out — so
                “{"{{property_line}}"}” disappears on a form that names no listing.
              </span>
            )}
          </div>

          {lang === "ar" ? (
            <details className="rounded border border-bz-border bg-bz-surface-2 px-3 py-2">
              <summary className="cursor-pointer text-[12px] text-bz-ink-2">
                The English, to translate from
              </summary>
              <p className="mt-2 text-[12px] text-bz-muted">
                {english.subject || "No subject"}
              </p>
              <div
                className="mt-2 text-[12.5px] text-bz-ink-2 [&_p]:mb-2 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: english.body }}
              />
            </details>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-bz-ink-2">Notes for the next editor</span>
            <textarea
              value={copy.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="border border-bz-border rounded p-2 text-[13px] bg-bz-bg outline-none focus:border-bz-accent resize-y"
            />
            <span className="text-[11.5px] text-bz-muted">Never sent.</span>
          </label>
        </section>

        <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-3">
          <Eyebrow>Answers these forms</Eyebrow>
          <p className="text-[12.5px] text-bz-muted max-w-[70ch]">
            Tick a form and its visitors receive this email instead of Bazar&apos;s
            acknowledgement — once this reply is published. A form answers one
            reply at a time.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
            {assignableForms.map((form) => {
              const checked = assignedKeys.has(form.key);
              const takenBy = !checked ? form.assignedElsewhere : null;
              return (
                <label
                  key={form.key}
                  className={cn(
                    "flex items-start gap-2 py-1 text-[12.5px]",
                    !canWrite && "opacity-70",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canWrite || assigning}
                    onChange={(e) => toggleForm(form.key, e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{form.name}</span>
                    <span className="block text-[11.5px] text-bz-muted truncate">
                      {form.surface}
                      {takenBy ? ` · currently “${takenBy}”` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-6 min-w-0">
        <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => save("draft")}
              disabled={!canWrite || saving}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.8} />}
              {isPublished ? "Unpublish" : "Save draft"}
            </Button>
            <Button
              type="button"
              onClick={() => save("published")}
              disabled={!canWrite || saving || (isPublished && !dirty)}
            >
              {isPublished ? (dirty ? "Update live reply" : "Live") : "Publish"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                startTest(async () => {
                  const result = await sendFormReplyTest(
                    { subject: copy.subject, body: copy.body, lang },
                    usedBy[0]?.key ?? null,
                  );
                  if (result.status === "error") toast.error(result.message);
                  else toast.success(result.message);
                })
              }
              disabled={!canWrite || testing}
              className="ms-auto"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={1.8} />}
              Send me a test
            </Button>
          </div>
          <p className="text-[11.5px] text-bz-muted">
            {!canWrite
              ? "You can preview this reply. Changing it is for admins, editors and marketing."
              : isPublished
                ? usedBy.length > 0
                  ? `Live on ${usedBy.length} ${usedBy.length === 1 ? "form" : "forms"}.`
                  : "Published, but no form uses it yet — tick one on the left."
                : "Draft: the forms below still send Bazar's acknowledgement."}
            {dirty
              ? " You have unsaved changes."
              : ` Last saved ${new Date(updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`}
          </p>
          {problemList.length > 0 ? (
            <ul className="rounded border border-[oklch(0.85_0.08_70)] bg-[oklch(0.97_0.03_80)] px-3 py-2 text-[12px] text-[oklch(0.4_0.08_60)] flex flex-col gap-1">
              {problemList.map((p) => (
                <li key={p} className="flex gap-2">
                  <AlertTriangle size={13} strokeWidth={1.8} className="shrink-0 mt-0.5" />
                  {p}
                </li>
              ))}
            </ul>
          ) : null}
          {canWrite && !trashed ? (
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-1.5 self-start text-[12px] text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
            >
              <Trash2 size={12} strokeWidth={1.8} />
              Move to trash
            </button>
          ) : null}
        </section>

        <section className="rounded-lg border border-bz-border bg-bz-surface-2 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-bz-border bg-bz-surface">
            <span className="text-[12px] text-bz-ink-2">
              {usedBy[0] ? `As ${usedBy[0].name} sends it` : "With a sample lead"}
            </span>
            {rendering ? (
              <Loader2 size={12} className="animate-spin text-bz-muted" aria-label="Updating preview" />
            ) : null}
            <div className="ms-auto">
              <ViewportToggle value={viewport} onChange={setViewport} />
            </div>
          </div>
          <InboxHeader
            from={from}
            replyTo={replyTo}
            to="Amira Haddad <amira@example.com>"
            subject={preview.subject}
          />
          <EmailFrame html={preview.html} viewport={viewport} title="Form reply preview" className="py-4" />
        </section>

        {usedBy.length > 0 ? (
          <section className="rounded-lg border border-bz-border bg-bz-surface p-4">
            <Eyebrow>Where it is used</Eyebrow>
            <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px]">
              {usedBy.map((f) => (
                <li key={f.key} className="flex flex-wrap items-center gap-x-2">
                  <Link href={`/admin/forms/${f.key}`} className="text-bz-ink hover:underline">
                    {f.name}
                  </Link>
                  <span className="text-bz-muted">{f.surface}</span>
                  <Link
                    href={f.path}
                    target="_blank"
                    className="mono text-[11.5px] text-bz-muted inline-flex items-center gap-1 hover:text-bz-ink"
                  >
                    {f.path}
                    <ExternalLink size={10} strokeWidth={1.8} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
