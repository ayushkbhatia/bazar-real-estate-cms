"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { call, putFile, type Presigned } from "@/lib/mortgage-requests/client/api";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { declineReasonsFor } from "@/lib/mortgage-requests/decline";
import { preApprovalMessage, type OfferForMessage } from "@/lib/mortgage-requests/pre-approval";
import { cn } from "@/lib/utils";
import { declineApplication, preApprove, recordBankResponse, sendBankReminder } from "../_decision-actions";
import { BankMark, DeclineFields, useAction, useDeclineDraft, type Target } from "./file-actions";
import { Card, KeyValueList, Pill, Thumb, type Tone } from "./ui";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

const LINK = "text-[12px] text-bz-accent hover:underline disabled:cursor-not-allowed disabled:text-bz-muted disabled:no-underline";

/** A bank's offer as C5 prints it: the figures, and the words the server formatted in Dubai time. */
export type OfferView = {
  amountAed: number;
  ratePct: number;
  rateType: "fixed" | "variable";
  fixedYears: number | null;
  /** "YYYY-MM-DD". */
  validUntil: string;
  /** "AED 2,150,000". */
  amount: string;
  /** "3.99% fixed · 3 yrs". */
  rate: string;
  /** "AED 11,337" over 25 years (payments.ts). */
  monthly: string;
  /** "3.99% fixed for 3 years". */
  leadRate: string;
  /** "21 Nov 2026 · 60 days". */
  valid: string;
  /** "21 November 2026", as the message says it. */
  validWords: string;
  expired: boolean;
  /** "21 Nov 2026". */
  expiredOn: string;
};

export type BankRowView = {
  id: string;
  bank: { id: string; code: string; name: string; label: string; color: string | null };
  status: "sent" | "pre_approved" | "declined" | "withdrawn";
  /** "Pre-approved · 18:31", "Awaiting reply · sent 17:05". */
  pill: string;
  /** "Reminder sent 09:12", for a bank still deciding. */
  reminder: string | null;
  offer: OfferView | null;
  letter: { id: string; name: string } | null;
  notes: string | null;
};

export type DecidedView = {
  kind: "pre_approved" | "declined";
  leadId: string | null;
  message: string | null;
  /** A decline's reason, as the team reads it. */
  reason: string | null;
  /** "Yasmin Abdalla · today 18:40". */
  line: string;
};

const PILL_TONE: Record<BankRowView["status"], Tone> = {
  sent: "muted",
  pre_approved: "success",
  declined: "danger",
  withdrawn: "muted",
};

/** An offer can lead once it's in date and its letter is checked: the letter goes with the email. */
function leadable(row: BankRowView): boolean {
  return row.status === "pre_approved" && !!row.offer && !row.offer.expired && !!row.letter;
}

/** Until the adviser picks, the largest offer that can lead does. */
function bestOffer(rows: readonly BankRowView[]): string | null {
  return rows.filter(leadable).sort((a, b) => b.offer!.amountAed - a.offer!.amountAed)[0]?.id ?? null;
}

/** Why a pre-approved offer can't lead, or null when it can. */
function whyNotLead(row: BankRowView): string | null {
  if (!row.offer) return null;
  if (row.offer.expired) return t("c5.lead.expired", { bank: row.bank.label, date: row.offer.expiredOn });
  if (!row.letter) return t("c5.lead.letterMissing", { bank: row.bank.label });
  return null;
}

function forMessage(row: BankRowView): OfferForMessage {
  const o = row.offer!;
  return {
    bankName: row.bank.name,
    bankLabel: row.bank.label,
    amountAed: o.amountAed,
    ratePct: o.ratePct,
    rateType: o.rateType,
    fixedYears: o.fixedYears,
    validUntil: o.validUntil,
  };
}

/**
 * C5's two columns. The lead offer is chosen on the left and fills the
 * decision card on the right, so both live here; the tiles and the activity
 * are drawn by the server and passed in.
 */
