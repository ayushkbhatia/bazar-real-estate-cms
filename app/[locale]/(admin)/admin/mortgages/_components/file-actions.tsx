"use client";

import { useEffect, useId, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Send } from "lucide-react";
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
import { ActivityList, Card, roleLabel } from "./ui";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

/** What every action on a request sends back: which request, and the version the page showed. */
export type Target = { requestId: string; reference: string; updatedAt: string };

/**
 * Runs an action, says how it went (a polite toast — the live region the
 * foundations ask for), and re-reads the page, so the new status, owner or
 * `updated_at` is what the next action sends.
 */
function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<MortgageActionResult>, done?: (r: MortgageActionResult) => void) =>
    start(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) toast.success(result.message);
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
function Reason({ why, children }: { why: string | null; children: ReactNode }) {
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
export function BookScrollButton() {
  return (
    <Button
      className="text-[13px]"
      onClick={() => {
        const card = document.getElementById("book");
        card?.scrollIntoView({ behavior: "smooth", block: "start" });
        card?.querySelector<HTMLElement>("select, button")?.focus({ preventScroll: true });
      }}
    >
      <Calendar strokeWidth={1.6} />
      {t("c6.action.book")}
    </Button>
  );
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
