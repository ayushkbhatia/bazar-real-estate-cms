import Link from "next/link";
import { ExternalLink, MapPin, Settings2 } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { EmailSurface } from "@/lib/content-assets/usage";

/**
 * Which forms, pages and routes send this email.
 *
 * The question a marketing manager asks before rewriting anything: change the
 * enquiry acknowledgement and you have changed what eighteen boxes on eleven
 * pages reply with, and that should be visible on the page where the change
 * is made, not inferred from the trigger sentence.
 *
 * Form lines come from the registry, so they stay true as forms are added,
 * and each links to both the form in the CMS and the page it sits on.
 */
export function WhereUsed({
  surfaces,
  note,
}: {
  surfaces: EmailSurface[];
  note?: string;
}) {
  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-5">
      <div className="flex items-center gap-2">
        <MapPin size={13} strokeWidth={1.8} className="text-bz-muted" />
        <Eyebrow>Where it is used</Eyebrow>
        <span className="ms-auto text-[11.5px] text-bz-muted">
          {surfaces.length} {surfaces.length === 1 ? "place" : "places"}
        </span>
      </div>
      {note ? (
        <p className="mt-2 text-[12.5px] text-bz-muted max-w-[70ch]">{note}</p>
      ) : null}
      {surfaces.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-bz-muted">
          Nothing sends this email at the moment.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 text-[12.5px]">
          {surfaces.map((s) => (
            <li key={`${s.label}-${s.path ?? s.adminPath ?? ""}`} className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {s.adminPath ? (
                  <Link href={s.adminPath} className="text-bz-ink hover:underline inline-flex items-center gap-1">
                    <Settings2 size={11} strokeWidth={1.8} className="text-bz-muted" />
                    {s.label}
                  </Link>
                ) : (
                  <span className="text-bz-ink-2">{s.label}</span>
                )}
                {s.path ? (
                  <Link
                    href={s.path}
                    target="_blank"
                    className="mono text-[11.5px] text-bz-muted inline-flex items-center gap-1 hover:text-bz-ink"
                  >
                    {s.path}
                    <ExternalLink size={10} strokeWidth={1.8} />
                  </Link>
                ) : null}
              </span>
              {s.note ? (
                <span className="text-[11.5px] text-bz-muted">{s.note}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
