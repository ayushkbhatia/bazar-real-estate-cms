import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import type { ReadAnswers } from "@/lib/enquiries/answers";
import type { EnquiryOrigin, SourcePage } from "@/lib/enquiries/origin";
import type { LeadFact } from "@/lib/enquiries/profile";

/**
 * What the lead actually sent: which form, on which page, and every answer.
 *
 * Until this card the desk saw a name, a contact block and a paragraph of
 * brief — "via contact page" for half the public forms, the page never, and
 * the answers only as the lines the brief happened to carry. Everything here
 * was already stored; it was simply never read back.
 */
export function SubmissionCard({
  origin,
  page,
  facts,
  answers,
  canEditForms,
}: {
  origin: EnquiryOrigin;
  /** The page the submission was sent from, or null when none was recorded. */
  page: SourcePage | null;
  facts: LeadFact[];
  /** The submission read back, or null when no submission was logged. */
  answers: ReadAnswers | null;
  /** The Forms Manager is admin / editor / marketing only. */
  canEditForms: boolean;
}) {
  const def = origin.def;

  return (
    <section
      aria-label="What they sent"
      className="bg-bz-surface border border-bz-border rounded-lg"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <Eyebrow>Came in through</Eyebrow>
            <div className="mt-1.5 text-[15px] leading-snug">
              <span className="font-medium text-bz-ink">
                {origin.form ?? origin.surface}
              </span>
              {origin.form ? (
                <span className="text-bz-muted"> · {origin.surface}</span>
              ) : null}
            </div>
            {origin.form ? null : (
              <div className="mt-0.5 text-[12.5px] text-bz-muted">
                {origin.viaForm
                  ? "Which form it came through wasn't recorded."
                  : "Not through a website form."}
              </div>
            )}
          </div>
          {canEditForms && def ? (
            <Link
              href={`/admin/forms/${def.key}`}
              className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
            >
              Form &amp; responses <ChevronRight size={11} />
            </Link>
          ) : null}
        </div>

        {def?.description ? (
          <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-relaxed max-w-[70ch]">
            {def.description}
          </p>
        ) : null}

        <dl className="mt-4 grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-[12.5px]">
          <dt className="text-bz-muted pt-px">Page</dt>
          <dd className="min-w-0">
            {page ? (
              <PageLine page={page} />
            ) : (
              <span className="text-bz-muted">
                Not recorded for this enquiry
                {def ? (
                  <>
                    {" "}
                    — this form sits on{" "}
                    <span className="mono text-bz-ink-2">{def.path}</span>
                  </>
                ) : null}
                .
              </span>
            )}
          </dd>
        </dl>
      </div>

      {facts.length > 0 ? (
        <ul
          aria-label="At a glance"
          className="px-5 pb-4 flex flex-wrap gap-1.5"
        >
          {facts.map((fact) => (
            <li
              key={fact.label}
              className="inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-full bg-bz-surface-2 text-[11.5px]"
            >
              <span className="text-bz-muted">{fact.label}</span>
              <span className="text-bz-ink font-medium">{fact.value}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {answers ? (
        <AnswerList answers={answers} />
      ) : (
        <p className="border-t border-bz-border px-5 py-4 text-[12.5px] text-bz-muted leading-relaxed">
          {origin.viaForm
            ? "The individual answers weren't logged for this enquiry. The brief at the top of the conversation is what came through."
            : "Nothing was filled in — the conversation below has what they said."}
        </p>
      )}
    </section>
  );
}

function PageLine({ page }: { page: SourcePage }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-bz-ink">
        <span>
          {page.kind}
          {page.name ? (
            <>
              <span className="text-bz-muted"> · </span>
              <span>{page.name}</span>
            </>
          ) : null}
        </span>
        {page.locale === "ar" ? (
          <span className="inline-flex items-center h-[18px] px-1.5 rounded border border-bz-border text-[10.5px] text-bz-ink-2">
            Arabic site
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
        <span className="mono text-bz-muted break-all">{page.href}</span>
        <a
          href={page.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-bz-muted hover:text-bz-ink"
        >
          View page <ExternalLink size={11} />
        </a>
        {page.edit ? (
          <Link
            href={page.edit.href}
            className="inline-flex items-center gap-1 text-bz-muted hover:text-bz-ink"
          >
            {page.edit.label} <ChevronRight size={11} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function AnswerList({ answers }: { answers: ReadAnswers }) {
  const count = answers.answers.length;
  return (
    // Open by default: this is the first read of a lead. Collapsible because
    // on the fifth visit the conversation is what the advisor came for.
    <details open className="group border-t border-bz-border">
      <summary className="flex items-center justify-between gap-3 px-5 py-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <Eyebrow>
          Their answers{count > 0 ? ` · ${count}` : ""}
        </Eyebrow>
        <ChevronDown
          size={14}
          strokeWidth={1.7}
          className="text-bz-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-5 pb-5">
        {count > 0 ? (
          <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
            {answers.answers.map((answer) => (
              <div
                key={answer.key}
                className={cn("min-w-0", answer.long && "sm:col-span-2")}
              >
                <dt className="text-[11.5px] text-bz-muted">{answer.label}</dt>
                <dd
                  dir="auto"
                  className="mt-0.5 text-[13px] text-bz-ink leading-relaxed whitespace-pre-line break-words"
                >
                  {answer.value}
                </dd>
                {answer.askedAs ? (
                  // <bdi>: the wording may be the Arabic label, and an
                  // unisolated RTL run drags the closing quote with it.
                  <dd className="mt-0.5 text-[11px] text-bz-muted-2">
                    Asked as “<bdi>{answer.askedAs}</bdi>”
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-[12.5px] text-bz-muted">
            Only their contact details — the form asked nothing else.
          </p>
        )}

        {answers.scenario ? (
          <div className="mt-4 rounded-md border border-bz-border bg-bz-surface-2 px-3.5 py-3">
            <div className="text-[11.5px] text-bz-muted">
              The calculator as it stood when they pressed send
            </div>
            <p className="mt-1 text-[13px] text-bz-ink leading-relaxed whitespace-pre-line">
              {answers.scenario}
            </p>
          </div>
        ) : null}

        {answers.skipped.length > 0 || answers.consented !== null ? (
          <div className="mt-4 flex flex-col gap-1 text-[12px] text-bz-muted">
            {answers.skipped.length > 0 ? (
              <p>
                <span className="text-bz-ink-2">Left blank:</span>{" "}
                {answers.skipped.join(", ")}
              </p>
            ) : null}
            {answers.consented === true ? (
              <p className="inline-flex items-center gap-1.5">
                <Check size={12} strokeWidth={2} className="text-bz-success" />
                Agreed to be contacted
              </p>
            ) : answers.consented === false ? (
              <p className="inline-flex items-center gap-1.5 text-bz-danger">
                <X size={12} strokeWidth={2} />
                Did not tick the consent box
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
