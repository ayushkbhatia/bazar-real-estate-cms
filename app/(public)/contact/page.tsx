import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Home,
  Building2,
  Tag,
  Upload,
  Layers,
  Link2,
  SlidersHorizontal,
  FileText,
  User,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { EnquiryForm } from "../_components/enquiry-form";
import { buildAdvisorWhatsAppLink } from "@/lib/whatsapp";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";
import { HqMap } from "./_components/hq-map";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { list, str } from "@/lib/master-pages";

export const metadata: Metadata = {
  title: "Contact Bazar Real Estate",
  description:
    "Get in touch with Bazar Real Estate for buying, selling, renting, listing, or investment enquiries across Abu Dhabi and the UAE.",
  alternates: { canonical: "/contact" },
};

export const revalidate = 300;

/**
 * Tiles in the "How can we help?" grid name their icon by keyword — a stored
 * list item can't carry a component. Anything outside this allowlist falls back
 * to an icon keyed off the tile's link, then to a generic one, so a tile added
 * in the editor always renders something.
 */
const HELP_ICONS: Record<string, LucideIcon> = {
  home: Home,
  building: Building2,
  tag: Tag,
  upload: Upload,
  layers: Layers,
  link: Link2,
  sliders: SlidersHorizontal,
  file: FileText,
  user: User,
};

const HELP_ICON_BY_HREF: Record<string, LucideIcon> = {
  "/buy": Home,
  "/rent": Building2,
  "/services/sell": Tag,
  "/off-plan": Layers,
  "/developers": Link2,
  "/services": SlidersHorizontal,
  "/insights": FileText,
  "/about": User,
};

function helpIcon(name: string | null, href: string | null): LucideIcon {
  return (
    HELP_ICONS[(name ?? "").toLowerCase()] ??
    HELP_ICON_BY_HREF[href ?? ""] ??
    SlidersHorizontal
  );
}

const HELP_FALLBACK: { label: string; href: string; icon: string }[] = [
  { label: "Buy a Property", href: "/buy", icon: "home" },
  { label: "Rent a Property", href: "/rent", icon: "building" },
  { label: "Sell Your Property", href: "/services/sell", icon: "tag" },
  { label: "List Your Property", href: "/services/sell", icon: "upload" },
  { label: "Explore New Projects", href: "/off-plan", icon: "layers" },
  { label: "Our Partners", href: "/developers", icon: "link" },
  { label: "Our Services", href: "/services", icon: "sliders" },
  { label: "Insights", href: "/insights", icon: "file" },
  { label: "About Us", href: "/about", icon: "user" },
];

const DEFAULT_ADDRESS =
  "Sheikha Salama Building, Office 4\nZayed The First Street, Al Bateen\nAbu Dhabi, United Arab Emirates";

/** `+971 2 632 2223` → `tel:+97126322223`. */
function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

function ContactWhatsAppLink({ label }: { label: string }) {
  const waUrl = buildAdvisorWhatsAppLink("Hi Bazar, I'd like to talk.");
  if (!waUrl) return null;
  return (
    <div className="mt-4 flex items-center">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="contact-whatsapp-link"
        className="inline-flex items-center gap-2 text-[13px] text-bz-ink-2 hover:text-bz-accent transition-colors"
      >
        <MessageCircle size={14} strokeWidth={1.6} />
        {label}
      </a>
    </div>
  );
}

/**
 * `contact_details` and `enquiry_form` are the two columns of one grid rather
 * than two stacked bands, so consecutive column sections render inside a shared
 * wrapper instead of each emitting a section of its own.
 */
const COLUMN_KEYS = ["contact_details", "enquiry_form"];

