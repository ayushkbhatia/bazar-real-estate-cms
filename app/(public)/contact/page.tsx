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

export const metadata: Metadata = {
  title: "Contact Bazar Real Estate",
  description:
    "Get in touch with Bazar Real Estate for buying, selling, renting, listing, or investment enquiries across Abu Dhabi and the UAE.",
  alternates: { canonical: "/contact" },
};

const HELP: [string, LucideIcon, string][] = [
  ["Buy a Property", Home, "/buy"],
  ["Rent a Property", Building2, "/rent"],
  ["Sell Your Property", Tag, "/services/sell"],
  ["List Your Property", Upload, "/services/sell"],
  ["Explore New Projects", Layers, "/off-plan"],
  ["Our Partners", Link2, "/developers"],
  ["Our Services", SlidersHorizontal, "/services"],
  ["Insights", FileText, "/insights"],
  ["About Us", User, "/about"],
];

function ContactWhatsAppLink() {
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
        WhatsApp us instead
      </a>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-8">
        <Eyebrow>Contact</Eyebrow>
        <h1
          className="serif mt-3.5"
          style={{
            fontSize: fluid(88),
            letterSpacing: "-0.03em",
            lineHeight: 0.97,
          }}
        >
          Let&apos;s talk <em className="italic">property.</em>
        </h1>
        <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[680px] leading-relaxed mt-5">
          Get in touch with Bazar Real Estate for buying, selling, renting,
          listing, or investment enquiries across Abu Dhabi and the UAE.
        </p>
      </section>

      <section className="px-4 md:px-12 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-[72px] items-start max-w-[1200px]">
          {/* Contact info */}
          <div className="flex flex-col">
            {[
              [
                Phone,
                "Call us / message us",
                <div key="p">
                  <a
                    href="tel:+97121234567"
                    className="block text-[18px] hover:text-bz-accent"
                  >
                    +971 2 123 4567
                  </a>
                </div>,
                "Mon–Sat 9am–7pm GST",
              ],
              [
                Mail,
                "Email us",
                <a
                  key="e"
                  href="mailto:hello@bazar.ae"
                  className="text-[18px] text-bz-accent"
                >
                  hello@bazar.ae
                </a>,
                "We reply within 2 hours on business days",
              ],
              [
                MapPin,
                "Visit our office",
                <div key="o" className="text-[15px] leading-relaxed">
                  Bazar Real Estate Brokerage LLC
                  <br />
                  Saadiyat Island, Abu Dhabi
                  <br />
                  United Arab Emirates
                </div>,
                null,
              ],
            ].map(([Icon, label, body, note]) => {
              const IconC = Icon as LucideIcon;
              return (
                <div
                  key={label as string}
                  className="flex gap-5 py-6 border-t border-bz-border"
                >
                  <div className="text-bz-accent mt-0.5">
                    <IconC size={20} strokeWidth={1.6} />
                  </div>
                  <div className="flex-1">
                    <div className="eyebrow">{label as string}</div>
                    <div className="mt-2 text-bz-ink">
                      {body as React.ReactNode}
                    </div>
                    {note ? (
                      <div className="text-[12.5px] text-bz-muted mt-1.5">
                        {note as string}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enquiry form */}
          <div className="rounded-lg border border-bz-border bg-bz-surface p-6 md:p-9">
            <div
              className="serif text-[26px]"
              style={{ letterSpacing: "-0.015em" }}
            >
              Send us an enquiry
            </div>
            <p className="text-[14px] text-bz-muted mt-2">
              Tell us what you&apos;re looking for, and our team will get back to
              you shortly.
            </p>
            <div className="mt-6">
              <EnquiryForm source="contact_page" showIntent />
            </div>
            <ContactWhatsAppLink />
          </div>
        </div>
      </section>

      {/* How can we help */}
      <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border bg-bz-surface-2">
        <div className="max-w-[1200px]">
          <SectionHead
            eyebrow="How can we help?"
            title="Choose the service that matches your enquiry."
            sub="We'll connect you with the right member of our team."
            size={44}
            className="mb-9"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {HELP.map(([label, Icon, href]) => (
              <Link
                key={label}
                href={href}
                className="group flex items-center gap-4 rounded-lg border border-bz-border bg-bz-surface p-6 hover:border-bz-ink transition-colors"
              >
                <div className="w-11 h-11 rounded-lg bg-bz-accent-soft text-bz-accent flex items-center justify-center flex-shrink-0">
                  <Icon size={20} strokeWidth={1.6} />
                </div>
                <div className="text-[16px] font-medium flex-1">{label}</div>
                <ArrowRight
                  size={16}
                  strokeWidth={1.7}
                  className="text-bz-muted transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <HqMap />
    </div>
  );
}
