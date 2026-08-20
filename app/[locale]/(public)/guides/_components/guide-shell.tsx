import Link from "@/components/i18n/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Check } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

export type GuideBlock = {
  heading?: string;
  copy?: string;
  /** Plain bullet list rendered under the copy. */
  bullets?: string[];
  /** Checklist (green ticks) rendered under the copy. */
  checklist?: string[];
};

type Props = {
  eyebrow: string;
  title: string;
  intro: string;
  body: GuideBlock[];
  /**
   * Threaded from the page rather than read ambiently.
   *
   * Every string the *pages* pass in is already resolved; the only message
   * this component owns is the back-link. An ambient `getTranslations()` for
   * one label would resolve through `headers()` and take all eleven guide
   * routes dynamic.
   */
  locale: string;
  children?: React.ReactNode;
};

/**
 * Shared layout for /guides/* pages. Body is a list of blocks (rendered as
 * h2 + p, with optional bullet/checklist lists) so each guide stays editorial
 * without HTML in the seed. An interactive widget (e.g. eligibility checker)
 * lands as `children` below the body.
 */
export async function GuideShell({
  eyebrow,
  title,
  intro,
  body,
  locale,
  children,
}: Props) {
  const t = await getTranslations({ locale, namespace: "guides" });
  return (
    <article className="bg-bz-bg">
      <div className="px-4 md:px-12 pt-10 max-w-[1200px]">
        <Link
          href="/insights"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-ink-2 hover:text-bz-ink transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          {t("backToInsights")}
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
            {block.copy ? (
              <p className="text-[16px] text-bz-ink-2 leading-[1.75]">
                {block.copy}
              </p>
            ) : null}
            {block.bullets ? (
              <ul className="mt-3 flex flex-col gap-2.5">
                {block.bullets.map((b, j) => (
                  <li
                    key={j}
                    className="flex gap-3 text-[15.5px] text-bz-ink leading-[1.55]"
                  >
                    <span
                      className="mt-2 h-[5px] w-[5px] rounded-full bg-bz-taupe shrink-0"
                      aria-hidden
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {block.checklist ? (
              <ul className="mt-3 flex flex-col gap-2.5">
                {block.checklist.map((c, j) => (
                  <li
                    key={j}
                    className="flex gap-3 text-[15.5px] text-bz-ink leading-[1.55]"
                  >
                    <Check
                      size={16}
                      strokeWidth={2}
                      className="text-bz-taupe mt-0.5 shrink-0"
                    />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </section>

      {children}
    </article>
  );
}
