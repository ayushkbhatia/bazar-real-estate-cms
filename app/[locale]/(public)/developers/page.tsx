import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { str } from "@/lib/master-pages";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";
import { entryLogo, initials, listDirectory } from "./_directory";

export const metadata: Metadata = {
  title: "Developers · Bazar Real Estate",
  description:
    "Direct relationships with the UAE's leading developers give Bazar clients early access to landmark communities, new launches, and off-plan opportunities.",
  alternates: { canonical: "/developers" },
};

export const revalidate = 300;

/** Newlines in the headline become line breaks; the tail renders in italic. */
function heroTitle(
  title: string | null,
  emphasis: string | null,
): React.ReactNode {
  const lines = (title ?? "").split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
      {emphasis ? (
        <>
          {" "}
          <em className="italic">{emphasis}</em>
        </>
      ) : null}
    </>
  );
}

export default async function DevelopersPage() {
  // Section copy and order come from /admin/pages/master/developers. Anything
  // untouched falls back to the literals this page shipped with. The card grid
  // is the code-owned directory merged with the live catalogue, so a developer
  // added in the CMS appears here without an editor step.
  const [content, directory] = await Promise.all([
    getMasterPageContent("developers"),
    listDirectory(),
  ]);
  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const dirV = v("directory");

  const heroEyebrow = str(heroV, "eyebrow");
  const heroSub = str(heroV, "sub");
  const cardCta = str(dirV, "card_cta") ?? "View developments";

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <section key="hero" className="px-4 md:px-12 pt-12 md:pt-20 pb-12">
        {heroEyebrow ? <Eyebrow>{heroEyebrow}</Eyebrow> : null}
        <h1
          className="serif mt-3.5 max-w-[1000px]"
          style={{
            fontSize: fluid(84),
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
          }}
        >
          {heroTitle(
            str(heroV, "title") ?? "The developers\nshaping",
            str(heroV, "title_emphasis"),
          )}
        </h1>
        {heroSub ? (
          <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[680px] leading-relaxed mt-5">
            {heroSub}
          </p>
        ) : null}
      </section>
    ),

    // Our partners — the master directory. Every UAE developer Bazar works
    // with, sorted alphabetically, each linking to its own profile.
    directory: (
      <section
        key="directory"
        className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border bg-bz-surface-2"
      >
        <SectionHead
          eyebrow={str(dirV, "eyebrow") ?? "Our partners"}
          title={
            str(dirV, "heading") ??
            "Working with leading developers across the UAE."
          }
          sub={str(dirV, "body")}
          size={44}
          className="mb-10 md:mb-12"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {directory.map((d) => {
            const logo = entryLogo(d);
            // Trimmed art is optically normalised, so it gets the tight box
            // that bounds both axes — wide wordmarks cap on width, tall
            // lockups on height. Same box as `DeveloperMarquee`, so both
            // developer surfaces normalise identically. Anything else (a
            // padded master canvas, an uploaded file) carries its padding
            // inside the frame and needs a taller box for comparable weight.
            const tight = d.uploaded === null && d.trimmed !== null;
            return (
              <Link
                key={d.slug}
                href={`/developers/${d.slug}`}
                className="group flex flex-col rounded-lg border border-bz-border bg-bz-surface overflow-hidden hover:border-bz-border-strong transition-colors"
              >
                <div className="flex items-center justify-center px-5 min-h-[140px] md:min-h-[152px]">
                  {logo ? (
                    <Image
                      src={logo.src}
                      alt={d.name}
                      width={logo.w}
                      height={logo.h}
                      className={
                        tight
                          ? // `max-w-full` keeps the box inside the card on narrow
                            // two-column viewports, where it is the tighter bound.
                            "w-[132px] h-12 md:w-40 md:h-14 max-w-full object-contain"
                          : "h-20 md:h-24 w-auto max-w-full object-contain"
                      }
                      sizes={
                        tight
                          ? "160px"
                          : "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 240px"
                      }
                    />
                  ) : (
                    // No art at all — initials keep the card the same height as
                    // its neighbours instead of collapsing the row.
                    <span
                      className="serif text-[34px] leading-none text-bz-ink-2"
                      aria-hidden="true"
                    >
                      {initials(d.name)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col flex-1 p-5 border-t border-bz-border">
                  <div
                    className="serif text-[19px] leading-tight"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {d.name}
                  </div>
                  {d.blurb ? (
                    <p className="text-[12px] text-bz-ink-2 leading-snug mt-1.5 flex-1">
                      {d.blurb}
                    </p>
                  ) : (
                    <p className="flex-1" />
                  )}
                  <div className="flex items-center gap-1.5 mt-4 text-[12.5px] font-medium text-bz-accent">
                    {cardCta}
                    <ArrowRight
                      size={13}
                      strokeWidth={1.8}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                </div>
              </Link>
            );
          })}
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