export default async function ContactPage() {
  // Section copy, links and order come from /admin/pages/master/contact.
  // Anything untouched falls back to the literals the page shipped with.
  const content = await getMasterPageContent("contact");
  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const detailsV = v("contact_details");
  const formV = v("enquiry_form");
  const helpV = v("help");

  const phones = [
    str(detailsV, "phone_1") ?? "+971 2 632 2223",
    str(detailsV, "phone_2"),
  ].filter((n): n is string => Boolean(n));
  const email = str(detailsV, "email") ?? "info@bazarrealestate.ae";
  const addressLines = (str(detailsV, "address") ?? DEFAULT_ADDRESS)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const detailRows: {
    icon: LucideIcon;
    label: string;
    body: React.ReactNode;
    note: string | null;
  }[] = [
    {
      icon: Phone,
      label: str(detailsV, "phone_label") ?? "Call us / message us",
      body:
        phones.length > 0 ? (
          <div className="space-y-0.5">
            {phones.map((number) => (
              <a
                key={number}
                href={telHref(number)}
                className="block text-[18px] hover:text-bz-accent"
              >
                {number}
              </a>
            ))}
          </div>
        ) : null,
      note: str(detailsV, "phone_note"),
    },
    {
      icon: Mail,
      label: str(detailsV, "email_label") ?? "Email us",
      body: (
        <a href={`mailto:${email}`} className="text-[18px] text-bz-accent">
          {email}
        </a>
      ),
      note: str(detailsV, "email_note"),
    },
    {
      icon: MapPin,
      label: str(detailsV, "office_label") ?? "Visit our office",
      body:
        addressLines.length > 0 ? (
          <div className="text-[15px] leading-relaxed">
            {addressLines.map((line, i) => (
              <React.Fragment key={line}>
                {i > 0 ? <br /> : null}
                {line}
              </React.Fragment>
            ))}
          </div>
        ) : null,
      note: str(detailsV, "office_note"),
    },
  ].filter((row) => row.body !== null);

  const helpItems = (() => {
    const stored = list<Record<string, unknown>>(helpV, "items")
      .map((item) => ({
        label: typeof item.label === "string" ? item.label : "",
        href: typeof item.href === "string" ? item.href : "",
        icon: typeof item.icon === "string" ? item.icon : null,
      }))
      .filter((item) => item.label !== "" && item.href !== "");
    return stored.length > 0 ? stored : HELP_FALLBACK;
  })();

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <section key="hero" className="px-4 md:px-12 pt-12 md:pt-20 pb-8">
        <Eyebrow>{str(heroV, "eyebrow") ?? "Contact"}</Eyebrow>
        <h1
          className="serif mt-3.5"
          style={{
            fontSize: fluid(88),
            letterSpacing: "-0.03em",
            lineHeight: 0.97,
          }}
        >
          {str(heroV, "title") ?? "Let's talk"}{" "}
          <em className="italic">{str(heroV, "title_emphasis") ?? "property."}</em>
        </h1>
        <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[680px] leading-relaxed mt-5">
          {str(heroV, "subtitle") ??
            "Get in touch with Bazar Real Estate for buying, selling, renting, listing, or investment enquiries across Abu Dhabi and the UAE."}
        </p>
      </section>
    ),

    contact_details: (
      <div key="contact_details" className="flex flex-col">
        {detailRows.map(({ icon: Icon, label, body, note }) => (
          <div key={label} className="flex gap-5 py-6 border-t border-bz-border">
            <div className="text-bz-accent mt-0.5">
              <Icon size={20} strokeWidth={1.6} />
            </div>
            <div className="flex-1">
              <div className="eyebrow">{label}</div>
              <div className="mt-2 text-bz-ink">{body}</div>
              {note ? (
                <div className="text-[12.5px] text-bz-muted mt-1.5">{note}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    ),

    enquiry_form: (
      <div
        key="enquiry_form"
        className="rounded-lg border border-bz-border bg-bz-surface p-6 md:p-9"
      >
        <div className="serif text-[26px]" style={{ letterSpacing: "-0.015em" }}>
          {str(formV, "form_title") ?? "Send us an enquiry"}
        </div>
        <p className="text-[14px] text-bz-muted mt-2">
          {str(formV, "form_sub") ??
            "Tell us what you're looking for, and our team will get back to you shortly."}
        </p>
        <div className="mt-6">
          <EnquiryForm source="contact_page" showIntent />
        </div>
        <ContactWhatsAppLink
          label={str(formV, "whatsapp_label") ?? "WhatsApp us instead"}
        />
      </div>
    ),

    help: (
      <section
        key="help"
        className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border bg-bz-surface-2"
      >
        <div>
          <SectionHead
            eyebrow={str(helpV, "eyebrow") ?? "How can we help?"}
            title={
              str(helpV, "heading") ??
              "Choose the service that matches your enquiry."
            }
            sub={
              str(helpV, "sub") ??
              "We'll connect you with the right member of our team."
            }
            size={44}
            className="mb-9"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {helpItems.map((item, i) => {
              const Icon = helpIcon(item.icon ?? null, item.href);
              return (
                <Link
                  key={`${item.label}-${i}`}
                  href={item.href}
                  className="group flex items-center gap-4 rounded-lg border border-bz-border bg-bz-surface p-6 hover:border-bz-ink transition-colors"
                >
                  <div className="w-11 h-11 rounded-lg bg-bz-accent-soft text-bz-accent flex items-center justify-center flex-shrink-0">
                    <Icon size={20} strokeWidth={1.6} />
                  </div>
                  <div className="text-[16px] font-medium flex-1">
                    {item.label}
                  </div>
                  <ArrowRight
                    size={16}
                    strokeWidth={1.7}
                    className="text-bz-muted transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    ),

    hq_map: <HqMap key="hq_map" />,
  };

  // Group the runs of grid-column sections so the pair shares one wrapper.
  const groups: { grid: boolean; keys: string[] }[] = [];
  for (const key of content.order) {
    if (!nodes[key]) continue;
    const grid = COLUMN_KEYS.includes(key);
    const last = groups[groups.length - 1];
    if (grid && last?.grid) last.keys.push(key);
    else groups.push({ grid, keys: [key] });
  }

  return (
    <div className="bg-bz-bg">
      {groups.map((group) =>
        group.grid ? (
          <section
            key={group.keys[0]}
            className="px-4 md:px-12 py-10 md:py-14"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-[72px] items-start">
              {group.keys.map((key) => (
                <React.Fragment key={key}>{nodes[key]}</React.Fragment>
              ))}
            </div>
          </section>
        ) : (
          <React.Fragment key={group.keys[0]}>
            {nodes[group.keys[0]]}
          </React.Fragment>
        ),
      )}
    </div>
  );
}
