"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Check, ChevronDown, Search } from "lucide-react";
import { Glyph } from "@/components/mortgage/glyphs";
import { Button } from "@/components/ui/button";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { queueQuery, QUEUE_TABS, type QueueParams, type QueueTab, type ServiceFilter } from "@/lib/mortgage-requests/queue";
import type { ConsultIcon, QueueResult, QueueRow, TeamMember } from "@/lib/mortgage-requests/server/cms-queries";
import { cn } from "@/lib/utils";
import { loadQueue } from "../_actions";
import { DocumentBar, OwnerAvatar, PromiseClock, StatusPill } from "./ui";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

const TAB_KEY: Record<QueueTab, string> = {
  open: "c1.tab.open",
  new: "c1.tab.new",
  in_review: "c1.tab.inReview",
  awaiting: "c1.tab.awaiting",
  with_banks: "c1.tab.withBanks",
  contacted_booked: "c1.tab.contactedBooked",
  closed: "c1.tab.closed",
};

const SERVICE_KEY: Record<ServiceFilter, string> = {
  all: "c1.filter.all",
  pre_approval: "service.preApproval",
  consultancy: "service.consultancy",
};

const POLL_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 300;

// "When you come back from a file, its row is highlighted" (C1): the reference
// last opened from this tab, kept for the session.
const LAST_OPENED = "bz.mortgages.lastOpened";
function readLastOpened(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_OPENED);
  } catch {
    return null;
  }
}
function rememberOpened(reference: string) {
  try {
    window.sessionStorage.setItem(LAST_OPENED, reference);
  } catch {
    // Private mode: no highlight, nothing else lost.
  }
}
function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const FIELD =
  "h-[34px] rounded-md border border-bz-border bg-bz-surface text-[13px] text-bz-ink outline-none focus-visible:border-bz-accent focus-visible:ring-2 focus-visible:ring-bz-accent/25";

function ConsultCell({ icon, text }: { icon: ConsultIcon; text: string }) {
  const glyph =
    icon === "calendar" ? (
      <Calendar size={14} strokeWidth={1.6} aria-hidden />
    ) : icon === "tick" ? (
      <Check size={14} strokeWidth={1.8} aria-hidden />
    ) : (
      <Glyph name={icon === "chat" ? "chat" : icon === "phone" ? "phone" : icon === "mail" ? "mail" : "clock"} size={14} />
    );
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-bz-ink-2">
      {glyph}
      {text}
    </span>
  );
}

function RiskBanner({
  items,
  active,
  onToggle,
}: {
  items: QueueResult["atRisk"];
  active: boolean;
  onToggle: () => void;
}) {
  if (items.length === 0) return null;
  const named = items.slice(0, 3).map((i) => t("c1.risk.item", { name: i.fullName, reference: i.reference, remaining: i.remaining }));
  if (items.length > 3) named.push(t("c1.risk.more", { count: items.length - 3 }));
  const detail = `${new Intl.ListFormat("en-GB", { type: "conjunction" }).format(named)}.`;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-[10px] border border-[oklch(0.88_0.06_28)] bg-[oklch(0.975_0.02_28)] px-4 py-3 text-[oklch(0.45_0.14_28)]"
    >
      <Glyph name="clock" size={16} />
      <p className="flex-1 text-[13px]">
        <b className="font-semibold">{t("c1.risk.title", { count: items.length })}</b>{" "}
        <span className="text-bz-ink-2">{detail}</span>
      </p>
      <button type="button" onClick={onToggle} className="shrink-0 text-[12.5px] font-medium hover:underline">
        {active ? t("c1.risk.showAll") : t("c1.risk.showOnly")}
      </button>
    </div>
  );
}

