"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  RotateCcw,
  Save,
  Send,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import {
  SYSTEM_ASSETS,
  type SystemAssetKey,
} from "@/lib/content-assets/system";
import { SYSTEM_EMAIL_DEFAULTS } from "@/lib/content-assets/system-defaults";
import { TOKENS } from "@/lib/content-assets/tokens";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import type { BlogMediaOption } from "../../../blog/_image-insert-dialog";
import { EmailBodyEditor } from "../_body-editor";
import {
  EmailFrame,
  InboxHeader,
  ViewportToggle,
  type EmailViewport,
} from "../_email-frame";
import {
  previewSystemEmailDraft,
  saveSystemEmail,
  sendSystemEmailTest,
} from "../_actions";

type Copy = {
  subject: string;
  body: string;
  notes: string;
  status: "draft" | "published";
};

type Tab = "draft" | "live" | "builtin" | "text";

export function SystemEmailEditor({
  emailKey,
  initial,
  updatedAt,
  live,
  liveLabel,
  liveIsOwn,
  builtin,
  initialDraft,
  media: initialMedia,
  canWrite,
  from,
  replyTo,
  to,
}: {
  emailKey: SystemAssetKey;
  initial: Copy;
  updatedAt: string;
  /** What sends today, rendered for the sample recipient. */
  live: RenderedEmail;
  liveLabel: string;
  /** True when what sends today is this email's own published row. */
  liveIsOwn: boolean;
  builtin: RenderedEmail;
  initialDraft: RenderedEmail | null;
  media: BlogMediaOption[];
  canWrite: boolean;
  from: string;
  replyTo: string;
  to: string;
}) {
  const router = useRouter();
  const def = SYSTEM_ASSETS[emailKey];
  const [copy, setCopy] = useState<Copy>(initial);
  const [saved, setSaved] = useState<Copy>(initial);
  const [editorKey, setEditorKey] = useState(0);
  const [media, setMedia] = useState(initialMedia);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("draft");
  const [viewport, setViewport] = useState<EmailViewport>("desktop");
  const [draft, setDraft] = useState<RenderedEmail | null>(initialDraft);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [rendering, setRendering] = useState(false);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const request = useRef(0);
  const subjectRef = useRef<HTMLInputElement>(null);

  const tokens = useMemo(
    () =>
      def.tokens
        .map((name) => TOKENS.find((t) => t.name === name))
        .filter((t): t is (typeof TOKENS)[number] => Boolean(t)),
    [def.tokens],
  );

  const dirty =
    copy.subject !== saved.subject ||
    copy.body !== saved.body ||
    copy.notes !== saved.notes ||
    copy.status !== saved.status;

  // Re-render the draft as it is typed. Debounced, and a slower response for
  // an older keystroke never overwrites a newer one.
  useEffect(() => {
    const id = ++request.current;
    const t = window.setTimeout(async () => {
      setRendering(true);
      try {
        const result = await previewSystemEmailDraft(emailKey, {
          subject: copy.subject,
          body: copy.body,
        });
        if (id !== request.current || !result) return;
        setDraft(result.email);
        setProblems(result.problems);
      } finally {
        if (id === request.current) setRendering(false);
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [emailKey, copy.subject, copy.body]);

  // Leaving with unsaved wording asks first.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
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

  function restoreDefault() {
    if (
      !window.confirm(
        "Replace the subject and message with Bazar's wording? Your unsaved changes here will be lost. Nothing is saved until you press Save.",
      )
    )
      return;
    const d = SYSTEM_EMAIL_DEFAULTS[emailKey];
    setCopy((c) => ({ ...c, subject: d.subject, body: d.body }));
    setEditorKey((k) => k + 1);
    setErrors({});
  }

  function save(status: Copy["status"]) {
    setErrors({});
    const next = { ...copy, status };
    startSave(async () => {
      const result = await saveSystemEmail(emailKey, next);
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

  function sendTest() {
    startTest(async () => {
      const result = await sendSystemEmailTest(
        emailKey,
        tab === "live" || tab === "builtin" ? null : { subject: copy.subject, body: copy.body },
      );
      if (result.status === "error") toast.error(result.message);
      else toast.success(result.message);
    });
  }

  const shown: RenderedEmail =
    tab === "live" ? live : tab === "builtin" ? builtin : (draft ?? live);
  const problemList = Object.values(problems).filter(Boolean);
  const isPublished = saved.status === "published";

  const TABS: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: "draft", label: dirty ? "Your edits" : "Your version" },
    { id: "live", label: "Sending now" },
    { id: "builtin", label: "Built-in", hidden: !liveIsOwn },
    { id: "text", label: "Plain text" },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,660px)] gap-6 items-start">
      <div className="flex flex-col gap-5 min-w-0">
        <section className="rounded-lg border border-bz-border bg-bz-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Zap size={13} strokeWidth={1.8} className="text-bz-muted" />
            <Eyebrow>{def.audience === "team" ? "To your team" : "To leads and clients"}</Eyebrow>
            <span
              className={cn(
                "ms-auto inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                isPublished
                  ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
                  : "bg-bz-surface-2 text-bz-ink-2",
              )}
            >
              {isPublished ? "Your wording is live" : "Draft — built-in wording sends"}
            </span>
          </div>
          <p className="mt-2 text-[13px] text-bz-ink-2 max-w-[70ch]">{def.trigger}</p>
          <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-1.5 text-[12px]">
            <dt className="text-bz-muted">Goes to</dt>
            <dd className="text-bz-ink-2">{def.recipient}</dd>
            <dt className="text-bz-muted">Sending now</dt>
            <dd className="text-bz-ink-2">{liveLabel}</dd>
            <dt className="text-bz-muted">Built-in</dt>
            <dd className="mono text-[11.5px] text-bz-ink-2">{def.builtIn}</dd>
          </dl>
          {def.fallsBackTo ? (
            <p className="mt-3 text-[12px] text-bz-muted max-w-[70ch]">
              While this is a draft, these leads get the{" "}
              <Link
                href={`/admin/content-assets/emails/${def.fallsBackTo}`}
                className="underline hover:text-bz-ink"
              >
                {SYSTEM_ASSETS[def.fallsBackTo].label.toLowerCase()}
              </Link>{" "}
              instead.
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>Message</Eyebrow>
            <button
              type="button"
              onClick={restoreDefault}
              className="ms-auto inline-flex items-center gap-1.5 text-[12px] text-bz-ink-2 hover:text-bz-ink"
            >
              <RotateCcw size={12} strokeWidth={1.8} />
              Start from Bazar&apos;s wording
            </button>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-bz-ink-2">Subject</span>
            <div className="flex gap-2">
              <input
                ref={subjectRef}
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
              key={editorKey}
              defaultValue={copy.body}
              onChange={(html) => set("body", html)}
              tokens={tokens}
              media={media}
              onMediaUploaded={(m) => setMedia((list) => [m, ...list])}
            />
            {errors.body ? (
              <span className="text-[11.5px] text-[oklch(0.45_0.13_28)]">{errors.body}</span>
            ) : (
              <span className="text-[11.5px] text-bz-muted">
                The whole message, greeting to sign-off. The logo, colours and
                footer are added from{" "}
                <Link href="/admin/content-assets/design" className="underline">
                  Email design
                </Link>
                . Blue fields are filled in per recipient; a line whose only
                field is empty is left out.
              </span>
            )}
          </div>

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
              {isPublished ? (dirty ? "Update live email" : "Live") : "Publish"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={sendTest}
              disabled={!canWrite || testing}
              className="ms-auto"
              title="Send the version on screen to your own address"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={1.8} />}
              Send me a test
            </Button>
          </div>
          <p className="text-[11.5px] text-bz-muted">
            {!canWrite
              ? "You can preview this email. Changing it is for admins, editors and marketing."
              : isPublished
                ? "Published: this wording sends. Unpublish to go back to the built-in email."
                : "Draft: nothing you save here sends until you publish."}
            {dirty ? " You have unsaved changes." : ` Last saved ${new Date(updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`}
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
        </section>

        <section className="rounded-lg border border-bz-border bg-bz-surface-2 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-bz-border bg-bz-surface">
            <div role="tablist" aria-label="Which version" className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
              {TABS.filter((t) => !t.hidden).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "h-6 px-2 rounded text-[11.5px] transition-colors",
                    tab === t.id ? "bg-bz-navy text-bz-bg font-medium" : "text-bz-ink-2 hover:text-bz-ink",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {rendering && tab === "draft" ? (
              <Loader2 size={12} className="animate-spin text-bz-muted" aria-label="Updating preview" />
            ) : null}
            {tab !== "text" ? (
              <div className="ms-auto">
                <ViewportToggle value={viewport} onChange={setViewport} />
              </div>
            ) : null}
          </div>
          <InboxHeader from={from} replyTo={replyTo} to={to} subject={shown.subject} />
          {tab === "text" ? (
            <pre className="m-0 p-4 bg-white text-[12.5px] leading-relaxed text-bz-ink whitespace-pre-wrap break-words font-mono min-h-[320px]">
              {(draft ?? live).text}
            </pre>
          ) : (
            <EmailFrame
              html={shown.html}
              viewport={viewport}
              title={`${def.label} — ${TABS.find((t) => t.id === tab)?.label}`}
              className="py-4"
            />
          )}
          <p className="px-4 py-2 border-t border-bz-border bg-bz-surface text-[11px] text-bz-muted">
            {tab === "live"
              ? `${liveLabel}, addressed to a sample recipient. This is the email the site sends today.`
              : tab === "builtin"
                ? "The email written into the code. It sends whenever this one is a draft."
                : tab === "text"
                  ? "The plain-text part sent alongside the HTML, for inboxes that don't show HTML."
                  : "Your wording, rendered exactly as it would send, to a sample recipient."}
          </p>
        </section>
      </div>
    </div>
  );
}
