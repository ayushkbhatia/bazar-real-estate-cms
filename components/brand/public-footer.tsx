import { getTranslations } from "next-intl/server";
import Link from "next/link";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "News & Insights", href: "/insights" },
      { label: "Developers", href: "/developers" },
      { label: "Communities", href: "/communities" },
      { label: "New Projects", href: "/off-plan" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "Buy a Property", href: "/buy" },
      { label: "Sell Your Property", href: "/services/sell" },
      { label: "Rent a Property", href: "/rent" },
      { label: "List Your Property", href: "/services/sell" },
      { label: "Property Management", href: "/services/manage" },
      { label: "Mortgage Support", href: "/tools/mortgage" },
    ],
  },
];

// Some communities aren't seeded as guide pages yet — those fall back to the
// communities index rather than 404.
const POPULAR_AREAS: { label: string; href: string }[] = [
  { label: "Hudayriyat Island", href: "/communities" },
  { label: "Al Reem Island", href: "/communities/al-reem-island" },
  { label: "Yas Island", href: "/communities/yas-island" },
  { label: "Saadiyat Island", href: "/communities/saadiyat-island" },
  { label: "Al Raha Beach", href: "/communities/al-raha" },
  { label: "Masdar City", href: "/communities/masdar-city" },
  { label: "Al Ghadeer", href: "/communities" },
  { label: "Zayed City", href: "/communities" },
];

const SOCIAL: { label: string; href: string }[] = [
  { label: "Facebook", href: "https://www.facebook.com/bazarrealestateae" },
  { label: "Instagram", href: "https://www.instagram.com/bazarrealestate" },
  { label: "TikTok", href: "https://www.tiktok.com/@bazarrealestate" },
  { label: "YouTube", href: "https://www.youtube.com/@bazarrealestateae" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/bazarrealestate",
  },
];

export async function PublicFooter() {
  /*
   * Ambient locale, not a prop. The root layout calls `setRequestLocale`
   * before this renders, so the read is cached rather than a dynamic API —
   * and `npm run check:routes` is what proves that rather than this comment.
   */
  const t = await getTranslations("footer");
  return (
    <footer className="bg-bz-ink text-[oklch(0.85_0.005_80)] px-4 md:px-12 pt-14 md:pt-16 pb-8">
      <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)_1.15fr] md:gap-12 pb-12">
        {/* Brand + socials */}
        <div className="col-span-2 md:col-span-1">
          <div className="serif italic text-[28px] text-white leading-none">
            Bazar
          </div>
          <p className="mt-3 max-w-[280px] text-[13px] leading-[1.6] text-[oklch(0.7_0.005_80)]">
            Bazar Real Estate is a leading UAE real estate agency, serving the
            property market with expertise since 2005.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[oklch(0.3_0_0)] px-3 py-1.5 text-[11.5px] text-[oklch(0.8_0.005_80)] transition-colors hover:border-bz-teal hover:text-white"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 text-[12px] font-medium uppercase tracking-wider text-bz-taupe">
              {col.title}
            </h4>
            <ul className="flex flex-col gap-2.5 text-[13.5px]">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Popular areas */}
        <div>
          <h4 className="mb-4 text-[12px] font-medium uppercase tracking-wider text-bz-taupe">
            Popular areas
          </h4>
          <ul className="flex flex-col gap-2.5 text-[13.5px]">
            {POPULAR_AREAS.map((a) => (
              <li key={a.label}>
                <Link
                  href={a.href}
                  className="transition-colors hover:text-white"
                >
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="col-span-2 md:col-span-1">
          <h4 className="mb-4 text-[12px] font-medium uppercase tracking-wider text-bz-taupe">
            Contact
          </h4>
          <ul className="flex flex-col gap-4 text-[13.5px]">
            <li>
              <div className="text-[11.5px] text-[oklch(0.6_0.005_80)]">
                Phone / WhatsApp
              </div>
              <a
                href="tel:+97126322223"
                className="block text-white hover:underline"
              >
                +971 2 632 2223
              </a>
              <a
                href="tel:+971506911103"
                className="block text-white hover:underline"
              >
                +971 50 691 1103
              </a>
            </li>
            <li>
              <div className="text-[11.5px] text-[oklch(0.6_0.005_80)]">
                Email
              </div>
              <a
                href="mailto:info@bazarrealestate.ae"
                className="text-white hover:underline"
              >
                info@bazarrealestate.ae
              </a>
            </li>
            <li>
              <div className="text-[11.5px] text-[oklch(0.6_0.005_80)]">
                Office location
              </div>
              <div className="leading-[1.55]">
                Sheikha Salama Building, Office 4
                <br />
                Zayed The First Street, Al Bateen
                <br />
                Abu Dhabi, United Arab Emirates
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-4 border-t border-[oklch(0.28_0_0)] pt-6 text-[12px] text-[oklch(0.6_0.005_80)]">
        <div>{t("rights")}</div>
        <div className="flex gap-6">
          <Link href="/legal/privacy" className="hover:text-white">
            {t("privacy")}
          </Link>
          <Link href="/legal/terms" className="hover:text-white">
            {t("terms")}
          </Link>
          <Link href="/legal/cookies" className="hover:text-white">
            {t("cookies")}
          </Link>
          <Link href="/sitemap.xml" className="hover:text-white">
            {t("sitemap")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
