import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { SEED_PRESS } from "@/lib/seeds/press";

export const metadata: Metadata = {
  title: "Press",
  description: "Bazar Real Estate in the press — coverage, interviews, awards.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PressPage() {
  return (
    <div className="bg-bz-bg">
      <section className="px-12 pt-20 pb-14 max-w-[1200px]">
        <Eyebrow>Press</Eyebrow>
        <h1
          className="serif text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Bazar in the press.
        </h1>
        <p className="mt-8 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          Coverage, interviews, and the occasional industry award. For press
          enquiries, write to{" "}
          <a
            href="mailto:press@bazar.ae"
            className="text-bz-ink underline underline-offset-2 hover:text-bz-accent"
          >
            press@bazar.ae
          </a>
          .
        </p>
      </section>

      <section className="px-12 pb-24 max-w-[1100px]">
        <ul className="flex flex-col divide-y divide-bz-border">
          {SEED_PRESS.map((item) => (
            <li key={item.id} className="py-8">
              <div className="grid grid-cols-[160px_1fr] gap-10">
                <div>
                  <div className="mono text-[12px] text-bz-muted">
                    {formatDate(item.date)}
                  </div>
                  <div className="text-[12.5px] uppercase tracking-wider text-bz-accent mt-1">
                    {item.outlet}
                  </div>
                </div>
                <div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-baseline gap-2"
                  >
                    <h2
                      className="serif text-[24px] leading-tight group-hover:text-bz-accent transition-colors"
                      style={{ letterSpacing: "-0.012em" }}
                    >
                      {item.title}
                    </h2>
                    <ExternalLink
                      size={14}
                      strokeWidth={1.7}
                      className="text-bz-muted group-hover:text-bz-accent transition-colors self-center"
                    />
                  </a>
                  <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[68ch]">
                    {item.excerpt}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
