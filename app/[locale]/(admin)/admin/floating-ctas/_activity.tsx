import { Mail, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CTA_CLICK_WINDOW_DAYS,
  type CtaClickRow,
  type CtaClickSummary,
} from "@/lib/queries/floating-ctas";
import type { FloatingCtaKind } from "@/lib/schemas/floating-cta";

const ICONS: Record<FloatingCtaKind, typeof Phone> = {
  whatsapp: MessageCircle,
  call: Phone,
  email: Mail,
};

/** Where the click was sent, in the words the office would use. */
const SOURCE_LABELS: Record<CtaClickRow["source"], string> = {
  advisor: "The page's advisor",
  cta: "The button's own number",
  fallback: "Site-wide fallback",
};

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * What the buttons actually did.
 *
 * This is the only record that exists. A WhatsApp click opens a chat inside
 * the visitor's own app and a mail click hands a draft to their mail client —
 * neither reaches Bazar, so the conversation itself is invisible here and on
 * purpose. What this panel can answer is how often each button is pressed, on
 * what, and whether it reached the listing's own advisor or the switchboard.
 *
 * It is deliberately not the enquiries inbox: nobody has given a name yet.
 */
export function FloatingCtaActivity({
  rows,
  summary,
}: {
  rows: CtaClickRow[];
  summary: CtaClickSummary;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[14px] font-medium">
          Activity · last {CTA_CLICK_WINDOW_DAYS} days
        </h2>
        <p className="text-[13px] text-bz-muted max-w-[70ch] mt-1">
          Every press of a floating button. The conversation itself happens in
          the visitor&apos;s own WhatsApp or mail app and never reaches us, so
          this is the record that the enquiry was started — not its contents.
          Nobody has given a name at this point, which is why these aren&apos;t
          in <span className="font-medium">Enquiries</span>.
        </p>
      </div>

      {summary.total === 0 ? (
        <p className="text-[13px] text-bz-muted border border-dashed border-bz-border rounded p-4">
          No clicks recorded yet.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {summary.byKey.map((s) => {
              const Icon = ICONS[s.kind as FloatingCtaKind] ?? Phone;
              return (
                <div
                  key={s.cta_key}
                  className="flex items-center gap-2 rounded border border-bz-border bg-bz-surface px-3 py-2"
                >
                  <Icon size={14} strokeWidth={1.8} className="text-bz-muted" />
                  <span className="mono text-[11px] text-bz-ink-2">
                    {s.cta_key}
                  </span>
                  <span className="text-[15px] font-medium">{s.count}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 rounded border border-bz-border bg-bz-surface px-3 py-2">
              <span className="text-[11px] uppercase tracking-wider text-bz-ink-2">
                Reached the listing&apos;s advisor
              </span>
              <span className="text-[15px] font-medium">
                {summary.toAdvisor}
              </span>
              <span className="text-[12px] text-bz-muted">
                of {summary.total}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-bz-border rounded">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bz-surface-2 text-bz-ink-2">
                <tr>
                  <Th>When</Th>
                  <Th>Button</Th>
                  <Th>On</Th>
                  <Th>Routed to</Th>
                  <Th>Destination</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-bz-border">
                    <Td className="whitespace-nowrap text-bz-muted">
                      {relative(r.created_at)}
                    </Td>
                    <Td className="mono text-[11.5px]">{r.cta_key}</Td>
                    <Td className="max-w-[28ch] truncate">
                      {r.context_ref ?? r.page_title ?? r.path}
                    </Td>
                    <Td
                      className={cn(
                        "whitespace-nowrap",
                        r.source !== "advisor" && "text-bz-muted",
                      )}
                    >
                      {r.advisor_name ?? SOURCE_LABELS[r.source]}
                    </Td>
                    <Td className="mono text-[11.5px] text-bz-muted">
                      {r.destination ?? "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-medium px-3 py-2 text-[11px] uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 py-2", className)}>{children}</td>;
}
