import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

type Props = {
  eyebrow: string;
  title: string;
  intro: string;
  body: { heading?: string; copy: string }[];
  children?: React.ReactNode;
};

/**
 * Shared layout for /guides/* pages. Body is a list of `{heading, copy}`
 * blocks (rendered as h3 + p) so each guide stays editorial without HTML
 * in the seed. The eligibility checker (or any other interactive widget)
 * lands as `children` below the body.
 */
export function GuideShell({ eyebrow, title, intro, body, children }: Props) {
  return (
    <article className="bg-bz-bg">
      <div className="px-4 md:px-12 pt-10 max-w-[1200px]">
        <Link
          href="/insights"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-ink-2 hover:text-bz-ink transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          All guides &amp; insights
        </Link>
      </div>

      <section className="px-4 md:px-12 pt-8 pb-14 max-w-[1100px]">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1
          className="serif text-[34px] md:text-[64px] mt-3 font-normal leading-[1.0]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {title}
        </h1>
        <p className="mt-6 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          {intro}
        </p>
      </section>

      <section className="px-4 md:px-12 pb-16 max-w-[760px]">
        {body.map((block, i) => (
          <div key={i} className="mt-8 first:mt-0">
            {block.heading ? (
              <h2
                className="serif text-[28px] leading-tight mb-3"
                style={{ letterSpacing: "-0.018em" }}
              >
                {block.heading}
              </h2>
            ) : null}
            <p className="text-[16px] text-bz-ink-2 leading-[1.75]">
              {block.copy}
            </p>
          </div>
        ))}
      </section>

      {children}
    </article>
  );
}
