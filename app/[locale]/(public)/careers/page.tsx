import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { SEED_CAREERS } from "@/lib/seeds/careers";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Open advisor and operations roles at Bazar Real Estate. We hire slowly and by exception.",
};

function formatPosted(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function CareersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The locale is passed explicitly. Without it `getTranslations` falls
  // through to `headers()`, which makes the route dynamic and silently
  // discards its revalidate — the failure `check:routes` exists to catch.
  const t = await getTranslations({
    locale: (await params).locale,
    namespace: "pages.careers",
  });
  return (
    <div className="bg-bz-bg">
      {/* Hero */}
      <section className="px-4 md:px-12 pt-20 pb-14 max-w-[1200px]">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1
          className="serif text-[40px] md:text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          {t("title")}
        </h1>
        <p className="mt-8 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          {t("intro")}{" "}
          <a
            href="mailto:careers@bazar.ae"
            className="text-bz-ink underline underline-offset-2 hover:text-bz-accent"
          >
            careers@bazar.ae
          </a>
          .
        </p>
      </section>

      {/* Why */}
      <section className="border-y border-bz-border bg-bz-surface">
        {/* Stacked below sm: three columns inside a bare `px-12` measured a
            67px minimum track at 390px — the narrowest thing on the site after
            /developments. Widening the gutter alone only takes it to ~87px,
            which is still a column too narrow to hold a sentence. */}
        <div className="px-4 md:px-12 py-12 max-w-[1200px] grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
          <div>
            <div className="text-[11.5px] uppercase tracking-wider text-bz-accent">
              {t("why1Label")}
            </div>
            <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">
              {t("why1Body")}
            </p>
          </div>
          <div>
            <div className="text-[11.5px] uppercase tracking-wider text-bz-accent">
              {t("why2Label")}
            </div>
            <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">
              {t("why2Body")}
            </p>
          </div>
          <div>
            <div className="text-[11.5px] uppercase tracking-wider text-bz-accent">
              {t("why3Label")}
            </div>
            <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">
              {t("why3Body")}
            </p>
          </div>
        </div>
      </section>

      {/* Open roles */}
      <section className="px-4 md:px-12 py-20 max-w-[1200px]">
        <Eyebrow>{t("openRoles")}</Eyebrow>
        <h2
          // Stepped with the h1 above, not independently. That h1 is
          // `text-[40px] md:text-[80px]`, so leaving this at a flat 44px made
          // the section heading LARGER than the page title on a phone — the
          // hierarchy inverted at exactly the width where there is least room
          // to signal it. 30px holds the same ratio to 40px that 44px holds to
          // 80px, near enough.
          className="serif text-[30px] md:text-[44px] mt-3 leading-[1.05]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {t("positionsOpen", { count: SEED_CAREERS.length })}
        </h2>

        <ul className="mt-12 flex flex-col gap-10">
          {SEED_CAREERS.map((role) => (
            <li
              key={role.id}
              className="rounded-lg border border-bz-border bg-bz-surface p-8"
            >
              <div className="flex items-baseline justify-between gap-6 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 text-[12px] text-bz-muted">
                    <span className="uppercase tracking-wider text-bz-accent">
                      {role.team}
                    </span>
                    <span>·</span>
                    <span>{role.type}</span>
                    <span>·</span>
                    <span className="mono">
                      {t("posted", { date: formatPosted(role.posted) })}
                    </span>
                  </div>
                  <h3
                    className="serif text-[28px] mt-3 leading-tight"
                    style={{ letterSpacing: "-0.014em" }}
                  >
                    {role.title}
                  </h3>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-bz-ink-2">
                    <MapPin size={13} strokeWidth={1.7} />
                    {role.location}
                  </div>
                </div>
                <Button asChild>
                  <a
                    href={`mailto:${role.apply_email}?subject=${encodeURIComponent(t("applySubject", { title: role.title }))}`}
                  >
                    {t("apply")}
                  </a>
                </Button>
              </div>

              <p className="mt-6 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[68ch]">
                {role.intro}
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10">
                <div>
                  <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                    {t("youWill")}
                  </div>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {role.responsibilities.map((r) => (
                      <li
                        key={r}
                        className="text-[13.5px] text-bz-ink leading-relaxed"
                      >
                        · {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                    {t("youBring")}
                  </div>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {role.requirements.map((r) => (
                      <li
                        key={r}
                        className="text-[13.5px] text-bz-ink leading-relaxed"
                      >
                        · {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
