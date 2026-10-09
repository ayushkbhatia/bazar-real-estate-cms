"use client";

import { useEffect, useId, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Calendar, Check, Send } from "lucide-react";
import { toast } from "sonner";
import { Glyph } from "@/components/mortgage/glyphs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import type { ActivityLine } from "@/lib/mortgage-requests/activity";
import { declineMessage, declineReasonLabel, declineReasonsFor, type DeclineReason } from "@/lib/mortgage-requests/decline";
import type { DocKind } from "@/lib/mortgage-requests/documents";
import type { MortgageStatus } from "@/lib/mortgage-requests/state";
import type { TeamMember } from "@/lib/mortgage-requests/server/cms-queries";
import type { Slot } from "@/lib/mortgage-requests/slots";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import {
  bookConsultation,
  claimRequest,
  editApplicant,
  logContactAttempt,
  markConsultationHeld,
  reassignRequest,
  sendPreapprovalInvite,
  type MortgageActionResult,
} from "../_actions";
import { acceptApplicationAndSend, declineApplication, withdrawConsent } from "../_decision-actions";
import { cancelReupload } from "../_review-actions";
import { ActivityList, Card, roleLabel } from "./ui";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

/** What every action on a request sends back: which request, and the version the page showed. */
export type Target = { requestId: string; reference: string; updatedAt: string };

/**
 * Runs an action, says how it went (a polite toast — the live region the
 * foundations ask for), and re-reads the page, so the new status, owner or
 * `updated_at` is what the next action sends.
 */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<MortgageActionResult>, done?: (r: MortgageActionResult) => void) =>
    start(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) (result.warning ? toast.warning : toast.success)(result.message);
      } else {
        toast.error(result.message);
      }
      done?.(result);
      router.refresh();
    });
  return { pending, run };
}

/** The page re-reads itself on focus and every minute (cms/00-foundations §8). */
export function FileRefresher() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const id = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  return null;
}

const LINK = "text-[12px] text-bz-accent hover:underline disabled:cursor-not-allowed disabled:text-bz-muted disabled:no-underline";

/**
 * Why an action is off, as a tooltip (CMS-13). A disabled button takes no
 * pointer events, so the reason sits on a wrapper.
 */
export function Reason({ why, children }: { why: string | null; children: ReactNode }) {
  if (!why) return <>{children}</>;
  return (
    <span title={why} className="inline-flex cursor-not-allowed">
      {children}
    </span>
  );
}

// ── Owner ────────────────────────────────────────────────────────

export function ClaimButton({ target, size = "default" }: { target: Target; size?: "default" | "link" }) {
  const { pending, run } = useAction();
  const onClick = () => run(() => claimRequest(target));
  if (size === "link") {
    return (
      <button type="button" className={LINK} disabled={pending} onClick={onClick}>
        {t("c1.claim")}
      </button>
    );
  }
  return (
    <Button variant="outline" className="text-[13px]" disabled={pending} onClick={onClick}>
      {t("claim.submit")}
    </Button>
  );
}

