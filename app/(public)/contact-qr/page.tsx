import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { EnquiryForm } from "../_components/enquiry-form";
import { fluid } from "../_components/marketing/fluid";
import { buildAdvisorWhatsAppLink } from "@/lib/whatsapp";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { list, str } from "@/lib/master-pages";

export const metadata: Metadata = {
  title: "Contact Bazar Real Estate",
  description:
    "You've scanned our code — call, WhatsApp, or email a Bazar advisor in Abu Dhabi, or send a short brief and we'll come back to you.",
  alternates: { canonical: "/contact-qr" },
};

export const revalidate = 300;

/**
 * `tel:` wants digits and an optional leading `+`, not the spacing an editor
 * types for legibility. The displayed number stays exactly as entered.
 */
function telHref(display: string): string {
  return `tel:${display.replace(/[^\d+]/g, "")}`;
}

type ActionProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string | null;
  external?: boolean;
  /** The one filled, thumb-sized action at the top of the rail. */
  primary?: boolean;
  testId?: string;
};

/**
 * One tap target in the quick-actions rail. Sized for a thumb first — the
 * whole card is the link, never just the text inside it.
 */
function ActionCard({
  href,
  icon,
  label,
  value,
  note,
  external,
  primary,
  testId,
}: ActionProps) {
  const external_ = external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
  return (
    <a
      href={href}
      data-testid={testId}
      {...external_}
      className={
        primary
          ? "flex min-h-[76px] items-center gap-4 rounded-lg bg-bz-ink px-5 py-4 text-bz-bg transition-opacity hover:opacity-90"
          : "flex min-h-[76px] items-center gap-4 rounded-lg border border-bz-border bg-bz-surface px-5 py-4 transition-colors hover:border-bz-ink"
      }
    >
      <div
        className={
          primary
            ? "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-bz-bg/15 text-bz-bg"
            : "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-bz-accent-soft text-bz-accent"
        }
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={
            primary
              ? "text-[11px] font-medium uppercase text-bz-bg/70"
              : "eyebrow"
          }
          style={primary ? { letterSpacing: "0.12em" } : undefined}
        >
          {label}
        </div>
        <div className="mt-1 truncate text-[17px] font-medium">{value}</div>
        {note ? (
          <div
            className={
              primary
                ? "mt-0.5 text-[12.5px] text-bz-bg/70"
                : "mt-0.5 text-[12.5px] text-bz-muted"
            }
          >
            {note}
          </div>
        ) : null}
      </div>
      <ArrowRight
        size={16}
        strokeWidth={1.7}
        className={primary ? "text-bz-bg/70" : "text-bz-muted"}
      />
    </a>
  );
}

