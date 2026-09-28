import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Glyph, DOC_GLYPH } from "@/components/mortgage/glyphs";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import type { DocKind } from "@/lib/mortgage-requests/documents";
import { formatDayTime } from "@/lib/mortgage-requests/format";
import type { RequestStatus } from "@/lib/mortgage-requests/queue";
import { formatDuration, type SlaStatus } from "@/lib/mortgage-requests/sla";
import { cn } from "@/lib/utils";

/**
 * The mortgage CMS's shared pieces (docs/mortgage/cms/00-foundations §5–6),
 * rebuilt from the handoff's reference (`mreq-shared.jsx`) with this repo's
 * tokens. Presentational only — no hooks — so server pages and client islands
 * both use them.
 */

// ── Tones (§5) ───────────────────────────────────────────────────

export const TONE = {
  accent: "bg-bz-accent-soft text-bz-accent",
  warn: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  muted: "bg-bz-surface-2 text-bz-ink-2",
  info: "bg-[oklch(0.95_0.03_240)] text-[oklch(0.42_0.1_245)]",
  success: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  danger: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
  ink: "bg-bz-ink text-bz-bg",
} as const;
export type Tone = keyof typeof TONE;

/** The activity dot's colour: the tone's text colour. */
const DOT = {
  accent: "bg-bz-accent",
  warn: "bg-[oklch(0.45_0.1_60)]",
  muted: "bg-bz-ink-2",
  info: "bg-[oklch(0.42_0.1_245)]",
  success: "bg-[oklch(0.35_0.08_145)]",
  danger: "bg-[oklch(0.45_0.13_28)]",
  ink: "bg-bz-ink",
} as const;

export function Pill({
  tone = "muted",
  dot,
  small,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  small?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium",
        small ? "h-[22px] px-2 text-[11px]" : "h-[26px] px-[11px] text-[12px]",
        TONE[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export const STATUS: Record<RequestStatus, { key: string; tone: Tone }> = {
  new: { key: "status.new", tone: "accent" },
  in_review: { key: "status.inReview", tone: "warn" },
  awaiting_applicant: { key: "status.awaitingApplicant", tone: "muted" },
  with_banks: { key: "status.withBanks", tone: "info" },
  pre_approved: { key: "status.preApproved", tone: "success" },
  declined: { key: "status.declined", tone: "danger" },
  contacted: { key: "status.contacted", tone: "warn" },
  consultation_booked: { key: "status.consultationBooked", tone: "info" },
  completed: { key: "status.completed", tone: "success" },
};

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

export function StatusPill({ status, small }: { status: RequestStatus; small?: boolean }) {
  const s = STATUS[status];
  return (
    <Pill tone={s.tone} dot small={small}>
      {t(s.key)}
    </Pill>
  );
}

// ── Promise clock (§7) ───────────────────────────────────────────

/** The clock's words for a state; the maths is sla.ts's, done on the server. */
export function clockLabel(sla: SlaStatus): string {
  const remaining = formatDuration(sla.remainingSeconds ?? 0);
  switch (sla.state) {
    case "paused":
      return t("clock.paused", { remaining });
    case "breached":
      return t("clock.breached", { overdue: remaining });
    case "met":
      return t("clock.met", { elapsed: formatDuration(sla.elapsedSeconds ?? 0) });
    default:
      return t("clock.left", { remaining });
  }
}

export function PromiseClock({ sla, width, showDue }: { sla: SlaStatus; width: number; showDue?: boolean }) {
  if (sla.state === "none") return null;
  const risk = sla.state === "at_risk" || sla.state === "breached";
  const paused = sla.state === "paused";
  const bar =
    sla.state === "met"
      ? "bg-[oklch(0.55_0.12_145)]"
      : risk
        ? "bg-[oklch(0.55_0.18_28)]"
        : paused
          ? "bg-bz-muted-2 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgba(255,255,255,.55)_3px_5px)]"
          : "bg-bz-accent";
  const pct = sla.state === "breached" ? 100 : (sla.pct ?? 0);
  return (
    <div style={{ width }} className="max-w-full">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium",
            risk ? "text-[oklch(0.48_0.16_28)]" : paused ? "text-bz-ink-2" : "text-bz-ink",
          )}
        >
          <Glyph name={paused ? "pause" : "clock"} size={13} />
          {clockLabel(sla)}
        </span>
        {showDue && sla.dueAt ? (
          <span className="whitespace-nowrap text-[11.5px] text-bz-muted">{t("clock.due", { dueAt: formatDayTime(sla.dueAt) })}</span>
        ) : null}
      </div>
      <div className="mt-[7px] h-1 overflow-hidden rounded-full bg-bz-surface-3" aria-hidden>
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Documents ────────────────────────────────────────────────────

const BAR = {
  accepted: "bg-[oklch(0.58_0.12_145)]",
  review: "bg-[oklch(0.8_0.1_80)]",
  flagged: "bg-[oklch(0.58_0.18_28)]",
} as const;

export function DocumentBar({ states, label }: { states: readonly ("accepted" | "review" | "flagged")[] | null; label?: string }) {
  if (!states) return <span className="text-[12px] text-bz-muted">{t("common.notRequired")}</span>;
  const accepted = states.filter((s) => s === "accepted").length;
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex gap-[3px]" aria-hidden>
        {states.map((s, i) => (
          <span key={i} className={cn("h-1.5 w-[15px] rounded-[2px]", BAR[s])} />
        ))}
      </span>
      <span className="mono whitespace-nowrap text-[11.5px] text-bz-muted">
        {label ?? t("c1.docs.count", { accepted, total: states.length })}
      </span>
    </span>
  );
}

const TILE = {
  done: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.4_0.09_145)]",
  review: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  error: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.5_0.15_28)]",
} as const;