export function QueueView({
  initial,
  params,
  team,
}: {
  initial: QueueResult | null;
  params: QueueParams;
  team: readonly TeamMember[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const [search, setSearch] = useState<{ key: string; result: QueueResult | null } | null>(null);
  const seq = useRef(0);
  const lastOpened = useSyncExternalStore(subscribeStorage, readLastOpened, () => null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const searchKey = `${debounced}|${searchPage}|${queueQuery(params)}`;
  const runSearch = useCallback(async () => {
    if (!debounced) return;
    const n = ++seq.current;
    const res = await loadQueue({ ...params, page: searchPage }, debounced);
    if (n !== seq.current) return;
    setSearch({ key: searchKey, result: res.ok ? res.result : null });
  }, [debounced, params, searchKey, searchPage]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  // SPEC §4.3: the queue refreshes every 30 seconds. The server page is
  // re-rendered in place (the nav's count with it); a search is re-run.
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      void runSearch();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [router, runSearch]);

  // While a search is on its way, the last answer stays up, dimmed.
  const searching = debounced.length > 0;
  const loading = searching && search?.key !== searchKey;
  const result: QueueResult | null = searching && search ? search.result : initial;
  const failed = result === null;

  const go = (next: Partial<QueueParams>) => {
    setSearchPage(1);
    router.replace(`${pathname}${queueQuery({ ...params, page: 1, ...next })}`, { scroll: false });
  };
  const page = searching ? searchPage : params.page;
  const toPage = (n: number) => {
    if (searching) setSearchPage(n);
    else router.replace(`${pathname}${queueQuery({ ...params, page: n })}`, { scroll: false });
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const at = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.focus();
    e.preventDefault();
  };

  const open = (row: QueueRow, e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    const href = `/admin/mortgages/${row.reference}`;
    rememberOpened(row.reference);
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
    else router.push(href);
  };

  const footerKey = params.tab === "closed" ? "c1.closedFooter" : params.tab === "open" ? "c1.footer" : "c1.tabFooter";
  const rows = result?.rows ?? [];

  return (
    <div className="flex flex-col gap-4">
      {result ? <RiskBanner items={result.atRisk} active={params.risk} onToggle={() => go({ risk: !params.risk })} /> : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <div role="radiogroup" aria-label={t("c1.aria.service")} className="flex gap-0.5 rounded-lg bg-bz-surface-2 p-[3px]">
          {(["all", "pre_approval", "consultancy"] as const).map((s) => {
            const on = params.service === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => go({ service: s })}
                className={cn(
                  "inline-flex h-[30px] items-center gap-2 rounded-md px-3 text-[12.5px]",
                  on ? "bg-bz-surface font-medium text-bz-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-bz-ink-2 hover:text-bz-ink",
                )}
              >
                {t(SERVICE_KEY[s])}
                {/* On the control's tint, muted text falls short of AA (4.2:1): the unselected counts are darker. */}
                {result ? <span className={cn("mono text-[11px]", on ? "text-bz-muted" : "text-bz-ink-2")}>{result.counts.services[s]}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <label className="relative w-[240px]">
          <span className="sr-only">{t("c1.aria.search")}</span>
          <Search size={15} strokeWidth={1.6} aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-bz-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchPage(1);
            }}
            placeholder={t("c1.search.placeholder")}
            autoComplete="off"
            className={cn(FIELD, "w-full ps-8 pe-2.5 placeholder:text-bz-muted")}
          />
        </label>
        <label className="relative w-[150px]">
          <span className="sr-only">{t("c1.aria.owner")}</span>
          <select
            value={params.owner}
            onChange={(e) => go({ owner: e.target.value })}
            className={cn(FIELD, "w-full appearance-none ps-2.5 pe-7")}
          >
            <option value="anyone">{t("c1.owner.anyone")}</option>
            <option value="me">{t("c1.owner.me")}</option>
            <option value="unassigned">{t("c1.owner.unassigned")}</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {t("c1.owner.person", { name: m.name })}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-bz-muted" />
        </label>
        <label className="relative w-[170px]">
          <span className="sr-only">{t("c1.aria.sort")}</span>
          <select value="promise_due" onChange={() => undefined} className={cn(FIELD, "w-full appearance-none ps-2.5 pe-7")}>
            <option value="promise_due">{t("c1.sort.promiseDue")}</option>
          </select>
          <ChevronDown size={14} aria-hidden className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-bz-muted" />
        </label>
      </div>

      <section className="overflow-hidden rounded-[10px] border border-bz-border bg-bz-surface">
        <div
          role="tablist"
          aria-label={t("c1.aria.tabs")}
          onKeyDown={onTabKey}
          className="flex gap-[22px] overflow-x-auto border-b border-bz-border px-[18px]"
        >
          {QUEUE_TABS.map((tab) => {
            const on = params.tab === tab;
            const count = tab === "closed" ? null : (result?.counts.tabs[tab] ?? null);
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => go({ tab, risk: false })}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-[7px] border-b-2 py-3.5 text-[13px] whitespace-nowrap",
                  on ? "border-bz-ink font-medium text-bz-ink" : "border-transparent text-bz-ink-2 hover:text-bz-ink",
                )}
              >
                {t(TAB_KEY[tab])}
                {count != null ? (
                  <span
                    className={cn(
                      "mono rounded-full px-1.5 py-px text-[10.5px]",
                      // Muted text on the badge's tint falls short of AA; ink-2 doesn't.
                      on ? "bg-bz-ink text-bz-bg" : "bg-bz-surface-3 text-bz-ink-2",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className={cn("w-full min-w-[1080px] border-collapse text-[13px]", loading && "opacity-60")} aria-busy={loading}>
            <thead>
              <tr className="border-b border-bz-border text-start">
                {(["reference", "applicant", "request", "documents", "status", "promise", "owner", "received"] as const).map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="px-3.5 py-2.5 text-start text-[10.5px] font-medium tracking-[0.06em] whitespace-nowrap text-bz-muted uppercase"
                  >
                    {t(`c1.col.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {failed ? (
                <tr>
                  <td colSpan={8} className="px-3.5 py-10 text-center text-[13px] text-bz-muted">
                    {t("c1.error")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3.5 py-10 text-center text-[13px] text-bz-muted">
                    {searching ? t("c1.emptySearch") : t("c1.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const highlighted = row.reference === lastOpened;
                  const href = `/admin/mortgages/${row.reference}`;
                  return (
                    <tr
                      key={row.reference}
                      data-reference={row.reference}
                      data-highlighted={highlighted || undefined}
                      onClick={(e) => open(row, e)}
                      className={cn(
                        // A lighter hover keeps muted text at AA; the highlight keeps its tint and darkens it instead.
                        "cursor-pointer border-b border-bz-border last:border-b-0 hover:bg-bz-surface-2/40",
                        highlighted && "bg-bz-surface-2 hover:bg-bz-surface-2 [&_.text-bz-muted]:text-bz-ink-2",
                      )}
                    >
                      <td className={cn("px-3.5 py-3 align-middle", highlighted && "shadow-[inset_3px_0_0_var(--bz-ink)]")}>
                        <span className="mono text-[12px]">{row.reference}</span>
                      </td>
                      <td className="px-3.5 py-3 align-middle">
                        <Link
                          href={href}
                          onClick={() => rememberOpened(row.reference)}
                          className="font-medium whitespace-nowrap text-bz-ink hover:underline"
                        >
                          {row.fullName}
                        </Link>
                        <div className="mono mt-0.5 text-[11px] whitespace-nowrap text-bz-muted">{row.mobile}</div>
                      </td>
                      <td className="px-3.5 py-3 align-middle">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span
                            aria-hidden
                            className={cn("size-[7px] rounded-[2px]", row.service === "pre_approval" ? "bg-bz-ink" : "bg-bz-accent")}
                          />
                          <span className="font-medium">
                            {row.service === "pre_approval" ? t("service.preApproval") : t("service.consultancy")}
                          </span>
                        </div>
                        <div className="mt-0.5 ps-[15px] text-[11.5px] whitespace-nowrap text-bz-muted">{row.profile}</div>
                      </td>
                      <td className="px-3.5 py-3 align-middle">
                        <DocumentBar states={row.docs} />
                      </td>
                      <td className="px-3.5 py-3 align-middle">
                        <StatusPill status={row.status} small />
                      </td>
                      <td className="px-3.5 py-3 align-middle">
                        {row.sla ? <PromiseClock sla={row.sla} width={176} /> : row.consult ? <ConsultCell {...row.consult} /> : null}
                      </td>
                      <td className="px-3.5 py-3 align-middle">
                        <OwnerAvatar owner={row.owner} />
                      </td>
                      <td className="px-3.5 py-3 align-middle text-[12px] whitespace-nowrap text-bz-muted">{row.received}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-bz-border px-[18px] py-3 text-[12px] text-bz-muted">
          <span aria-live="polite">
            {result ? t(footerKey, { shown: rows.length, total: result.total }) : null}
          </span>
          <span className="flex gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("c1.aria.prev")}
              disabled={!result || page <= 1}
              onClick={() => toPage(page - 1)}
            >
              <ArrowLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("c1.aria.next")}
              disabled={!result || page >= result.pageCount}
              onClick={() => toPage(page + 1)}
            >
              <ArrowRight />
            </Button>
          </span>
        </div>
      </section>
    </div>
  );
}