export function DecisionView({
  target,
  firstName,
  myFirstName,
  rows,
  basis,
  canAct,
  consentOk,
  elapsed,
  decided,
  tiles,
  activity,
}: {
  target: Target;
  firstName: string;
  myFirstName: string;
  rows: readonly BankRowView[];
  basis: string;
  /** The owner or the Head, on a file still with the banks. */
  canAct: boolean;
  consentOk: boolean;
  /** The clock's elapsed time, "8h 41m" (slaStatus), or null with no clock. */
  elapsed: string | null;
  decided: DecidedView | null;
  tiles: ReactNode;
  activity: ReactNode;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const lead = decided ? decided.leadId : picked && rows.some((r) => r.id === picked && leadable(r)) ? picked : bestOffer(rows);
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-4">
        {tiles}
        <BankResponses rows={rows} lead={lead} onLead={setPicked} target={target} basis={basis} canAct={canAct} decided={!!decided} />
        {activity}
      </div>
      {decided ? (
        <DecidedCard decided={decided} lead={rows.find((r) => r.id === decided.leadId) ?? null} firstName={firstName} />
      ) : (
        <DecisionCard
          target={target}
          firstName={firstName}
          myFirstName={myFirstName}
          rows={rows}
          lead={rows.find((r) => r.id === lead) ?? null}
          canAct={canAct}
          consentOk={consentOk}
          elapsed={elapsed}
        />
      )}
    </div>
  );
}

// ── Partner bank responses ───────────────────────────────────────

