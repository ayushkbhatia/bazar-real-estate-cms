import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { FrequencyPicker } from "./_frequency-picker";

export const metadata: Metadata = {
  title: "Alert preferences",
  description:
    "Set how often Bazar emails you new matches on your saved searches.",
};

type SavedSearchRow = {
  id: string;
  name: string;
  mode: "buy" | "rent" | "off_plan" | "commercial" | null;
  query: Record<string, unknown> | null;
  alert_frequency: "off" | "instant" | "daily" | "weekly";
  last_alert_at: string | null;
  created_at: string;
};

function searchHref(s: SavedSearchRow): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(s.query ?? {})) {
    if (v != null && v !== "") params.set(k, String(v));
  }
  const base =
    s.mode === "rent"
      ? "/rent"
      : s.mode === "off_plan"
        ? "/off-plan"
        : s.mode === "commercial"
          ? "/commercial"
          : "/buy";
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AccountAlertsPage() {
  if (!isSupabaseConfigured) redirect("/sign-in");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data, error } = await supabase
    .from("saved_searches")
    .select(
      "id, name, mode, query, alert_frequency, last_alert_at, created_at",
    )
    .order("created_at", { ascending: false });

  const rows = (error || !data ? [] : data) as unknown as SavedSearchRow[];

  return (
    <div className="max-w-[920px]">
      <Eyebrow>Alerts</Eyebrow>
      <h1
        className="serif text-[48px] mt-2 font-normal leading-[1.05]"
        style={{ letterSpacing: "-0.025em" }}
      >
        How we notify you.
      </h1>
      <p className="mt-4 text-[15px] text-bz-muted max-w-[60ch]">
        Each saved search has its own cadence. Set <span className="mono">off</span>{" "}
        to pause notifications without losing the saved query.
      </p>

      {rows.length === 0 ? (
        <div className="mt-12 py-16 text-center max-w-[52ch] mx-auto border border-dashed border-bz-border rounded-md">
          <p className="text-[15px] text-bz-ink-2">
            You haven&apos;t saved any searches yet.
          </p>
          <Button asChild className="mt-6">
            <Link href="/buy">Browse listings</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-10 flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-md border border-bz-border bg-bz-surface p-5"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <Link
                    href={searchHref(row)}
                    className="serif text-[20px] leading-tight hover:text-bz-accent transition-colors"
                    style={{ letterSpacing: "-0.012em" }}
                  >
                    {row.name}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-bz-muted">
                    <span className="uppercase tracking-wider">
                      {row.mode === "rent"
                        ? "Rent"
                        : row.mode === "off_plan"
                          ? "Off-plan"
                          : row.mode === "commercial"
                            ? "Commercial"
                            : "Buy"}
                    </span>
                    <span>·</span>
                    <span>Last alert · {formatRelative(row.last_alert_at)}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <FrequencyPicker
                    id={row.id}
                    initial={row.alert_frequency}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-14 border-t border-bz-border pt-10">
        <Eyebrow>Channel</Eyebrow>
        <p className="mt-3 text-[14px] text-bz-ink-2 max-w-[60ch] leading-relaxed">
          Alerts currently send by email. WhatsApp and SMS channels arrive in
          Sprint 10 once the lead-engine workflows ship.
        </p>
      </div>
    </div>
  );
}
