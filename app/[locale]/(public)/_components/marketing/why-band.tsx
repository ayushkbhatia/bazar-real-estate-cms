import { useTranslations } from "next-intl";
import { Eyebrow } from "@/components/brand/eyebrow";
import { fluid } from "./fluid";

type Props = {
  eyebrow?: string;
  title: React.ReactNode;
  body: React.ReactNode;
  /** [value, label][] — rendered as a stat grid on the right. */
  stats?: [string, string][];
  /** Let the content span the full section width (no 1200px cap). */
  wide?: boolean;
};

/**
 * Dark "Why Bazar" closing band — ink background, serif statement, optional
 * stat grid. Full-bleed; used at most once or twice per page (the handoff's
 * `WhyBand`).
 */
export function WhyBand({
  eyebrow,
  title,
  body,
  stats,
  wide,
}: Props) {
  /*
   * `useTranslations`, not `getTranslations`, and the key lives on `common`.
   *
   * This is a Page Builder block (`why_band`) and `render.test.tsx` renders
   * every block through React Testing Library, which cannot render an async
   * component — the same constraint `who-we-are.tsx` documents. `common` is on
   * CLIENT_NAMESPACES, so the key crosses into that render.
   *
   * The default used to be the literal "Why Bazar". Three callers pass an
   * eyebrow from the CMS; `BuyRentLanding` passes none, so /buy, /rent and
   * /commercial rendered the English default under `lang="ar"`.
   */
  const t = useTranslations("common");
  const cap = wide ? "" : " max-w-[1200px]";
  return (
    <section className="bg-bz-navy text-white px-4 md:px-12 py-16 md:py-20">
      <div
        className={
          stats
            ? "grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12 lg:gap-20 items-center" +
              cap
            : cap.trim()
        }
      >
        <div>
          <Eyebrow className="text-bz-taupe-light">
            {eyebrow ?? t("whyBazar")}
          </Eyebrow>
          <h2
            className="serif text-white mt-4 max-w-[720px]"
            style={{
              fontSize: fluid(44),
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            {title}
          </h2>
          <p className="text-[15px] md:text-[16px] leading-[1.7] mt-5 max-w-[640px] text-white/75">
            {body}
          </p>
        </div>
        {stats ? (
          <div className="grid grid-cols-2 gap-8">
            {stats.map(([v, l]) => (
              <div key={l} className="border-t border-white/25 pt-5">
                <div
                  className="serif text-white"
                  style={{ fontSize: fluid(48), letterSpacing: "-0.02em" }}
                >
                  {v}
                </div>
                <div className="text-[12.5px] text-white/70 mt-1.5">{l}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
