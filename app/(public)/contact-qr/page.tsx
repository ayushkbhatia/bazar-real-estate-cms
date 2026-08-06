import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { EnquiryForm } from "../_components/enquiry-form";
import { fluid } from "../_components/marketing/fluid";
import { list, str } from "@/lib/master-pages";
import { ContactCard } from "./_components/contact-card";
import { loadContactQrContent } from "./_content";
import { bukra } from "./_fonts";

export const metadata: Metadata = {
  title: "Contact Bazar Real Estate",
  description:
    "You've scanned our code — save Bazar Real Estate to your phone in one tap, or call, WhatsApp or email an advisor in Abu Dhabi.",
  alternates: { canonical: "/contact-qr" },
};

export const revalidate = 300;

/**
 * /contact-qr — the scan destination.
 *
 * One card, sized for the phone it is almost always opened on: logo, a single
 * "Add to Contacts" button, and a tappable row per way of reaching us, with an
 * EN/AR toggle on top. The enquiry form and the explore links below it ship
 * switched off and can be re-enabled from /admin/pages/master/contact-qr.
 */
export default async function ContactQrPage() {
  const data = await loadContactQrContent();
  const { content } = data;

  const v = (key: string) => content.section(key)?.values ?? {};
  const formV = v("enquiry_form");
  const exploreV = v("explore");

  const exploreLinks = list<{ label?: string; href?: string }>(
    exploreV,
    "links",
  ).filter((l) => (l.label ?? "").trim() !== "");

  const nodes: Record<string, React.ReactNode> = {
    enquiry_form: (
      <section key="enquiry_form" className="px-4 md:px-12 py-8 md:py-12">
        <div className="mx-auto max-w-[640px] rounded-lg border border-bz-border bg-bz-surface p-5 md:p-9">
          {str(formV, "eyebrow") ? (
            <Eyebrow>{str(formV, "eyebrow")}</Eyebrow>
          ) : null}
          <div
            className="serif mt-2 text-[26px]"
            style={{ letterSpacing: "-0.015em" }}
          >
            {str(formV, "heading") ?? "Tell us what you're after."}
          </div>
          <p className="mt-2 text-[14px] text-bz-muted">
            {str(formV, "body") ??
              "A few lines is plenty — area, budget, timeline. An advisor will come back to you shortly."}
          </p>
          <div className="mt-6">
            <EnquiryForm source="contact_page" compact />
          </div>
        </div>
      </section>
    ),

    explore: (
      <section
        key="explore"
        className="px-4 md:px-12 py-10 md:py-14 border-t border-bz-border bg-bz-surface-2"
      >
        <div className="mx-auto max-w-[900px]">
          {str(exploreV, "eyebrow") ? (
            <Eyebrow>{str(exploreV, "eyebrow")}</Eyebrow>
          ) : null}
          <h2
            className="serif mt-2.5"
            style={{
              fontSize: fluid(36),
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            {str(exploreV, "heading") ?? "Have a look around."}
          </h2>
          {exploreLinks.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {exploreLinks.map((l) => (
                <Link
                  key={l.label}
                  href={l.href || "/"}
                  className="group flex min-h-[60px] items-center gap-3 rounded-lg border border-bz-border bg-bz-surface px-5 py-4 text-[15.5px] font-medium transition-colors hover:border-bz-ink"
                >
                  <span className="flex-1">{l.label}</span>
                  <ArrowRight
                    size={16}
                    strokeWidth={1.7}
                    className="text-bz-muted transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    ),
  };

  return (
    <div className="bg-bz-bg">
      {/* `bukra.variable` defines --font-bukra here; the card reads it for its
          Arabic nodes only (see contact-card.module.css). */}
      <div className={`${bukra.variable} px-4 py-8 md:py-12`}>
        <ContactCard
          blocks={data.blocks}
          name={data.name}
          logoUrl={data.logoUrl}
          logoAlt={data.logoAlt}
          tagline={data.tagline}
          saveLabel={data.saveLabel}
          vcardHref="/contact-qr/vcard"
          vcardFilename={data.vcardFilename}
          rows={data.rows}
          followLabel={data.followLabel}
          socials={data.socials}
          mapLabel={data.mapLabel}
          mapHref={data.mapHref}
          footerNote={data.footerNote}
        />
      </div>
      {content.order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </div>
  );
}