export default async function ContactQrPage() {
  const content = await getMasterPageContent("contact-qr");

  // Copy, links and section order come from /admin/pages/master/contact-qr.
  // Anything untouched falls back to the literals below.
  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const actionsV = v("quick_actions");
  const formV = v("enquiry_form");
  const exploreV = v("explore");

  const phoneNumber = str(actionsV, "phone_number") ?? "+971 2 632 2223";
  const emailAddress = str(actionsV, "email_address") ?? "info@bazarrealestate.ae";
  const officeAddress =
    str(actionsV, "office_address") ??
    "Sheikha Salama Building, Office 4\nZayed The First Street, Al Bateen\nAbu Dhabi, United Arab Emirates";
  const officeLines = officeAddress.split("\n");
  const officeHref = str(actionsV, "office_href");
  // Null whenever no advisor number is configured — the action is dropped
  // rather than rendered as a dead link.
  const waHref = buildAdvisorWhatsAppLink(
    str(actionsV, "whatsapp_message") ?? "Hi Bazar, I just scanned your QR code.",
  );

  const exploreLinks = list<{ label?: string; href?: string }>(
    exploreV,
    "links",
  ).filter((l) => (l.label ?? "").trim() !== "");

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <section key="hero" className="px-4 md:px-12 pt-10 md:pt-16 pb-6">
        <Eyebrow>{str(heroV, "eyebrow") ?? "Scanned · Bazar Real Estate"}</Eyebrow>
        <h1
          className="serif mt-3.5"
          style={{
            fontSize: fluid(64),
            letterSpacing: "-0.03em",
            lineHeight: 0.99,
          }}
        >
          {str(heroV, "heading") ?? "Thanks for scanning."}
          {str(heroV, "heading_emphasis") ? (
            <>
              {" "}
              <em className="italic">{str(heroV, "heading_emphasis")}</em>
            </>
          ) : null}
        </h1>
        <p className="mt-4 max-w-[560px] text-[15.5px] md:text-[17px] leading-relaxed text-bz-ink-2">
          {str(heroV, "body") ??
            "You're in the right place. Pick whichever way is easiest — call us, message us on WhatsApp, email, or send a short brief and an advisor will come back to you."}
        </p>
      </section>
    ),

    quick_actions: (
      <section key="quick_actions" className="px-4 md:px-12 py-6 md:py-8">
        {str(actionsV, "eyebrow") ? (
          <Eyebrow>{str(actionsV, "eyebrow")}</Eyebrow>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {phoneNumber ? (
            <div className="sm:col-span-2">
              <ActionCard
                primary
                testId="qr-call-link"
                href={telHref(phoneNumber)}
                icon={<Phone size={20} strokeWidth={1.7} />}
                label={str(actionsV, "phone_label") ?? "Call us"}
                value={phoneNumber}
                note={str(actionsV, "phone_note") ?? "Mon–Sat 9am–7pm GST"}
              />
            </div>
          ) : null}

          {waHref ? (
            <ActionCard
              external
              testId="qr-whatsapp-link"
              href={waHref}
              icon={<MessageCircle size={20} strokeWidth={1.7} />}
              label={str(actionsV, "whatsapp_label") ?? "WhatsApp us"}
              value={str(actionsV, "whatsapp_value") ?? "Message an advisor"}
              note={str(actionsV, "whatsapp_note") ?? "Usually the fastest reply"}
            />
          ) : null}

          {emailAddress ? (
            <ActionCard
              testId="qr-email-link"
              href={`mailto:${emailAddress}`}
              icon={<Mail size={20} strokeWidth={1.7} />}
              label={str(actionsV, "email_label") ?? "Email us"}
              value={emailAddress}
              note={
                str(actionsV, "email_note") ??
                "We reply within 2 hours on business days"
              }
            />
          ) : null}
        </div>

        {officeAddress ? (
          <div className="mt-3 flex flex-col gap-4 rounded-lg border border-bz-border bg-bz-surface p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div className="mt-0.5 text-bz-accent">
                <MapPin size={20} strokeWidth={1.7} />
              </div>
              <div>
                <div className="eyebrow">
                  {str(actionsV, "office_label") ?? "Visit our office"}
                </div>
                <div className="mt-1.5 text-[15px] leading-relaxed text-bz-ink">
                  {officeLines.map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < officeLines.length - 1 ? <br /> : null}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
            {officeHref ? (
              <a
                href={officeHref}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="qr-directions-link"
                className="inline-flex h-11 flex-shrink-0 items-center justify-center gap-2 rounded-md border border-bz-border px-5 text-[13.5px] font-medium transition-colors hover:border-bz-ink"
              >
                <Navigation size={15} strokeWidth={1.8} />
                {str(actionsV, "office_cta") ?? "Get directions"}
              </a>
            ) : null}
          </div>
        ) : null}
      </section>
    ),

    enquiry_form: (
      <section key="enquiry_form" className="px-4 md:px-12 py-8 md:py-12">
        <div className="rounded-lg border border-bz-border bg-bz-surface p-5 md:p-9">
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
        {str(exploreV, "eyebrow") ? (
          <Eyebrow>{str(exploreV, "eyebrow")}</Eyebrow>
        ) : null}
        <h2
          className="serif mt-2.5"
          style={{ fontSize: fluid(36), letterSpacing: "-0.02em", lineHeight: 1.05 }}
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
      </section>
    ),
  };

  return (
    <div className="bg-bz-bg">
      {content.order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </div>
  );
}