export function DocTile({ kind, state }: { kind: DocKind; state: keyof typeof TILE }) {
  return (
    <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-[10px]", TILE[state])} aria-hidden>
      <Glyph name={DOC_GLYPH[kind]} size={18} />
      {state !== "review" ? (
        <span
          className={cn(
            "absolute -end-[5px] -bottom-[5px] grid size-[18px] place-items-center rounded-full text-white shadow-[0_0_0_2px_var(--bz-surface)]",
            state === "done" ? "bg-[oklch(0.55_0.12_145)]" : "bg-[oklch(0.55_0.18_28)]",
          )}
        >
          {state === "done" ? <Check size={10} strokeWidth={3} /> : <span className="text-[11px] font-bold leading-none">!</span>}
        </span>
      ) : null}
    </span>
  );
}

/** The small page or photo a file tag starts with. */
export function Thumb({ image }: { image: boolean }) {
  if (image) {
    return (
      <span
        aria-hidden
        className="h-6 w-[37px] shrink-0 rounded-[4px] border border-bz-border bg-[repeating-linear-gradient(135deg,var(--bz-surface-3)_0_1px,var(--bz-surface-2)_1px_6px)]"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="relative flex h-[27px] w-[22px] shrink-0 flex-col gap-[2px] rounded-[3px] border border-bz-border-strong bg-white px-[3.5px] py-[4px]"
    >
      {[80, 100, 62].map((w, i) => (
        <span key={i} className="h-px rounded-[1px] bg-[oklch(0.86_0.006_85)]" style={{ width: `${w}%` }} />
      ))}
      <span className="mono absolute start-[2px] bottom-[1px] text-[5px] font-semibold text-[oklch(0.5_0.15_28)]">PDF</span>
    </span>
  );
}

export function FileTagBody({ name, meta, image }: { name: string; meta: string; image: boolean }) {
  return (
    <>
      <Thumb image={image} />
      <span className="min-w-0 text-start">
        <span className="mono block truncate text-[11.5px] text-bz-ink">{name}</span>
        <span className="mt-px block text-[10.5px] text-bz-muted">{meta}</span>
      </span>
    </>
  );
}

export const FILE_TAG =
  "inline-flex max-w-[280px] items-center gap-2.5 rounded-lg border border-bz-border bg-bz-surface py-1.5 ps-1.5 pe-3";

// ── Owner ────────────────────────────────────────────────────────

export function Avatar({ initials, size = 26 }: { initials: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-bz-surface-2 font-medium text-bz-ink-2"
      style={{ width: size, height: size, fontSize: size >= 34 ? 12.5 : 10.5 }}
    >
      {initials}
    </span>
  );
}

export function OwnerAvatar({
  owner,
  size = 26,
  named,
  role,
}: {
  owner: { name: string; initials: string } | null;
  size?: number;
  named?: boolean;
  role?: string | null;
}) {
  if (!owner) {
    return (
      <span className="inline-flex items-center gap-2 text-[12px] text-bz-muted">
        <span
          aria-hidden
          className="shrink-0 rounded-full border-[1.5px] border-dashed border-bz-border-strong"
          style={{ width: size, height: size }}
        />
        {named ? t("owner.unassigned") : <span className="sr-only">{t("owner.unassigned")}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2.5 text-[13px]" title={named ? undefined : owner.name}>
      <Avatar initials={owner.initials} size={size} />
      {named ? (
        <span>
          <span className="block font-medium">{owner.name}</span>
          {role ? <span className="block text-[11.5px] text-bz-muted">{role}</span> : null}
        </span>
      ) : (
        <span className="sr-only">{owner.name}</span>
      )}
    </span>
  );
}

export function roleLabel(role: "head" | "adviser" | null): string | null {
  return role === "head" ? t("role.head") : role === "adviser" ? t("role.adviser") : null;
}

// ── Cards and lists ──────────────────────────────────────────────

export function Card({
  title,
  aside,
  children,
  bodyClassName,
  className,
  id,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-[10px] border border-bz-border bg-bz-surface", className)}>
      {title ? (
        <div className="flex items-center gap-3 border-b border-bz-border px-5 py-3.5">
          <h2 className="flex-1 text-[13.5px] font-medium">{title}</h2>
          {aside}
        </div>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KeyValueList({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl>
      {rows.map(([label, value], i) => (
        <div key={label} className={cn("flex justify-between gap-4 py-2 text-[12.5px]", i > 0 && "border-t border-bz-border")}>
          <dt className="shrink-0 text-bz-muted">{label}</dt>
          <dd className="min-w-0 break-words text-end">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type ActivityItem = {
  id: string;
  time: string;
  text: string;
  strong?: boolean;
  sub?: string;
  quote?: boolean;
  tone?: Tone | "accent" | "success" | "danger" | "warn";
};

export function ActivityList({ items, empty }: { items: readonly ActivityItem[]; empty?: string }) {
  if (items.length === 0) return <p className="text-[12.5px] text-bz-muted">{empty ?? t("activity.empty")}</p>;
  return (
    <ol>
      {items.map((item, i) => (
        <li
          key={item.id}
          className={cn("relative grid grid-cols-[40px_12px_minmax(0,1fr)] gap-x-2.5", i < items.length - 1 && "pb-3.5")}
        >
          {i < items.length - 1 ? <span aria-hidden className="absolute start-[55px] top-3.5 bottom-0 w-px bg-bz-border" /> : null}
          <span className="mono pt-px text-[11px] text-bz-muted">{item.time}</span>
          <span
            aria-hidden
            className={cn("relative ms-0.5 mt-[5px] size-2 rounded-full", item.tone ? DOT[item.tone] : "bg-bz-border-strong")}
          />
          <div className="min-w-0 text-[12.5px] leading-[1.45]">
            <span className={item.strong ? "font-medium" : undefined}>{item.text}</span>
            {item.sub ? (
              item.quote ? (
                <blockquote className="mt-px text-[11.5px] text-bz-muted">{item.sub}</blockquote>
              ) : (
                <div className="mt-px text-[11.5px] text-bz-muted">{item.sub}</div>
              )
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The file header's chip row, with the clock or a line of text on the right. */
export function FileHeader({ chips, right }: { chips: readonly { label: string; tone?: Tone }[]; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <Pill key={c.label} tone={c.tone ?? "muted"}>
          {c.label}
        </Pill>
      ))}
      <div className="flex-1" />
      {right}
    </div>
  );
}

export function StageRail({ stages, at }: { stages: readonly string[]; at: number }) {
  return (
    <ol className="mb-5 flex gap-1.5" aria-label={stages[at]}>
      {stages.map((s, i) => (
        <li
          key={s}
          aria-current={i === at ? "step" : undefined}
          className={cn(
            "flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-lg border px-3.5 text-[12.5px] font-medium",
            i < at
              ? "border-transparent bg-bz-accent-soft text-bz-accent"
              : i === at
                ? "border-transparent bg-bz-ink text-bz-bg"
                : "border-bz-border bg-bz-surface text-bz-muted",
          )}
        >
          {i < at ? <Check size={12} strokeWidth={2.6} aria-hidden /> : <span className="mono text-[11px] opacity-80">{i + 1}</span>}
          <span className="truncate">{s}</span>
        </li>
      ))}
    </ol>
  );
}
