"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import { TOKENS } from "@/lib/content-assets/tokens";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import {
  AUDIENCE_LABELS,
  NEWSLETTER_TOKENS,
  hasArabicEdition,
  type Audience,
  type CampaignDraft,
  type CampaignStatus,
} from "@/lib/newsletter/campaign";
import type { BlogMediaOption } from "../../blog/_image-insert-dialog";
import { EmailBodyEditor } from "../../content-assets/emails/_body-editor";
import { EmailFrame, InboxHeader, ViewportToggle, type EmailViewport } from "../../content-assets/emails/_email-frame";
import {
  deleteCampaign,
  previewCampaign,
  saveCampaign,
  scheduleCampaign,
  sendCampaignNow,
  sendCampaignTest,
  unscheduleCampaign,
} from "../_actions";

type Step = "write" | "audience" | "send";
const STEPS: { id: Step; label: string }[] = [
  { id: "write", label: "Write" },
  { id: "audience", label: "Audience" },
  { id: "send", label: "Review & send" },
];

const FIELD_ERROR = "text-[11.5px] text-[oklch(0.45_0.13_28)]";
const INPUT =
  "w-full border rounded p-2 text-[13px] bg-bz-bg outline-none focus:border-bz-accent disabled:opacity-60";

/** `datetime-local` value for a Date, in the browser's own time zone. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Composer({
  id,
  status,
  scheduledAt,
  updatedAt,
  initial,
  audienceCounts,
  media: initialMedia,
  canWrite,
  canSend,
  from,
  replyTo,
}: {
  id: string;
  status: CampaignStatus;
  scheduledAt: string | null;
  updatedAt: string;
  initial: CampaignDraft;
  audienceCounts: Record<Audience, number>;
  media: BlogMediaOption[];
  canWrite: boolean;
  canSend: boolean;
  from: string;
  replyTo: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<CampaignDraft>(initial);
  const [saved, setSaved] = useState<CampaignDraft>(initial);
  const [step, setStep] = useState<Step>("write");
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [previewLang, setPreviewLang] = useState<"en" | "ar">("en");
  const [viewport, setViewport] = useState<EmailViewport>("desktop");
  const [showText, setShowText] = useState(false);
  const [media, setMedia] = useState(initialMedia);
  const [preview, setPreview] = useState<RenderedEmail | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rendering, setRendering] = useState(false);
  const [when, setWhen] = useState(() =>
    toLocalInput(scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 24 * 60 * 60 * 1000)),
  );
  const [busy, startBusy] = useTransition();
  const [testing, startTest] = useTransition();
  const request = useRef(0);

  const tokens = useMemo(() => TOKENS.filter((t) => NEWSLETTER_TOKENS.includes(t.name)), []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const locked = !canWrite;
  const arabicReady = hasArabicEdition(draft);
  const recipients = audienceCounts[draft.audience];
  const allProblems = { ...problems, ...errors };
  const blocking = Object.values(allProblems).filter(Boolean);

  // The preview follows the fields, a beat behind the typing.
  useEffect(() => {
    const n = ++request.current;
    const t = window.setTimeout(async () => {
      setRendering(true);
      try {
        const result = await previewCampaign(draft, previewLang);
        if (n !== request.current || !result) return;
        setPreview(result.email);
        setProblems(result.problems);
      } finally {
        if (n === request.current) setRendering(false);
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [draft, previewLang]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function set<K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  function save(then?: () => void) {
    startBusy(async () => {
      const r = await saveCampaign(id, draft);
      if (r.status === "error") {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.message);
        return;
      }
      setSaved(draft);
      toast.success(r.message);
      then?.();
      router.refresh();
    });
  }

  function goTo(next: Step) {
    if (dirty && canWrite) save(() => setStep(next));
    else setStep(next);
  }

  function sendTest() {
    startTest(async () => {
      const r = await sendCampaignTest(draft, previewLang);
      if (r.status === "ok") toast.success(r.message);
      else {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.message);
      }
    });
  }

  function sendNow() {
    if (
      !window.confirm(
        `Send "${draft.subject}" to ${recipients} subscriber${recipients === 1 ? "" : "s"} (${AUDIENCE_LABELS[draft.audience].toLowerCase()}) now? This can't be undone.`,
      )
    )
      return;
    startBusy(async () => {
      const r = await sendCampaignNow(id, draft);
      if (r.status === "error") {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.message);
        return;
      }
      setSaved(draft);
      toast.success(r.message);
      router.refresh();
    });
  }

  function schedule() {
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) {
      toast.error("Pick a date and time.");
      return;
    }
    startBusy(async () => {
      const r = await scheduleCampaign(id, draft, at.toISOString());
      if (r.status === "error") {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.message);
        return;
      }
      setSaved(draft);
      toast.success(`${r.message} It sends ${at.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`);
      router.refresh();
    });
  }

  function unschedule() {
    startBusy(async () => {
      const r = await unscheduleCampaign(id);
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Delete this draft? This can't be undone.")) return;
    startBusy(async () => {
      const r = await deleteCampaign(id);
      if (r?.status === "error") toast.error(r.message);
    });
  }

  const subjectKey = lang === "ar" ? "subject_ar" : "subject";
  const preheaderKey = lang === "ar" ? "preheader_ar" : "preheader";
  const bodyKey = lang === "ar" ? "body_ar" : "body";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,660px)] gap-6 items-start">
      <div className="flex flex-col gap-5 min-w-0">
        {/* Steps */}
        <ol className="flex flex-wrap items-center gap-2" aria-label="Steps">
          {STEPS.map((s, i) => {
            const on = s.id === step;
            const done = STEPS.findIndex((x) => x.id === step) > i;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goTo(s.id)}
                  aria-current={on ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 h-8 px-3 rounded-full border text-[12.5px] transition-colors",
                    on
                      ? "bg-bz-navy text-bz-bg border-bz-navy"
                      : "bg-bz-surface border-bz-border text-bz-ink-2 hover:border-bz-teal",
                  )}
                >
                  <span className={cn("mono text-[11px]", on ? "text-bz-bg/80" : "text-bz-muted")}>
                    {done ? <Check size={12} strokeWidth={2} /> : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 ? <ChevronRight size={14} className="text-bz-muted" /> : null}
              </li>
            );
          })}
        </ol>

        {status === "scheduled" ? (
          <div className="rounded-lg border border-[oklch(0.85_0.06_250)] bg-[oklch(0.97_0.02_250)] px-4 py-3 text-[13px] flex flex-wrap items-center gap-3">
            <CalendarClock size={15} strokeWidth={1.8} />
            <span>
              Scheduled for{" "}
              <strong>
                {scheduledAt ? new Date(scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" }) : "—"}
              </strong>
              . Edits you save still go out with it.
            </span>
            {canSend ? (
              <Button variant="outline" size="sm" onClick={unschedule} disabled={busy} className="ms-auto">
                Unschedule
              </Button>
            ) : null}
          </div>
        ) : null}

        {step === "write" ? (
          <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Eyebrow>Newsletter</Eyebrow>
              <div role="tablist" aria-label="Edition" className="ms-auto inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
                {(["en", "ar"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="tab"
                    aria-selected={lang === l}
                    onClick={() => {
                      setLang(l);
                      setPreviewLang(l);
                    }}
                    className={cn(
                      "h-6 px-2.5 rounded text-[11.5px] transition-colors",
                      lang === l ? "bg-bz-navy text-bz-bg font-medium" : "text-bz-ink-2 hover:text-bz-ink",
                    )}
                  >
                    {l === "en" ? "English" : "العربية"}
                    {l === "ar" ? <span className="ms-1 opacity-70">{arabicReady ? "✓" : "optional"}</span> : null}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[12px] text-bz-muted max-w-[70ch] -mt-2">
              {lang === "ar"
                ? "Arabic subscribers receive this edition. Leave both the Arabic subject and newsletter empty and they receive the English instead."
                : "Everyone receives this edition, unless you write an Arabic one for Arabic subscribers."}
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-bz-ink-2">Subject</span>
              <input
                dir={lang === "ar" ? "rtl" : "ltr"}
                lang={lang}
                value={draft[subjectKey]}
                onChange={(e) => set(subjectKey, e.target.value)}
                disabled={locked}
                maxLength={200}
                className={cn(INPUT, allProblems[subjectKey] ? "border-[oklch(0.6_0.15_28)]" : "border-bz-border")}
              />
              {allProblems[subjectKey] ? <span className={FIELD_ERROR}>{allProblems[subjectKey]}</span> : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-bz-ink-2">Preview line</span>
              <input
                dir={lang === "ar" ? "rtl" : "ltr"}
                lang={lang}
                value={draft[preheaderKey]}
                onChange={(e) => set(preheaderKey, e.target.value)}
                disabled={locked}
                maxLength={200}
                placeholder="Optional — the line inboxes show after the subject"
                className={cn(INPUT, "border-bz-border")}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-bz-ink-2">Newsletter</span>
              {locked ? (
                <div
                  className="rounded border border-bz-border bg-bz-bg p-3 text-[13px] [&_p]:mb-2 [&_a]:underline"
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  dangerouslySetInnerHTML={{ __html: draft[bodyKey] }}
                />
              ) : (
                <EmailBodyEditor
                  key={lang}
                  defaultValue={draft[bodyKey]}
                  onChange={(html) => set(bodyKey, html)}
                  tokens={tokens}
                  media={media}
                  onMediaUploaded={(m) => setMedia((list) => [m, ...list])}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  lang={lang}
                />
              )}
              {allProblems[bodyKey] ? (
                <span className={FIELD_ERROR}>{allProblems[bodyKey]}</span>
              ) : (
                <span className="text-[11.5px] text-bz-muted">
                  Headings, lists, links, buttons and images. The logo, colours and footer come from{" "}
                  <Link href="/admin/content-assets/design" className="underline">
                    Email design
                  </Link>
                  , and every newsletter ends with the subscriber&apos;s own unsubscribe link.
                </span>
              )}
            </div>

            {lang === "ar" && draft.body ? (
              <details className="rounded border border-bz-border bg-bz-surface-2 px-3 py-2">
                <summary className="cursor-pointer text-[12px] text-bz-ink-2">The English, to translate from</summary>
                <p className="mt-2 text-[12px] text-bz-muted">{draft.subject || "No subject"}</p>
                <div
                  className="mt-2 text-[12.5px] text-bz-ink-2 [&_p]:mb-2 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: draft.body }}
                />
              </details>
            ) : null}
          </section>
        ) : null}

        {step === "audience" ? (
          <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-3">
            <Eyebrow>Who receives it</Eyebrow>
            <p className="text-[12.5px] text-bz-muted -mt-1">
              Only confirmed subscribers — people who clicked the link in their confirmation email. The list is taken
              the moment it sends, and anyone who unsubscribes before their copy goes out is skipped.
            </p>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Audience">
              {(["all", "en", "ar"] as const).map((a) => (
                <label
                  key={a}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer",
                    draft.audience === a ? "border-bz-navy bg-bz-surface-2" : "border-bz-border",
                  )}
                >
                  <input
                    type="radio"
                    name="audience"
                    checked={draft.audience === a}
                    onChange={() => set("audience", a)}
                    disabled={locked}
                    className="accent-bz-navy"
                  />
                  <span className="text-[13px]">{AUDIENCE_LABELS[a]}</span>
                  <span className="ms-auto mono text-[12px] text-bz-muted">{audienceCounts[a]}</span>
                </label>
              ))}
            </div>
            {allProblems.audience ? <span className={FIELD_ERROR}>{allProblems.audience}</span> : null}
            {draft.audience !== "en" && audienceCounts.ar > 0 ? (
              <p className="text-[12px] text-bz-muted">
                {arabicReady
                  ? `${audienceCounts.ar} Arabic subscriber${audienceCounts.ar === 1 ? "" : "s"} will get the Arabic edition.`
                  : `No Arabic edition yet: ${audienceCounts.ar} Arabic subscriber${audienceCounts.ar === 1 ? "" : "s"} will get the English.`}
              </p>
            ) : null}
            <Link href="/admin/newsletter/subscribers" className="text-[12px] underline text-bz-ink-2 w-fit">
              See the subscribers
            </Link>
          </section>
        ) : null}

        {step === "send" ? (
          <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-4">
            <Eyebrow>Review & send</Eyebrow>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
              <dt className="text-bz-muted">Subject</dt>
              <dd>{draft.subject || <span className="text-bz-muted italic">none yet</span>}</dd>
              <dt className="text-bz-muted">Arabic edition</dt>
              <dd dir={arabicReady ? "rtl" : undefined} className={arabicReady ? "text-start" : "text-bz-muted"}>
                {arabicReady ? draft.subject_ar : "None — Arabic subscribers get the English"}
              </dd>
              <dt className="text-bz-muted">Audience</dt>
              <dd>
                {AUDIENCE_LABELS[draft.audience]} · <span className="mono">{recipients}</span>
              </dd>
              <dt className="text-bz-muted">From</dt>
              <dd className="break-all">{from}</dd>
            </dl>

            {blocking.length > 0 ? (
              <ul className="rounded border border-[oklch(0.85_0.08_70)] bg-[oklch(0.97_0.03_80)] px-3 py-2 text-[12px] text-[oklch(0.4_0.08_60)] flex flex-col gap-1">
                {blocking.map((p) => (
                  <li key={p} className="flex gap-2">
                    <AlertTriangle size={13} strokeWidth={1.8} className="shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-bz-ink-2">
                Ready. Send yourself a test from the preview first — it&apos;s the exact email, in the language the
                preview shows.
              </p>
            )}

            {canSend ? (
              <div className="flex flex-col gap-4 border-t border-bz-border pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={sendNow} disabled={busy || blocking.length > 0 || recipients === 0}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={1.8} />}
                    Send now to {recipients} subscriber{recipients === 1 ? "" : "s"}
                  </Button>
                  {recipients === 0 ? (
                    <span className="text-[12px] text-bz-muted">Nobody confirmed in this audience yet.</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-bz-ink-2">Or schedule it</span>
                    <input
                      type="datetime-local"
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                      className="h-9 border border-bz-border rounded px-2 text-[13px] bg-bz-bg outline-none focus:border-bz-accent"
                    />
                  </label>
                  <Button variant="outline" onClick={schedule} disabled={busy || blocking.length > 0}>
                    <CalendarClock size={14} strokeWidth={1.8} />
                    {status === "scheduled" ? "Reschedule" : "Schedule"}
                  </Button>
                  <span className="text-[11.5px] text-bz-muted pb-2">Your computer&apos;s time zone.</span>
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-bz-muted border-t border-bz-border pt-4">
                Sending to the list is for admins and marketing. Save your draft and ask one of them to send it.
              </p>
            )}
          </section>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {step !== "write" ? (
            <Button variant="ghost" onClick={() => goTo(step === "send" ? "audience" : "write")}>
              <ChevronLeft size={14} /> Back
            </Button>
          ) : null}
          {canWrite ? (
            <Button variant="outline" onClick={() => save()} disabled={busy || !dirty}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.8} />}
              {dirty ? "Save draft" : "Saved"}
            </Button>
          ) : null}
          {step !== "send" ? (
            <Button onClick={() => goTo(step === "write" ? "audience" : "send")} disabled={busy}>
              Next <ChevronRight size={14} />
            </Button>
          ) : null}
          {canWrite && status === "draft" ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="ms-auto inline-flex items-center gap-1.5 text-[12px] text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
            >
              <Trash2 size={12} strokeWidth={1.8} /> Delete draft
            </button>
          ) : null}
        </div>
        <p className="text-[11.5px] text-bz-muted -mt-3">
          {dirty
            ? "You have unsaved changes."
            : `Last saved ${new Date(updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`}
        </p>
      </div>

      {/* Preview */}
      <div className="flex flex-col gap-3 xl:sticky xl:top-6 min-w-0">
        <section className="rounded-lg border border-bz-border bg-bz-surface-2 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-bz-border bg-bz-surface">
            <div role="tablist" aria-label="Preview language" className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
              {(["en", "ar"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={previewLang === l}
                  onClick={() => setPreviewLang(l)}
                  className={cn(
                    "h-6 px-2 rounded text-[11.5px] transition-colors",
                    previewLang === l ? "bg-bz-navy text-bz-bg font-medium" : "text-bz-ink-2 hover:text-bz-ink",
                  )}
                >
                  {l === "en" ? "English subscriber" : "Arabic subscriber"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowText((v) => !v)}
              aria-pressed={showText}
              className={cn(
                "h-6 px-2 rounded text-[11.5px] border",
                showText ? "bg-bz-navy text-bz-bg border-bz-navy" : "border-bz-border text-bz-ink-2",
              )}
            >
              Plain text
            </button>
            {rendering ? <Loader2 size={12} className="animate-spin text-bz-muted" aria-label="Updating preview" /> : null}
            {!showText ? (
              <div className="ms-auto">
                <ViewportToggle value={viewport} onChange={setViewport} />
              </div>
            ) : null}
          </div>
          {previewLang === "ar" && !arabicReady ? (
            <p className="px-4 py-2 text-[11.5px] text-bz-muted bg-bz-surface border-b border-bz-border">
              No Arabic edition yet, so Arabic subscribers get the English below.
            </p>
          ) : null}
          <InboxHeader from={from} replyTo={replyTo} to="subscriber@example.com" subject={preview?.subject ?? draft.subject} />
          {showText ? (
            <pre className="m-0 p-4 bg-white text-[12.5px] leading-relaxed text-bz-ink whitespace-pre-wrap break-words font-mono min-h-[320px]">
              {preview?.text ?? ""}
            </pre>
          ) : preview ? (
            <EmailFrame html={preview.html} viewport={viewport} title="Newsletter preview" className="py-4" />
          ) : (
            <div className="min-h-[320px] grid place-items-center text-[12px] text-bz-muted">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
        </section>
        {canWrite ? (
          <Button variant="outline" onClick={sendTest} disabled={testing} className="self-start">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={1.8} />}
            Send me a test ({previewLang === "ar" ? "Arabic" : "English"})
          </Button>
        ) : null}
      </div>
    </div>
  );
}
