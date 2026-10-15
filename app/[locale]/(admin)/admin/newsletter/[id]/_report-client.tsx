"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import { EmailFrame, InboxHeader, ViewportToggle, type EmailViewport } from "../../content-assets/emails/_email-frame";

/** Re-read the counts every few seconds while the campaign is going out. */
export function RefreshWhileSending() {
  const router = useRouter();
  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(t);
  }, [router]);
  return null;
}

/** The email as it went out, in either edition. */
export function ReportPreview({
  english,
  arabic,
  from,
  replyTo,
}: {
  english: RenderedEmail;
  arabic: RenderedEmail | null;
  from: string;
  replyTo: string;
}) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [viewport, setViewport] = useState<EmailViewport>("desktop");
  const shown = lang === "ar" && arabic ? arabic : english;
  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface-2 overflow-hidden xl:sticky xl:top-6">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-bz-border bg-bz-surface">
        {arabic ? (
          <div role="tablist" aria-label="Edition" className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
            {(["en", "ar"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={cn(
                  "h-6 px-2 rounded text-[11.5px]",
                  lang === l ? "bg-bz-navy text-bz-bg font-medium" : "text-bz-ink-2 hover:text-bz-ink",
                )}
              >
                {l === "en" ? "English" : "Arabic"}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[11.5px] text-bz-muted">English edition (no Arabic)</span>
        )}
        <div className="ms-auto">
          <ViewportToggle value={viewport} onChange={setViewport} />
        </div>
      </div>
      <InboxHeader from={from} replyTo={replyTo} to="subscriber@example.com" subject={shown.subject} />
      <EmailFrame html={shown.html} viewport={viewport} title="Newsletter as sent" className="py-4" />
    </section>
  );
}
