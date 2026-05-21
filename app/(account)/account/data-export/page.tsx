import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { RequestExportForm } from "./_form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Export my data",
  description:
    "Download a copy of the personal data Bazar holds about your account, per UAE PDPL.",
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function recentExports() {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("dsr_requests")
    .select("id, status, email, created_at, confirmed_at, fulfilled_at, payload")
    .eq("kind", "export")
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

export default async function DataExportPage() {
  const recent = await recentExports();

  return (
    <div className="max-w-[640px]">
      <Eyebrow>Privacy</Eyebrow>
      <h1
        className="serif text-[40px] font-normal mt-2"
        style={{ letterSpacing: "-0.025em" }}
      >
        Export my data.
      </h1>
      <p className="mt-3 text-[15.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
        Under UAE PDPL, you can download a copy of the personal data Bazar
        holds about your account. We&apos;ll send a confirmation link to your
        email; clicking it returns a JSON archive of:
      </p>
      <ul className="mt-4 text-[14px] text-bz-ink-2 leading-relaxed list-disc pl-5 flex flex-col gap-1">
        <li>Account profile (name, residency, language, marketing preference).</li>
        <li>Saved properties and saved searches.</li>
        <li>Enquiries you submitted, including message bodies.</li>
        <li>Viewings you booked.</li>
        <li>Newsletter subscription status.</li>
      </ul>
      <p className="mt-4 text-[12.5px] text-bz-muted leading-relaxed max-w-[60ch]">
        KYC documents tied to closed transactions are retained for seven years
        under UAE AML/CFT rules and aren&apos;t included in the automated
        export. To request those, email{" "}
        <a className="underline text-bz-ink" href="mailto:dpo@bazar.ae">
          dpo@bazar.ae
        </a>
        .
      </p>

      <RequestExportForm />

      {recent.length > 0 ? (
        <section className="mt-12">
          <h2
            className="serif text-[22px] font-normal"
            style={{ letterSpacing: "-0.015em" }}
          >
            Recent requests
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-[13px]">
            {recent.map((r) => {
              const counts = (r.payload as Record<string, unknown> | null)
                ?.counts as
                | Record<string, number>
                | undefined;
              const total = counts
                ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
                : null;
              return (
                <li
                  key={r.id}
                  className="border border-bz-border rounded-lg p-4 bg-bz-surface"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="text-[12px] uppercase tracking-widest text-bz-muted-2">
                      {r.status}
                    </span>
                    <span className="text-[11.5px] text-bz-muted mono">
                      {fmt(r.created_at)}
                    </span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-bz-ink-2">
                    {r.status === "fulfilled" && total != null ? (
                      <>Fulfilled {fmt(r.fulfilled_at)} · {total} record(s).</>
                    ) : r.status === "pending" ? (
                      <>Confirmation email sent to {r.email}.</>
                    ) : (
                      <>Status: {r.status}.</>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 text-[12px] text-bz-muted">
        Need to delete your account? See{" "}
        <Link href="/account/data-deletion" className="underline text-bz-ink">
          /account/data-deletion
        </Link>
        .
      </p>
    </div>
  );
}
