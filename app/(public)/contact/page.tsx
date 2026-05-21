import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { EnquiryForm } from "../_components/enquiry-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to a Bazar advisor. We respond within 2 hours during business hours and by next morning otherwise.",
};

export default function ContactPage() {
  return (
    <div className="px-12 py-16">
      <div className="grid lg:grid-cols-[1fr_520px] gap-16 max-w-[1300px] mx-auto">
        <section>
          <Eyebrow>Contact</Eyebrow>
          <h1
            className="serif text-[64px] font-normal mt-2 leading-[1.05] max-w-[14ch]"
            style={{ letterSpacing: "-0.025em" }}
          >
            Tell us what you&apos;re looking for.
          </h1>
          <p className="mt-5 text-[15px] text-bz-muted max-w-[55ch] leading-relaxed">
            One brief, one advisor. We&apos;ll come back within 2 hours during
            business hours, and by next morning otherwise.
          </p>

          <ul className="mt-10 flex flex-col gap-5 text-[14px]">
            <li className="flex gap-3 items-start">
              <MapPin
                size={16}
                strokeWidth={1.6}
                className="text-bz-muted mt-0.5 flex-shrink-0"
              />
              <div>
                <div className="text-bz-muted text-[11.5px] uppercase tracking-wider mb-0.5">
                  Office
                </div>
                <div className="text-bz-ink">
                  Bazar Real Estate Brokerage LLC<br />
                  Saadiyat Island, Abu Dhabi
                </div>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <Phone
                size={16}
                strokeWidth={1.6}
                className="text-bz-muted mt-0.5 flex-shrink-0"
              />
              <div>
                <div className="text-bz-muted text-[11.5px] uppercase tracking-wider mb-0.5">
                  Phone
                </div>
                <a
                  href="tel:+97121234567"
                  className="text-bz-ink hover:text-bz-accent"
                >
                  +971 2 123 4567
                </a>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <Mail
                size={16}
                strokeWidth={1.6}
                className="text-bz-muted mt-0.5 flex-shrink-0"
              />
              <div>
                <div className="text-bz-muted text-[11.5px] uppercase tracking-wider mb-0.5">
                  Email
                </div>
                <a
                  href="mailto:hello@bazar.ae"
                  className="text-bz-ink hover:text-bz-accent"
                >
                  hello@bazar.ae
                </a>
              </div>
            </li>
          </ul>
        </section>

        <aside>
          <div className="bg-bz-surface border border-bz-border rounded-lg p-6">
            <h2
              className="serif text-[22px] mb-4"
              style={{ letterSpacing: "-0.01em" }}
            >
              Send a brief
            </h2>
            <EnquiryForm source="contact_page" showIntent />
          </div>
        </aside>
      </div>
    </div>
  );
}