export function ReassignDialog({
  target,
  team,
  ownerId,
}: {
  target: Target;
  team: readonly TeamMember[];
  ownerId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(ownerId ?? team[0]?.id ?? "");
  const { pending, run } = useAction();
  const fieldId = useId();
  return (
    <>
      <button type="button" className={LINK} onClick={() => setOpen(true)}>
        {t("c2.owner.reassign")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("reassign.title")}</DialogTitle>
            <DialogDescription className="mono">{target.reference}</DialogDescription>
          </DialogHeader>
          <label htmlFor={fieldId} className="text-[12px] font-medium text-bz-ink-2">
            {t("reassign.label")}
          </label>
          <select
            id={fieldId}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="h-10 w-full rounded-md border border-bz-border bg-bz-surface px-3 text-[13px]"
          >
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.role ? ` · ${roleLabel(m.role)}` : ""}
              </option>
            ))}
          </select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={pending || !choice || choice === ownerId}
              onClick={() => run(() => reassignRequest({ ...target, ownerId: choice }), (r) => r.ok && setOpen(false))}
            >
              {t("reassign.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Applicant ────────────────────────────────────────────────────

export type ApplicantValues = {
  fullName: string;
  dateOfBirth: string;
  mobile: string;
  email: string;
  residency: "uae_national" | "uae_resident_expat";
  employmentLabel: string;
};

function formFrom(values: ApplicantValues) {
  return {
    fullName: values.fullName,
    dateOfBirth: values.dateOfBirth,
    mobileNational: values.mobile.replace(/^\+971/, ""),
    email: values.email,
    residency: values.residency,
  };
}

export function EditApplicantDialog({ target, values }: { target: Target; values: ApplicantValues }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => formFrom(values));
  const [invalid, setInvalid] = useState<string[]>([]);
  const { pending, run } = useAction();
  const id = useId();
  const field = (name: keyof typeof form, label: string, input: ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-${name}`} className="text-[12px] font-medium text-bz-ink-2">
        {label}
      </label>
      {input}
    </div>
  );
  const inputClass = (name: string) =>
    cn(
      "h-10 w-full rounded-md border bg-bz-surface px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-bz-accent/25",
      invalid.includes(name) ? "border-bz-danger" : "border-bz-border",
    );
  const set = (name: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [name]: e.target.value }));

  return (
    <>
      <button
        type="button"
        className={LINK}
        onClick={() => {
          // The page may have re-read the file since: start from what it shows now.
          setForm(formFrom(values));
          setInvalid([]);
          setOpen(true);
        }}
      >
        {t("common.edit")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("edit.title")}</DialogTitle>
            <DialogDescription className="mono">{target.reference}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => editApplicant({ ...target, ...form }),
                (r) => {
                  if (r.ok) setOpen(false);
                  else setInvalid(r.fields ?? []);
                },
              );
            }}
          >
            {field(
              "fullName",
              t("field.fullName"),
              <input id={`${id}-fullName`} value={form.fullName} onChange={set("fullName")} className={inputClass("fullName")} aria-invalid={invalid.includes("fullName")} />,
            )}
            <div className="grid grid-cols-2 gap-4">
              {field(
                "dateOfBirth",
                t("field.dateOfBirth"),
                <input
                  id={`${id}-dateOfBirth`}
                  type="date"
                  value={form.dateOfBirth}
                  onChange={set("dateOfBirth")}
                  className={inputClass("dateOfBirth")}
                  aria-invalid={invalid.includes("dateOfBirth")}
                />,
              )}
              {field(
                "residency",
                t("c2.applicant.residency"),
                <select id={`${id}-residency`} value={form.residency} onChange={set("residency")} className={inputClass("residency")}>
                  <option value="uae_national">{t("residency.uaeNational")}</option>
                  <option value="uae_resident_expat">{t("residency.expat")}</option>
                </select>,
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {field(
                "mobileNational",
                t("field.mobile"),
                <div className={cn(inputClass("mobile"), "flex items-center gap-2 focus-within:ring-2 focus-within:ring-bz-accent/25")}>
                  <span className="mono text-bz-muted">+971</span>
                  <input
                    id={`${id}-mobileNational`}
                    inputMode="numeric"
                    value={form.mobileNational}
                    onChange={set("mobileNational")}
                    className="mono min-w-0 flex-1 bg-transparent outline-none"
                    aria-invalid={invalid.includes("mobile")}
                  />
                </div>,
              )}
              {field(
                "email",
                t("field.email"),
                <input id={`${id}-email`} type="email" value={form.email} onChange={set("email")} className={inputClass("email")} aria-invalid={invalid.includes("email")} />,
              )}
            </div>
            <div className="rounded-md bg-bz-surface-2 px-3 py-2.5 text-[12px] text-bz-ink-2">
              <span className="font-medium">{t("c2.applicant.employment")}: </span>
              {values.employmentLabel}
              <div className="mt-0.5 text-bz-muted">{t("edit.employmentLocked")}</div>
            </div>
            {invalid.length ? (
              <p role="alert" className="text-[12px] text-bz-danger">
                {t("edit.invalid")}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {t("edit.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Contact ──────────────────────────────────────────────────────

export function ContactButtons({ mobile, email }: { mobile: string; email: string }) {
  const whatsapp = buildWhatsAppLink(mobile);
  const btn = "h-8 justify-center gap-1.5 text-[13px]";
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <Button asChild variant="outline" className={btn}>
        <a href={`tel:${mobile}`}>
          <Glyph name="phone" size={15} />
          {t("common.call")}
        </a>
      </Button>
      <Button asChild variant="outline" className={btn}>
        <a href={whatsapp ?? "#"} target="_blank" rel="noopener noreferrer">
          <Glyph name="chat" size={15} />
          {t("common.whatsapp")}
        </a>
      </Button>
      <Button asChild variant="outline" className={btn}>
        <a href={`mailto:${email}`}>
          <Glyph name="mail" size={15} />
          {t("common.email")}
        </a>
      </Button>
    </div>
  );
}

export function ContactAttemptBar({ target, canAct, mobile }: { target: Target; canAct: boolean; mobile: string }) {
  const { pending, run } = useAction();
  const whatsapp = buildWhatsAppLink(mobile);
  const title = canAct ? undefined : t("common.notOwner");
  return (
    <div className="mt-[18px] flex flex-wrap items-center gap-2 border-t border-bz-border pt-4">
      <span className="me-1 text-[12px] text-bz-muted">{t("c6.log.label")}</span>
      {(["reached", "no_answer", "left_message"] as const).map((outcome) => (
        <Reason key={outcome} why={title ?? null}>
          <Button
            variant="outline"
            className="text-[13px]"
            disabled={!canAct || pending}
            onClick={() => run(() => logContactAttempt({ ...target, outcome }))}
          >
            {t(outcome === "reached" ? "c6.log.reached" : outcome === "no_answer" ? "c6.log.noAnswer" : "c6.log.leftMessage")}
          </Button>
        </Reason>
      ))}
      <div className="flex-1" />
      <Button asChild variant="ghost" className="text-[13px]">
        <a href={`tel:${mobile}`}>
          <Glyph name="phone" size={15} />
          {t("c6.log.call")}
        </a>
      </Button>
      <Button asChild variant="ghost" className="text-[13px]">
        <a href={whatsapp ?? "#"} target="_blank" rel="noopener noreferrer">
          <Glyph name="chat" size={15} />
          {t("c6.log.whatsapp")}
        </a>
      </Button>
    </div>
  );
}

// ── Booking ──────────────────────────────────────────────────────

/** Arrow keys move and choose within a radio group, as a native one does. */
function onRadioKeys(e: KeyboardEvent<HTMLDivElement>) {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (!keys.includes(e.key)) return;
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([aria-disabled="true"])'));
  const at = radios.indexOf(document.activeElement as HTMLButtonElement);
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
  const next = radios[(at + step + radios.length) % radios.length];
  next?.focus();
  next?.click();
  e.preventDefault();
}

function Chip({
  on,
  off,
  label,
  onPick,
  disabled,
}: {
  on: boolean;
  off?: boolean;
  label: string;
  onPick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-disabled={off || disabled || undefined}
      aria-label={off ? t("c6.book.unavailable", { time: label }) : undefined}
      tabIndex={on ? 0 : -1}
      onClick={() => {
        if (!off && !disabled) onPick();
      }}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg border px-3.5 text-[12.5px] focus-visible:outline-2 focus-visible:outline-bz-accent",
        on
          ? "border-transparent bg-bz-ink font-medium text-bz-bg"
          : off
            ? "cursor-not-allowed border-bz-border bg-bz-surface text-bz-muted-2 line-through"
            : "border-bz-border bg-bz-surface text-bz-ink hover:border-bz-border-strong",
      )}
    >
      {label}
    </button>
  );
}

export type BookingDay = { key: string; label: string };

export function BookingCard({
  target,
  team,
  ownerId,
  firstName,
  days,
  slots,
  canAct,
  needsContact,
}: {
  target: Target;
  team: readonly TeamMember[];
  ownerId: string | null;
  firstName: string;
  days: readonly BookingDay[];
  /** Per adviser, per day. Computed on the server from working hours minus bookings. */
  slots: Record<string, Record<string, Slot[]>>;
  canAct: boolean;
  /** New: a contact attempt comes first (the transition requires Contacted). */
  needsContact: boolean;
}) {
  const [adviserId, setAdviserId] = useState(ownerId && team.some((m) => m.id === ownerId) ? ownerId : (team[0]?.id ?? ""));
  const [format, setFormat] = useState<"phone" | "video" | "office">("phone");
  const [day, setDay] = useState(days[0]?.key ?? "");
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [invite, setInvite] = useState(true);
  const { pending, run } = useAction();
  const adviser = team.find((m) => m.id === adviserId);
  const daySlots = slots[adviserId]?.[day] ?? [];
  const chosen = daySlots.find((s) => s.startsAt === startsAt && s.available) ?? null;
  const dayLabel = days.find((d) => d.key === day)?.label ?? "";
  const locked = !canAct || needsContact;
  const labelClass = "mb-2 block text-[12px] font-medium text-bz-ink-2";

  return (
    <div className={cn(locked && "opacity-[.72]")}>
      {needsContact ? (
        <p className="mb-4 rounded-md bg-bz-surface-2 px-3 py-2 text-[12.5px] text-bz-ink-2">{t("c6.book.needsContact")}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="book-adviser" className={labelClass}>
            {t("c6.book.adviser")}
          </label>
          <select
            id="book-adviser"
            value={adviserId}
            disabled={locked}
            onChange={(e) => {
              setAdviserId(e.target.value);
              setStartsAt(null);
            }}
            className="h-10 w-full rounded-md border border-bz-border bg-bz-surface px-3 text-[13.5px]"
          >
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span id="book-format" className={labelClass}>
            {t("c6.book.format")}
          </span>
          <div role="radiogroup" aria-labelledby="book-format" onKeyDown={onRadioKeys} className="flex gap-0.5 rounded-lg bg-bz-surface-2 p-[3px]">
            {(["phone", "video", "office"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={format === f}
                tabIndex={format === f ? 0 : -1}
                disabled={locked}
                onClick={() => setFormat(f)}
                className={cn(
                  "inline-flex h-8 flex-1 items-center justify-center gap-[7px] rounded-md text-[12.5px]",
                  format === f ? "bg-bz-surface font-medium text-bz-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-bz-ink-2",
                )}
              >
                <Glyph name={f} size={15} />
                {t(`c6.book.${f}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-[18px]">
        <span id="book-day" className={labelClass}>
          {t("c6.book.day")}
        </span>
        <div role="radiogroup" aria-labelledby="book-day" onKeyDown={onRadioKeys} className="flex flex-wrap gap-1.5">
          {days.map((d) => (
            <Chip
              key={d.key}
              on={d.key === day}
              label={d.label}
              disabled={locked}
              onPick={() => {
                setDay(d.key);
                setStartsAt(null);
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <span id="book-time" className={labelClass}>
          {t("c6.book.time", { adviserFirstName: adviser?.name.split(/\s+/)[0] ?? "" })}
        </span>
        {daySlots.length === 0 ? (
          <p className="text-[12.5px] text-bz-muted">{t("c6.book.none")}</p>
        ) : (
          <div role="radiogroup" aria-labelledby="book-time" onKeyDown={onRadioKeys} className="flex flex-wrap gap-1.5">
            {daySlots.map((s) => (
              <Chip
                key={s.startsAt}
                on={s.startsAt === chosen?.startsAt}
                off={!s.available}
                label={s.time}
                disabled={locked}
                onPick={() => setStartsAt(s.startsAt)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-bz-border pt-4">
        <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={invite}
            disabled={locked}
            onChange={(e) => setInvite(e.target.checked)}
            className="size-[18px] rounded-[5px] accent-bz-ink"
          />
          {t("c6.book.invite", { firstName })}
        </label>
        <Reason why={!canAct ? t("common.notOwner") : needsContact ? t("c6.book.needsContact") : null}>
        <Button
          disabled={locked || pending || !chosen}
          onClick={() =>
            chosen &&
            run(() => bookConsultation({ ...target, adviserId, format, startsAt: chosen.startsAt, invite }), (r) => {
              if (!r.ok && r.code === "slot_taken") setStartsAt(null);
            })
          }
          className="text-[13px]"
        >
          <Calendar strokeWidth={1.6} />
          {chosen ? t("c6.book.cta", { dateTime: `${dayLabel}, ${chosen.time}` }) : t("c6.action.book")}
        </Button>
        </Reason>
      </div>
    </div>
  );
}

export function HeldButton({ target, canAct }: { target: Target; canAct: boolean }) {
  const { pending, run } = useAction();
  return (
    <Reason why={canAct ? null : t("common.notOwner")}>
      <Button className="text-[13px]" disabled={!canAct || pending} onClick={() => run(() => markConsultationHeld(target))}>
        <Check strokeWidth={2} />
        {t("c6.booked.held")}
      </Button>
    </Reason>
  );
}

/** "Book consultation" in the top bar: to the booking card, focused (C6). */
function scrollToBooking() {
  const card = document.getElementById("book");
  card?.scrollIntoView({ behavior: "smooth", block: "start" });
  card?.querySelector<HTMLElement>("select, button")?.focus({ preventScroll: true });
}

export function BookScrollButton() {
  return (
    <Button className="text-[13px]" onClick={scrollToBooking}>
      <Calendar strokeWidth={1.6} />
      {t("c6.action.book")}
    </Button>
  );
}

/** The queue board's "book" drop lands here (`?do=book`): go straight to the booking card. */
export function ScrollToBooking() {
  useEffect(() => {
    const id = window.setTimeout(scrollToBooking, 150);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

// ── Pre-approval invite ──────────────────────────────────────────

export function InviteButton({
  target,
  canAct,
  variant,
  resend,
}: {
  target: Target;
  canAct: boolean;
  variant: "default" | "outline";
  resend?: boolean;
}) {
  const { pending, run } = useAction();
  return (
    <Reason why={canAct ? null : t("common.notOwner")}>
      <Button variant={variant} className="text-[13px]" disabled={!canAct || pending} onClick={() => run(() => sendPreapprovalInvite(target))}>
        <Send strokeWidth={1.6} />
        {resend ? t("c6.invite.resend") : t("c6.action.sendLink")}
      </Button>
    </Reason>
  );
}

// ── Activity ─────────────────────────────────────────────────────

const LATEST = 5;

/** C2's Activity card: the latest five, and "View all {count}" in place (the full log isn't designed). */
export function ActivityCard({ items }: { items: readonly ActivityLine[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, LATEST);
  return (
    <Card
      title={t("card.activity")}
      aside={
        items.length > LATEST ? (
          <button type="button" className={LINK} aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? t("c2.activity.showLatest", { count: LATEST }) : t("c2.activity.viewAll", { count: items.length })}
          </button>
        ) : null
      }
    >
      <ActivityList items={shown} />
    </Card>
  );
}

// ── C2 · the review loop (Phase 5) ───────────────────────────────

/**
 * Cancel a re-upload request (not designed). Asked first: the applicant's link
 * stops working and the clock starts again, so a stray click would cost them.
 */
export function CancelReuploadButton({
  target,
  reuploadId,
  kind,
  firstName,
  documentName,
}: {
  target: Target;
  reuploadId: string;
  kind: DocKind;
  firstName: string;
  documentName: string;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={LINK} disabled={pending} onClick={() => setOpen(true)}>
        {t("c2.reupload.cancel")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("c2.reupload.confirm.title")}</DialogTitle>
            <DialogDescription>
              {t("c2.reupload.confirm.body", { firstName, document: documentName.charAt(0).toLowerCase() + documentName.slice(1) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("c2.reupload.confirm.keep")}
            </Button>
            <Button
              disabled={pending}
              onClick={() => run(() => cancelReupload({ ...target, reuploadId, kind }), (r) => r.ok && setOpen(false))}
            >
              {t("c2.reupload.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * "Record a withdrawal" (C2's Consent card; not designed — SECURITY-REVIEW
 * SR-17): the applicant asked Bazar to stop sharing with partner banks. The
 * owner or the Head records it; the banks still deciding are withdrawn and
 * every package link stops (SR-22).
 */
export function WithdrawConsentButton({ target, firstName }: { target: Target; firstName: string }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={LINK} disabled={pending} onClick={() => setOpen(true)}>
        {t("c2.consent.withdraw.button")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t("c2.consent.withdraw.title")}</DialogTitle>
            <DialogDescription>{t("c2.consent.withdraw.body", { firstName })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={() => run(() => withdrawConsent({ ...target, firstName }), (r) => r.ok && setOpen(false))}
            >
              {t("c2.consent.withdraw.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Request documents": pick the document, then C4's form in the viewer (the picker isn't designed). */
export function RequestDocumentsButton({
  reference,
  documents,
  canAct,
}: {
  reference: string;
  documents: readonly { kind: DocKind; name: string; requestable: boolean }[];
  canAct: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const requestable = documents.filter((d) => d.requestable);
  const [choice, setChoice] = useState(requestable[0]?.kind ?? null);
  const fieldId = useId();
  return (
    <>
      <Reason why={canAct ? null : t("common.notOwner")}>
        <Button variant="outline" className="text-[13px]" disabled={!canAct} onClick={() => setOpen(true)}>
          <Send strokeWidth={1.6} />
          {t("c2.action.requestDocuments")}
        </Button>
      </Reason>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("c2.request.title")}</DialogTitle>
            <DialogDescription className="mono">{reference}</DialogDescription>
          </DialogHeader>
          {requestable.length === 0 ? (
            <p className="text-[13px] text-bz-muted">{t("c2.request.none")}</p>
          ) : (
            <fieldset>
              <legend id={fieldId} className="mb-2 text-[12px] font-medium text-bz-ink-2">
                {t("c2.request.label")}
              </legend>
              <div className="flex flex-col gap-2">
                {requestable.map((d) => (
                  <label key={d.kind} className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                    <input type="radio" name={fieldId} checked={choice === d.kind} onChange={() => setChoice(d.kind)} className="size-4 accent-bz-ink" />
                    {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!choice || requestable.length === 0}
              onClick={() => choice && router.push(`/admin/mortgages/${reference}/documents/${choice}?reupload=1`)}
            >
              {t("c2.request.continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The decline's draft: the reason, the message it prefills (the adviser's own words stay once edited), and WhatsApp. */
export function useDeclineDraft(firstName: string, myFirstName: string) {
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [message, setMessage] = useState("");
  const [prefilled, setPrefilled] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);
  const choose = (next: DeclineReason) => {
    const draft = declineMessage(next, { applicantFirstName: firstName, adviserFirstName: myFirstName });
    if (message === "" || message === prefilled) setMessage(draft);
    setPrefilled(draft);
    setReason(next);
  };
  // "Other" has no words of its own: the adviser says why before it can go.
  const unexplained = reason === "other" && message === prefilled;
  const ready = !!reason && message.trim().length > 0 && !unexplained;
  return { reason, message, setMessage, whatsapp, setWhatsapp, choose, unexplained, ready };
}

/** The decline's fields (C2's dialog, C5's Decline tab): reason chips, then the message and how it goes. */
export function DeclineFields({
  draft,
  reasons,
  firstName,
  pending,
}: {
  draft: ReturnType<typeof useDeclineDraft>;
  reasons: readonly DeclineReason[];
  firstName: string;
  pending: boolean;
}) {
  const fieldId = useId();
  return (
    <>
      <div>
        <div className="text-[12px] font-medium text-bz-ink-2">{t("decline.reasonLabel")}</div>
        <div role="radiogroup" aria-label={t("decline.reasonLabel")} className="mt-2 flex flex-wrap gap-1.5">
          {reasons.map((value) => {
            const on = draft.reason === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={pending}
                onClick={() => draft.choose(value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px]",
                  on ? "border-transparent bg-bz-ink text-bz-bg" : "border-bz-border bg-bz-surface text-bz-ink hover:border-bz-border-strong",
                )}
              >
                {on ? <Check size={11} strokeWidth={2.6} aria-hidden /> : null}
                {declineReasonLabel(value)}
              </button>
            );
          })}
        </div>
      </div>
      {draft.reason ? (
        <div>
          <label htmlFor={fieldId} className="text-[12px] font-medium text-bz-ink-2">
            {t("decline.messageLabel", { firstName })}
          </label>
          <textarea
            id={fieldId}
            rows={10}
            value={draft.message}
            disabled={pending}
            onChange={(e) => draft.setMessage(e.target.value)}
            aria-describedby={draft.unexplained ? `${fieldId}-hint` : undefined}
            className="mt-1.5 w-full resize-y rounded-md border border-bz-border bg-bz-surface px-3 py-2 text-[12.5px] leading-[1.55] outline-none focus-visible:border-bz-accent"
          />
          {draft.unexplained ? (
            <p id={`${fieldId}-hint`} className="mt-1 text-[11.5px] text-[oklch(0.48_0.16_28)]">
              {t("decline.otherHint")}
            </p>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[12.5px]">
            <span className="text-bz-muted">{t("common.sendBy")}</span>
            <label className="flex items-center gap-2 text-bz-muted">
              <input type="checkbox" checked disabled className="size-4 accent-bz-ink" />
              {t("common.email")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.whatsapp}
                disabled={pending}
                onChange={(e) => draft.setWhatsapp(e.target.checked)}
                className="size-4 accent-bz-ink"
              />
              {t("common.whatsapp")}
            </label>
          </div>
          {draft.whatsapp ? <p className="mt-1.5 text-[11.5px] text-bz-muted">{t("c4.whatsappPending")}</p> : null}
        </div>
      ) : null}
    </>
  );
}

/**
 * Decline (D19; not designed): a reason, then the message the applicant will
 * read, prefilled from the reason and edited here, and the channels. Email
 * always goes. C5's Decline tab hosts the same fields.
 */
export function DeclineButton({
  target,
  status,
  firstName,
  myFirstName,
  elapsed,
  awaiting,
  canAct,
}: {
  target: Target;
  status: MortgageStatus;
  firstName: string;
  myFirstName: string;
  /** The clock's elapsed time, "8h 41m" (slaStatus), or null with no clock. */
  elapsed: string | null;
  /** A re-upload is out: declining cancels it. */
  awaiting: boolean;
  canAct: boolean;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const draft = useDeclineDraft(firstName, myFirstName);

  return (
    <>
      <Reason why={canAct ? null : t("common.notOwner")}>
        <Button variant="destructive" className="text-[13px]" disabled={!canAct} onClick={() => setOpen(true)}>
          <Ban strokeWidth={1.6} />
          {t("c2.action.decline")}
        </Button>
      </Reason>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t("decline.title", { firstName })}</DialogTitle>
            <DialogDescription>{t("decline.lede", { firstName })}</DialogDescription>
          </DialogHeader>
          <DeclineFields draft={draft} reasons={declineReasonsFor(status)} firstName={firstName} pending={pending} />
          <p className="rounded-lg bg-bz-surface-2 px-3 py-2.5 text-[11.5px] leading-[1.5] text-bz-ink-2">
            {elapsed ? t("decline.note", { elapsed }) : t("decline.noteNoClock")}
            {awaiting ? <> {t("decline.noteAwaiting")}</> : null}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={!draft.ready || pending}
              onClick={() =>
                run(
                  () =>
                    declineApplication({
                      ...target,
                      reason: draft.reason!,
                      message: draft.message,
                      channels: draft.whatsapp ? ["email", "whatsapp"] : ["email"],
                      firstName,
                    }),
                  (r) => r.ok && setOpen(false),
                )
              }
            >
              {t("decline.cta", { firstName })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type SendableBank = { id: string; code: string; name: string; color: string | null; inboxes: string[]; sendable: boolean };

/**
 * "Accept application" (C2; the bank step isn't designed): choose the banks —
 * every bank that can take a package, ticked — and send each its own secure
 * package. Enabled at 4 of 4 accepted with consent on file (PLAN Phase 5).
 */
export function AcceptApplicationButton({
  enabled,
  why,
  target,
  firstName,
  documents,
  expires,
  consentGiven,
  banks,
  canManageBanks,
  defaultOpen,
}: {
  enabled: boolean;
  why: string;
  target: Target;
  firstName: string;
  documents: number;
  /** When the package links would stop working, as the lede says it. */
  expires: string;
  consentGiven: string | null;
  banks: readonly SendableBank[];
  canManageBanks: boolean;
  /** Start open (the queue board's In review → With banks drop), when it can be used. */
  defaultOpen?: boolean;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(() => !!defaultOpen && enabled);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(banks.filter((b) => b.sendable).map((b) => b.id)));
  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <>
      <Reason why={enabled ? null : why}>
        <Button className="text-[13px]" disabled={!enabled} onClick={() => setOpen(true)} aria-describedby={enabled ? undefined : "accept-why"}>
          <Check strokeWidth={2} />
          {t("c2.action.acceptApplication")}
        </Button>
      </Reason>
      {enabled ? null : (
        <span id="accept-why" className="sr-only">
          {why}
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("c2.send.title", { firstName })}</DialogTitle>
            <DialogDescription>{t("c2.send.lede", { count: documents, expires })}</DialogDescription>
          </DialogHeader>
          {banks.length === 0 ? (
            <p className="text-[13px] text-bz-muted">
              {t("c2.send.none")}{" "}
              {canManageBanks ? (
                <Link href="/admin/mortgages/banks" className="text-bz-accent hover:underline">
                  {t("c2.send.addBanks")}
                </Link>
              ) : null}
            </p>
          ) : (
            <fieldset>
              <legend className="text-[12px] font-medium text-bz-ink-2">{t("c2.send.banks")}</legend>
              <ul className="mt-2 divide-y divide-bz-border rounded-lg border border-bz-border">
                {banks.map((bank) => (
                  <li key={bank.id}>
                    <label className={cn("flex items-center gap-3 px-3 py-2.5", bank.sendable ? "cursor-pointer" : "opacity-60")}>
                      <input
                        type="checkbox"
                        className="size-4 accent-bz-ink"
                        checked={bank.sendable && chosen.has(bank.id)}
                        disabled={!bank.sendable || pending}
                        onChange={() => toggle(bank.id)}
                      />
                      <BankMark code={bank.code} color={bank.color} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium">{bank.name}</span>
                        <span className="mono block truncate text-[11px] text-bz-muted">
                          {bank.inboxes.length ? bank.inboxes.join(", ") : t("c2.send.noInbox")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {consentGiven ? <p className="text-[11.5px] text-bz-muted">{t("c2.send.consent", { given: consentGiven })}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={pending || chosen.size === 0}
              onClick={() =>
                run(() => acceptApplicationAndSend({ ...target, bankIds: [...chosen] }), (r) => r.ok && setOpen(false))
              }
            >
              <Send strokeWidth={1.6} />
              {t("c2.send.cta", { count: chosen.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A bank's mark (C5): its code in white on its colour. */
export function BankMark({ code, color, size = 38 }: { code: string; color: string | null; size?: number }) {
  return (
    <span
      aria-hidden
      className="mono grid shrink-0 place-items-center font-semibold text-white"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.21), background: color ?? "var(--bz-ink-2)", fontSize: size >= 36 ? 10.5 : 9 }}
    >
      {code}
    </span>
  );
}
