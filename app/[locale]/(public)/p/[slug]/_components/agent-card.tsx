import Link from "@/components/i18n/link";
import Image from "next/image";
import { Phone, MessageCircle, Mail, Send } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { PropertyAdvisor } from "@/lib/queries/property-advisor";
import type { ResolvedForm } from "@/lib/forms/types";
import { PropertyEnquiryDialog } from "./enquiry-dialog";

/**
 * Lead-advisor card on the property page.
 *
 * Now driven by `properties.assigned_agent_id` (see
 * `lib/queries/property-advisor.ts`) instead of a seed entry matched on area.
 *
 * Contact actions render only when the advisor actually has that detail on
 * their `staff` row — `staff` gained publishable contact columns in 0077 and
 * they start empty, so a profile with no phone number shows no Call button
 * rather than a `tel:` link to nowhere. The enquiry action is always there,
 * which keeps the card actionable in the meantime.
 */
export function AgentCard({
  enquiryForm,
  advisor,
  propertyId,
  propertyReference,
  propertyTitle,
}: {
  /** Resolved from /admin/forms by the listing page. */
  enquiryForm: ResolvedForm;
  advisor: PropertyAdvisor;
  propertyId: string;
  propertyReference: string;
  propertyTitle: string;
}) {
  const firstName = advisor.display_name.split(" ")[0];
  const waUrl = buildWhatsAppLink(
    advisor.whatsapp,
    `Hi ${firstName}, I'm interested in ${propertyReference} on bazar.ae`,
  );
  const telUrl = advisor.phone
    ? `tel:${advisor.phone.replace(/\s/g, "")}`
    : null;
  const mailUrl = advisor.email
    ? `mailto:${advisor.email}?subject=${encodeURIComponent(
        `Bazar enquiry · ${propertyReference}`,
      )}`
    : null;

  const directActions = [telUrl, waUrl, mailUrl].filter(Boolean).length;

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <div className="flex gap-4 items-start">
        <Link
          href={`/agents/${advisor.slug}`}
          className="block w-16 h-16 rounded-md overflow-hidden flex-shrink-0"
        >
          {advisor.photo_url ? (
            <Image
              src={advisor.photo_url}
              alt={advisor.display_name}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          ) : (
            <PlaceholderImage label={advisor.slug} className="w-full h-full" />
          )}
        </Link>
        <div className="min-w-0">
          <Eyebrow>Lead advisor</Eyebrow>
          <Link
            href={`/agents/${advisor.slug}`}
            className="block mt-1 serif text-[18px] leading-tight hover:text-bz-accent transition-colors"
            style={{ letterSpacing: "-0.008em" }}
          >
            {advisor.display_name}
          </Link>
          {advisor.title ? (
            <div className="text-[12px] text-bz-muted mt-0.5">
              {advisor.title}
            </div>
          ) : null}
          {advisor.brn ? (
            <div className="mt-2 mono text-[11px] text-bz-muted">
              BRN · <span className="text-bz-ink-2">{advisor.brn}</span>
            </div>
          ) : null}
        </div>
      </div>

      {directActions > 0 ? (
        <div
          className="mt-5 grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${directActions}, minmax(0, 1fr))`,
          }}
        >
          {telUrl ? (
            <a
              href={telUrl}
              className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-bz-ink text-bz-bg text-[12.5px] font-medium hover:bg-bz-ink-2 transition-colors"
            >
              <Phone size={13} strokeWidth={1.8} />
              Call
            </a>
          ) : null}
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 text-[12.5px] hover:border-bz-border-strong transition-colors"
            >
              <MessageCircle size={13} strokeWidth={1.7} />
              WhatsApp
            </a>
          ) : null}
          {mailUrl ? (
            <a
              href={mailUrl}
              className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 text-[12.5px] hover:border-bz-border-strong transition-colors"
            >
              <Mail size={13} strokeWidth={1.7} />
              Email
            </a>
          ) : null}
        </div>
      ) : null}

      <PropertyEnquiryDialog
        form={enquiryForm}
        propertyId={propertyId}
        propertyReference={propertyReference}
        propertyTitle={propertyTitle}
        advisorName={advisor.display_name}
      >
        <button
          type="button"
          className={`w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-[12.5px] transition-colors ${
            directActions > 0
              ? "mt-2 border border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong"
              : "mt-5 bg-bz-ink text-bz-bg font-medium hover:bg-bz-ink-2"
          }`}
        >
          <Send size={13} strokeWidth={1.7} />
          Enquire about {propertyReference}
        </button>
      </PropertyEnquiryDialog>

      {advisor.languages.length > 0 ? (
        <p className="mt-4 text-[11.5px] text-bz-muted leading-relaxed">
          {advisor.languages.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
