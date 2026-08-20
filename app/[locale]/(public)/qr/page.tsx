import { setRequestLocale } from "next-intl/server";
import * as React from "react";
import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import QRCode from "qrcode";
import { ArrowRight, Mail, MapPin, Phone, QrCode, type LucideIcon } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { fluid } from "../_components/marketing/fluid";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { str } from "@/lib/master-pages";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { asLocale } from "@/lib/i18n/locales";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Title and description are CMS-owned: Pages & blocks → this page →
  // Search appearance. Unedited, they fall back to the strings that used
  // to be the literal here, now in MASTER_PAGE_SEO_DEFAULTS.
  return masterPageMetadata("qr", asLocale((await params).locale),
  {
    alternates: { canonical: "/qr" },
    // A display surface, not a landing page: it must not compete with /contact
    // in search results.
    robots: { index: false, follow: false },
  });
}

/**
 * The address the code encodes when the field is blank.
 *
 * Deliberately a literal rather than something derived from the request origin:
 * a code printed from a preview deployment has to resolve to the same place as
 * one printed from production, and reading the request would force this route
 * out of ISR into dynamic rendering.
 */
const DEFAULT_QR_URL = "https://www.bazarrealestate.ae/contact-qr";

/** `qrcode` emits a bare `<svg viewBox=…>`, so the sizing classes go on here. */
async function renderQrSvg(url: string): Promise<string | null> {
  try {
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });
    return svg.replace("<svg ", '<svg class="h-full w-full" ');
  } catch (error) {
    console.error("[qr] failed to render code", error);
    return null;
  }
}

function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