function BankResponses({
  rows,
  lead,
  onLead,
  target,
  basis,
  canAct,
  decided,
}: {
  rows: readonly BankRowView[];
  lead: string | null;
  onLead: (id: string) => void;
  target: Target;
  basis: string;
  canAct: boolean;
  decided: boolean;
}) {
  const { pending, run } = useAction();
  const [recording, setRecording] = useState<BankRowView | null>(null);
  const group = useId();
  return (
    <Card
      title={t("c5.banks.title")}
      aside={decided ? null : <span className="text-[12px] text-bz-muted">{t("c5.banks.hint")}</span>}
      bodyClassName="p-0"
    >
      <fieldset>
        <legend className="sr-only">{t("c5.banks.hint")}</legend>
        {rows.map((row, i) => {
          const on = lead === row.id;
          const why = whyNotLead(row);
          return (
            <div
              key={row.id}
              data-testid={`bank-row-${row.bank.code}`}
              className={cn(
                "grid grid-cols-[22px_38px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 px-5 py-4 md:grid-cols-[22px_38px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,.9fr)]",
                i > 0 && "border-t border-bz-border",
                // The lead row's tint takes muted labels under AA (4.2:1): darker there.
                on && "bg-bz-surface-2 [&_.text-bz-muted]:text-bz-ink-2",
              )}
            >
              {row.status === "pre_approved" && row.offer ? (
                <input
                  type="radio"
                  name={group}
                  value={row.id}
                  checked={on}
                  disabled={decided || !!why}
                  onChange={() => onLead(row.id)}
                  aria-label={[row.bank.name, `${t("c5.bank.upTo")} ${row.offer.amount}`, row.offer.rate].join(", ")}
                  title={why ?? undefined}
                  className="size-[22px] cursor-pointer appearance-none rounded-full border-[1.5px] border-bz-border-strong bg-bz-surface checked:border-[7px] checked:border-bz-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-accent disabled:cursor-not-allowed [&:disabled:not(:checked)]:opacity-40"
                />
              ) : (
                <span />
              )}
              <BankMark code={row.bank.code} color={row.bank.color} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium">{row.bank.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Pill tone={PILL_TONE[row.status]} small dot={row.status === "pre_approved"}>
                    {row.pill}
                  </Pill>
                  {row.reminder ? <span className="text-[11.5px] text-bz-muted">{row.reminder}</span> : null}
                  {canAct && (row.status === "pre_approved" || row.status === "declined") ? (
                    <button
                      type="button"
                      className={LINK}
                      onClick={() => setRecording(row)}
                      aria-label={t("c5.record.edit", { bank: row.bank.label })}
                    >
                      {t("c5.bank.editResponse")}
                    </button>
                  ) : null}
                </div>
                {why && row.offer && !decided ? <p className="mt-1 text-[11.5px] text-[oklch(0.48_0.16_28)]">{why}</p> : null}
              </div>
              {row.offer ? (
                <div className="col-start-3 grid grid-cols-3 gap-3 md:contents">
                  <Figure label={t("c5.bank.upTo")} value={row.offer.amount} mono strong />
                  <Figure label={t("c5.bank.rate")} value={row.offer.rate} />
                  <Figure label={t("c5.bank.monthly")} value={row.offer.monthly} mono />
                </div>
              ) : row.status === "sent" && canAct ? (
                <div className="col-start-3 flex flex-wrap gap-2 md:col-[4/-1] md:justify-end">
                  <Button variant="outline" size="sm" className="h-[30px] px-3 text-[12.5px]" onClick={() => setRecording(row)}>
                    {t("c5.bank.record")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-[30px] px-3 text-[12.5px]"
                    disabled={pending}
                    onClick={() => run(() => sendBankReminder({ ...target, submissionId: row.id }))}
                  >
                    {t("c5.bank.reminder")}
                  </Button>
                </div>
              ) : row.status === "declined" && row.notes ? (
                <p className="col-start-3 text-[12px] text-bz-muted md:col-[4/-1]">{row.notes}</p>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      {rows.every((r) => r.status === "sent") ? (
        <p className="border-t border-bz-border px-5 py-3 text-[12px] text-bz-ink-2">{t("c5.banks.none")}</p>
      ) : null}
      <p className="border-t border-bz-border px-5 py-3 text-[12px] text-bz-muted">{basis}</p>
      {recording ? <RecordResponseDialog key={recording.id} row={recording} target={target} onClose={() => setRecording(null)} /> : null}
    </Card>
  );
}

function Figure({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-bz-muted">{label}</div>
      <div className={cn("mt-0.5 truncate", mono && "mono", strong ? "text-[13.5px] font-medium" : "text-[13px]")}>{value}</div>
    </div>
  );
}

// ── Record response (CMS-2: not designed) ────────────────────────

type LetterCheck = { status: "ready"; fileId: string } | { status: "scanning"; fileId: string };

/**
 * The bank's answer, entered by the adviser: an offer's figures and its
 * letter, or a decline. The letter goes straight to the private bucket and is
 * checked before it can be saved with the offer.
 */
function RecordResponseDialog({ row, target, onClose }: { row: BankRowView; target: Target; onClose: () => void }) {
  const { pending, run } = useAction();
  const o = row.offer;
  const [status, setStatus] = useState<"pre_approved" | "declined">(row.status === "declined" ? "declined" : "pre_approved");
  const [amount, setAmount] = useState(o ? String(o.amountAed) : "");
  const [rate, setRate] = useState(o ? String(o.ratePct) : "");
  const [rateType, setRateType] = useState<"fixed" | "variable">(o?.rateType ?? "fixed");
  const [years, setYears] = useState(o?.fixedYears ? String(o.fixedYears) : "");
  const [validUntil, setValidUntil] = useState(o?.validUntil ?? "");
  const [letter, setLetter] = useState(row.letter);
  const [upload, setUpload] = useState<"idle" | "busy" | "failed" | "slow">("idle");
  const [notes, setNotes] = useState(row.notes ?? "");
  const fileInput = useRef<HTMLInputElement>(null);
  const id = useId();

  const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v.replace(/[,\s]/g, "")));
  const amountN = num(amount);
  const rateN = num(rate);
  const yearsN = num(years);
  const offerOk =
    amountN > 0 &&
    amountN <= 100_000_000 &&
    rateN > 0 &&
    rateN < 30 &&
    /^\d{4}-\d{2}-\d{2}$/.test(validUntil) &&
    (rateType === "variable" || (Number.isInteger(yearsN) && yearsN >= 1 && yearsN <= 30));
  const ready = status === "declined" || (offerOk && !!letter && upload !== "busy");

  async function pick(file: File) {
    setUpload("busy");
    try {
      const presigned = await call<Presigned>("/api/admin/mortgages/letters", {
        method: "POST",
        body: JSON.stringify({ submissionId: row.id, name: file.name, size: file.size }),
      });
      await putFile(presigned, file, () => undefined, new AbortController().signal);
      const complete = () => call<LetterCheck>(`/api/admin/mortgages/letters/${presigned.fileId}/complete`, { method: "POST" });
      let checked = await complete();
      for (let i = 0; checked.status === "scanning" && i < 8; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        checked = await complete();
      }
      if (checked.status !== "ready") {
        setUpload("slow");
        return;
      }
      setLetter({ id: presigned.fileId, name: file.name });
      setUpload("idle");
    } catch {
      setUpload("failed");
    }
  }

  const choice = (on: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px]",
      on ? "border-transparent bg-bz-ink font-medium text-bz-bg" : "border-bz-border bg-bz-surface text-bz-ink hover:border-bz-border-strong",
    );
  const label = "text-[12px] font-medium text-bz-ink-2";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {row.status === "sent" ? t("c5.record.title", { bank: row.bank.label }) : t("c5.record.edit", { bank: row.bank.label })}
          </DialogTitle>
          <DialogDescription>{row.bank.name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className={label}>{t("c5.record.outcome")}</legend>
            <div className="mt-1.5 flex gap-1.5">
              {(["pre_approved", "declined"] as const).map((value) => (
                <label key={value} className={cn(choice(status === value), "cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-bz-accent")}>
                  <input
                    type="radio"
                    name={`${id}-status`}
                    className="sr-only"
                    checked={status === value}
                    onChange={() => setStatus(value)}
                    disabled={pending}
                  />
                  {status === value ? <Check size={12} strokeWidth={2.6} aria-hidden /> : null}
                  {value === "pre_approved" ? t("c5.record.preApproved") : t("c5.record.declined")}
                </label>
              ))}
            </div>
          </fieldset>

          {status === "pre_approved" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${id}-amount`} className={label}>
                    {t("c5.record.amount")}
                  </label>
                  <Input
                    id={`${id}-amount`}
                    inputMode="numeric"
                    autoComplete="off"
                    className="mono mt-1.5 h-9"
                    value={amount}
                    disabled={pending}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor={`${id}-rate`} className={label}>
                    {t("c5.record.rate")}
                  </label>
                  <Input
                    id={`${id}-rate`}
                    inputMode="decimal"
                    autoComplete="off"
                    className="mono mt-1.5 h-9"
                    value={rate}
                    disabled={pending}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 items-end gap-3">
                <fieldset>
                  <legend className={label}>{t("c5.record.type")}</legend>
                  <div className="mt-1.5 flex gap-1.5">
                    {(["fixed", "variable"] as const).map((value) => (
                      <label key={value} className={cn(choice(rateType === value), "cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-bz-accent")}>
                        <input
                          type="radio"
                          name={`${id}-type`}
                          className="sr-only"
                          checked={rateType === value}
                          onChange={() => setRateType(value)}
                          disabled={pending}
                        />
                        {value === "fixed" ? t("c5.record.fixed") : t("c5.record.variable")}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {rateType === "fixed" ? (
                  <div>
                    <label htmlFor={`${id}-years`} className={label}>
                      {t("c5.record.years")}
                    </label>
                    <Input
                      id={`${id}-years`}
                      inputMode="numeric"
                      autoComplete="off"
                      className="mono mt-1.5 h-9"
                      value={years}
                      disabled={pending}
                      onChange={(e) => setYears(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <label htmlFor={`${id}-valid`} className={label}>
                  {t("c5.record.validUntil")}
                </label>
                <Input
                  id={`${id}-valid`}
                  type="date"
                  className="mt-1.5 h-9 w-[180px]"
                  value={validUntil}
                  disabled={pending}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
              <div>
                <div className={label}>{t("c5.record.letter")}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                  {letter ? (
                    <span className="inline-flex max-w-[300px] items-center gap-2.5 rounded-lg border border-bz-border py-1.5 ps-1.5 pe-3">
                      <Thumb image={false} />
                      <span className="mono min-w-0 truncate text-[11.5px]">{letter.name}</span>
                      <Check size={14} strokeWidth={2.4} aria-hidden className="shrink-0 text-[oklch(0.5_0.12_145)]" />
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-[12.5px]"
                    disabled={pending || upload === "busy"}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload strokeWidth={1.6} />
                    {letter ? t("c5.record.letterReplace") : t("c5.record.letterUpload")}
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label={t("c5.record.letterUpload")}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void pick(file);
                    }}
                  />
                </div>
                <p aria-live="polite" className="mt-1.5 text-[11.5px]">
                  {upload === "busy" ? (
                    <span className="text-bz-muted">{t("c5.record.letterBusy")}</span>
                  ) : upload === "failed" ? (
                    <span className="text-[oklch(0.48_0.16_28)]">{t("c5.record.letterFailed")}</span>
                  ) : upload === "slow" ? (
                    <span className="text-bz-ink-2">{t("c5.record.letterSlow")}</span>
                  ) : null}
                </p>
              </div>
            </>
          ) : null}

          <div>
            <label htmlFor={`${id}-notes`} className={label}>
              {t("c5.record.notes")}
            </label>
            <textarea
              id={`${id}-notes`}
              rows={3}
              maxLength={1000}
              value={notes}
              disabled={pending}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 w-full resize-y rounded-md border border-bz-border bg-bz-surface px-3 py-2 text-[12.5px] leading-[1.5] outline-none focus-visible:border-bz-accent"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!ready || pending}
            onClick={() =>
              run(
                () =>
                  recordBankResponse({
                    ...target,
                    submissionId: row.id,
                    status,
                    amountAed: status === "pre_approved" ? amountN : null,
                    ratePct: status === "pre_approved" ? rateN : null,
                    rateType: status === "pre_approved" ? rateType : null,
                    fixedYears: status === "pre_approved" && rateType === "fixed" ? yearsN : null,
                    validUntil: status === "pre_approved" ? validUntil : null,
                    letterFileId: status === "pre_approved" ? (letter?.id ?? null) : null,
                    notes: notes.trim(),
                    bank: row.bank.label,
                  }),
                (r) => r.ok && onClose(),
              )
            }
          >
            {t("c5.record.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── The decision ─────────────────────────────────────────────────

/** The lead bank's letter: opened through the team's file route, which logs it first. */
function LetterRow({ letter }: { letter: { id: string; name: string } }) {
  return (
    <a
      href={`/api/admin/mortgages/files/${letter.id}`}
      target="_blank"
      rel="noreferrer"
      className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-bz-border px-2.5 py-2 hover:border-bz-border-strong"
    >
      <Thumb image={false} />
      <span className="mono min-w-0 flex-1 truncate text-[11.5px]">{letter.name}</span>
      <Check size={14} strokeWidth={2.4} aria-hidden className="shrink-0 text-[oklch(0.5_0.12_145)]" />
    </a>
  );
}

function LeadRows({ lead, decided }: { lead: BankRowView; decided?: boolean }) {
  const o = lead.offer!;
  return (
    <>
      <KeyValueList
        rows={[
          [t("c5.lead.offer"), t("c5.lead.offerValue", { bank: lead.bank.label, amount: o.amount })],
          [t("c5.lead.rate"), o.leadRate],
          [t("c5.lead.validUntil"), decided || o.expired ? o.expiredOn : o.valid],
        ]}
      />
      {lead.letter ? <LetterRow letter={lead.letter} /> : null}
    </>
  );
}

type Mode = "pre_approve" | "decline";

function DecisionCard({
  target,
  firstName,
  myFirstName,
  rows,
  lead,
  canAct,
  consentOk,
  elapsed,
}: {
  target: Target;
  firstName: string;
  myFirstName: string;
  rows: readonly BankRowView[];
  lead: BankRowView | null;
  canAct: boolean;
  consentOk: boolean;
  elapsed: string | null;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [mode, setMode] = useState<Mode>("pre_approve");
  // Null until the adviser types: the message follows the lead offer until then, and keeps their words after.
  const [text, setText] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState(true);
  const decline = useDeclineDraft(firstName, myFirstName);
  const id = useId();

  const others = rows
    .filter((r) => r.id !== lead?.id && r.status === "pre_approved" && r.offer && !r.offer.expired)
    .sort((a, b) => b.offer!.amountAed - a.offer!.amountAed);
  const draft = lead?.offer
    ? preApprovalMessage(forMessage(lead), others.map(forMessage), { applicantFirstName: firstName, adviserFirstName: myFirstName })
    : "";
  const message = text ?? draft;
  const waiting = rows.filter((r) => r.status === "sent").length;
  const blocked = !canAct
    ? t("common.notOwner")
    : !consentOk
      ? t("c5.cta.needsConsent")
      : !lead
        ? t("c5.cta.needsLead")
        : !message.trim()
          ? t("decline.messageRequired", { firstName })
          : null;
  // Why nothing leads yet: an expired offer or an unchecked letter says so; otherwise, choose one.
  const noLead = rows.map(whyNotLead).find(Boolean) ?? t("c5.lead.none");
  const toFile = () => router.push(`/admin/mortgages/${encodeURIComponent(target.reference)}`);

  const onTabKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next: Mode = mode === "pre_approve" ? "decline" : "pre_approve";
    setMode(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
    e.preventDefault();
  };

  return (
    <section className="min-w-0 rounded-[10px] border border-bz-border bg-bz-surface">
      <div className="border-b border-bz-border px-5 py-4">
        <h2 className="text-[13.5px] font-medium">{t("c5.decision.title")}</h2>
        <div
          role="tablist"
          aria-label={t("c5.decision.title")}
          onKeyDown={onTabKeys}
          className="mt-3 flex gap-0.5 rounded-lg bg-bz-surface-2 p-[3px]"
        >
          {(["pre_approve", "decline"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              data-mode={m}
              id={`${id}-${m}`}
              aria-selected={mode === m}
              aria-controls={`${id}-panel`}
              tabIndex={mode === m ? 0 : -1}
              onClick={() => setMode(m)}
              className={cn(
                "h-8 flex-1 rounded-md text-[12.5px] focus-visible:outline-2 focus-visible:outline-bz-accent",
                mode === m ? "bg-bz-surface font-medium text-bz-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-bz-ink-2 hover:text-bz-ink",
              )}
            >
              {m === "pre_approve" ? t("c5.decision.preApprove") : t("c5.decision.decline")}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${mode}`}>
        {mode === "pre_approve" ? (
          <>
            <div className="px-5 py-4">
              {lead?.offer ? <LeadRows lead={lead} /> : <p className="text-[12.5px] text-bz-ink-2">{noLead}</p>}
              <label htmlFor={`${id}-message`} className="mt-4 block text-[11.5px] text-bz-muted">
                {t("c5.message.label", { firstName })}
              </label>
              <textarea
                id={`${id}-message`}
                rows={7}
                value={message}
                disabled={pending || !canAct}
                onChange={(e) => setText(e.target.value)}
                className="mt-1.5 w-full resize-y rounded-md border border-bz-border bg-bz-surface px-3 py-2 text-[12.5px] leading-[1.55] outline-none focus-visible:border-bz-accent"
              />
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12.5px]">
                <span className="text-[11.5px] text-bz-muted">{t("common.sendBy")}</span>
                <label className="flex items-center gap-2 text-bz-muted">
                  <input type="checkbox" checked disabled className="size-4 accent-bz-ink" />
                  {t("c5.channel.emailLetter")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whatsapp}
                    disabled={pending || !canAct}
                    onChange={(e) => setWhatsapp(e.target.checked)}
                    className="size-4 accent-bz-ink"
                  />
                  {t("common.whatsapp")}
                </label>
              </div>
              {whatsapp ? <p className="mt-1.5 text-[11.5px] text-bz-muted">{t("c4.whatsappPending")}</p> : null}
            </div>
            <div className="border-t border-bz-border px-5 py-4">
              <div title={blocked ?? undefined} className={cn(blocked && "cursor-not-allowed")}>
                <Button
                  size="lg"
                  className="h-11 w-full text-[13.5px]"
                  disabled={!!blocked || pending}
                  aria-describedby={`${id}-note`}
                  onClick={() =>
                    run(
                      () =>
                        preApprove({
                          ...target,
                          leadSubmissionId: lead!.id,
                          message,
                          channels: whatsapp ? ["email", "whatsapp"] : ["email"],
                          firstName,
                        }),
                      (r) => r.ok && toFile(),
                    )
                  }
                >
                  <Check strokeWidth={2} />
                  {t("c5.cta.title", { firstName })}
                </Button>
              </div>
              <p id={`${id}-note`} className="mt-2.5 text-center text-[11.5px] leading-[1.5] text-bz-muted">
                {elapsed ? t("c5.cta.note", { elapsed }) : t("c5.cta.noteNoClock")}
                {waiting ? <> {t("c5.cta.withdraws", { count: waiting })}</> : null}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4 px-5 py-4">
              <DeclineFields draft={decline} reasons={declineReasonsFor("with_banks")} firstName={firstName} pending={pending || !canAct} />
            </div>
            <div className="border-t border-bz-border px-5 py-4">
              <div title={canAct ? undefined : t("common.notOwner")} className={cn(!canAct && "cursor-not-allowed")}>
                <Button
                  size="lg"
                  className="h-11 w-full bg-destructive text-[13.5px] text-white hover:bg-destructive/90"
                  disabled={!canAct || !decline.ready || pending}
                  aria-describedby={`${id}-note`}
                  onClick={() =>
                    run(
                      () =>
                        declineApplication({
                          ...target,
                          reason: decline.reason!,
                          message: decline.message,
                          channels: decline.whatsapp ? ["email", "whatsapp"] : ["email"],
                          firstName,
                        }),
                      (r) => r.ok && toFile(),
                    )
                  }
                >
                  {t("decline.cta", { firstName })}
                </Button>
              </div>
              <p id={`${id}-note`} className="mt-2.5 text-center text-[11.5px] leading-[1.5] text-bz-muted">
                {elapsed ? t("decline.note", { elapsed }) : t("decline.noteNoClock")}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** A decided file's card: what was sent, as it was sent. Nothing here changes it. */
function DecidedCard({ decided, lead, firstName }: { decided: DecidedView; lead: BankRowView | null; firstName: string }) {
  return (
    <section className="min-w-0 rounded-[10px] border border-bz-border bg-bz-surface">
      <div className="flex items-center gap-3 border-b border-bz-border px-5 py-4">
        <h2 className="flex-1 text-[13.5px] font-medium">{t("c5.decision.title")}</h2>
        <Pill tone={decided.kind === "pre_approved" ? "success" : "danger"} dot small>
          {decided.kind === "pre_approved" ? t("status.preApproved") : t("status.declined")}
        </Pill>
      </div>
      <div className="px-5 py-4">
        {decided.kind === "pre_approved" && lead?.offer ? <LeadRows lead={lead} decided /> : null}
        {decided.kind === "declined" && decided.reason ? <p className="text-[12.5px]">{decided.reason}</p> : null}
        {decided.message ? (
          <>
            <div className="mt-4 text-[11.5px] text-bz-muted">{t("c5.message.label", { firstName })}</div>
            <p className="mt-1.5 text-[12.5px] leading-[1.55] break-words whitespace-pre-line">{decided.message}</p>
          </>
        ) : null}
      </div>
      <p className="border-t border-bz-border px-5 py-3 text-[11.5px] text-bz-muted">{decided.line}</p>
    </section>
  );
}