export default async function QrPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Before any other await. `getMasterPageContent` resolves its locale from
  // the request, and without this `getLocale()` has nothing to resolve — the
  // page renders English content under `lang="ar"` in an RTL layout, which is
  // the failure `lib/i18n/current.ts` describes: it looks finished.
  setRequestLocale(asLocale((await params).locale));

  const content = await getMasterPageContent("qr");

  // Section copy, links and order come from /admin/pages/master/qr. Anything
  // untouched falls back to the literals below.
  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const qrV = v("qr_code");
  const detailsV = v("contact_details");
  const ctaV = v("cta");

  const qrUrl = str(qrV, "url") ?? DEFAULT_QR_URL;
  const qrSvg = await renderQrSvg(qrUrl);
  const showUrl = qrV.show_url !== false;

  const phonePrimary = str(detailsV, "phone_primary") ?? "+971 2 632 2223";
  const phoneSecondary = str(detailsV, "phone_secondary");
  const email = str(detailsV, "email") ?? "info@bazarrealestate.ae";
  const addressLines = (
    str(detailsV, "address") ??
    "Sheikha Salama Building, Office 4\nZayed The First Street, Al Bateen\nAbu Dhabi, United Arab Emirates"
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const details: [LucideIcon, string, React.ReactNode, string | null][] = [
    [
      Phone,
      str(detailsV, "phone_label") ?? "Call us / message us",
      <div key="p" className="space-y-0.5">
        <a
          href={telHref(phonePrimary)}
          className="block text-[18px] hover:text-bz-accent"
        >
          {phonePrimary}
        </a>
        {phoneSecondary ? (
          <a
            href={telHref(phoneSecondary)}
            className="block text-[18px] hover:text-bz-accent"
          >
            {phoneSecondary}
          </a>
        ) : null}
      </div>,
      str(detailsV, "phone_note"),
    ],
    [
      Mail,
      str(detailsV, "email_label") ?? "Email us",
      <a key="e" href={`mailto:${email}`} className="text-[18px] text-bz-accent">
        {email}
      </a>,
      str(detailsV, "email_note"),
    ],
    [
      MapPin,
      str(detailsV, "address_label") ?? "Visit our office",
      <div key="o" className="text-[15px] leading-relaxed">
        {addressLines.map((line, i) => (
          <React.Fragment key={line}>
            {i > 0 ? <br /> : null}
            {line}
          </React.Fragment>
        ))}
      </div>,
      null,
    ],
  ];

  const ctaLabel = str(ctaV, "cta_label") ?? "Contact us";
  const cta2Label = str(ctaV, "cta_2_label");

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <section
        key="hero"
        className="px-4 md:px-12 pt-12 md:pt-20 pb-8 print:pt-0 print:pb-4"
      >
        <Eyebrow>{str(heroV, "eyebrow") ?? "Scan to connect"}</Eyebrow>
        <h1
          className="serif mt-3.5"
          style={{
            fontSize: fluid(88),
            letterSpacing: "-0.03em",
            lineHeight: 0.97,
          }}
        >
          {str(heroV, "title") ?? "Point your camera here."}
        </h1>
        <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[680px] leading-relaxed mt-5">
          {str(heroV, "subtitle") ??
            "Scan the code to reach Bazar Real Estate — buying, selling, renting, listing, or investment enquiries across Abu Dhabi and the UAE."}
        </p>
      </section>
    ),

    qr_code: (
      <section
        key="qr_code"
        className="px-4 md:px-12 py-10 md:py-14 print:py-4"
      >
        <div className="rounded-lg border border-bz-border bg-bz-surface p-6 md:p-9 print:break-inside-avoid print:bg-transparent">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-[56px] md:items-center">
            {/* The white plate is literal, not tokenised: a code rendered on a
                dark surface does not scan, whatever theme the screen is in. */}
            <div className="mx-auto w-full max-w-[320px] md:mx-0">
              <div className="rounded-md bg-white p-5 shadow-sm print:shadow-none">
                <div className="aspect-square w-full">
                  {qrSvg ? (
                    <div
                      className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
                      aria-label={`QR code for ${qrUrl}`}
                      role="img"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-black/50">
                      <QrCode size={48} strokeWidth={1.4} />
                    </div>
                  )}
                </div>
                {showUrl ? (
                  <div className="mono mt-4 break-all text-center text-[11px] leading-relaxed text-black/70">
                    {qrUrl}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="min-w-0">
              {str(qrV, "heading") ? (
                <div
                  className="serif text-[26px] md:text-[32px]"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {str(qrV, "heading")}
                </div>
              ) : null}
              {str(qrV, "caption") ? (
                <p className="text-[14px] text-bz-muted mt-2">
                  {str(qrV, "caption")}
                </p>
              ) : null}
              <p className="mt-6 max-w-[42ch] text-[15px] text-bz-ink-2 leading-relaxed">
                {str(qrV, "instruction") ??
                  "Open the camera on your phone, hold it over the code, and tap the link that appears. No app needed."}
              </p>
              <a
                href={qrUrl}
                className="mt-6 inline-flex items-center gap-2 text-[13px] text-bz-ink-2 hover:text-bz-accent transition-colors print:hidden"
              >
                <QrCode size={14} strokeWidth={1.6} />
                Open the link on this device
              </a>
            </div>
          </div>
        </div>
      </section>
    ),

    contact_details: (
      <section
        key="contact_details"
        className="px-4 md:px-12 py-10 md:py-14 border-t border-bz-border print:py-6"
      >
        <Eyebrow>{str(detailsV, "eyebrow") ?? "Or reach us directly"}</Eyebrow>
        {str(detailsV, "heading") ? (
          <h2
            className="serif mt-3 font-normal"
            style={{
              fontSize: fluid(40),
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            {str(detailsV, "heading")}
          </h2>
        ) : null}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-12">
          {details.map(([Icon, label, body, note]) => (
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
      </section>
    ),

    cta: (
      <section
        key="cta"
        className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border bg-bz-surface-2 print:hidden"
      >
        <Eyebrow>{str(ctaV, "eyebrow") ?? "No phone to hand?"}</Eyebrow>
        <h2
          className="serif mt-3 font-normal"
          style={{
            fontSize: fluid(40),
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          {str(ctaV, "heading") ?? "Send us an enquiry instead."}
        </h2>
        <p className="mt-4 max-w-[46ch] text-[15px] text-bz-ink-2 leading-relaxed">
          {str(ctaV, "body") ??
            "Tell us what you're looking for and our team will get back to you shortly."}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          {ctaLabel ? (
            <Link
              href={str(ctaV, "cta_href") ?? "/contact"}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-bz-ink text-bz-bg text-[13.5px] hover:bg-bz-ink/90 transition-colors"
            >
              {ctaLabel}
              <ArrowRight size={16} strokeWidth={1.7} />
            </Link>
          ) : null}
          {cta2Label ? (
            <Link
              href={str(ctaV, "cta_2_href") ?? "/buy"}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md border border-bz-border bg-bz-surface text-[13.5px] hover:border-bz-ink transition-colors"
            >
              {cta2Label}
            </Link>
          ) : null}
        </div>
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
