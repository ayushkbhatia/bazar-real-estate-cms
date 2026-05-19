import Link from "next/link";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Marketplace",
    links: [
      { label: "Buy", href: "/buy" },
      { label: "Rent", href: "/rent" },
      { label: "Off-plan", href: "/off-plan" },
      { label: "Commercial", href: "/commercial" },
      { label: "New developments", href: "/developments" },
      { label: "Areas guide", href: "/areas" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "Advisory", href: "/services/buy" },
      { label: "Property management", href: "/services/manage" },
      { label: "Mortgage", href: "/tools/mortgage" },
      { label: "Conveyancing", href: "/services/conveyancing" },
      { label: "Investment", href: "/services/invest" },
      { label: "Valuation", href: "/tools/valuation" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Bazar", href: "/about" },
      { label: "Our team", href: "/agents" },
      { label: "Press", href: "/press" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Market insights", href: "/insights" },
      { label: "Buyer's guide", href: "/insights/category/buyers-guide" },
      { label: "Seller's guide", href: "/insights/category/sellers-guide" },
      { label: "RERA glossary", href: "/insights/category/policy" },
      { label: "Calculator", href: "/tools/mortgage" },
    ],
  },
];

const SOCIAL = ["IG", "LI", "X", "YT"];

export function PublicFooter() {
  return (
    <footer className="bg-bz-ink text-[oklch(0.85_0.005_80)] px-12 pt-16 pb-8">
      <div
        className="grid gap-12 pb-12"
        style={{ gridTemplateColumns: "1.5fr repeat(4, 1fr)" }}
      >
        <div>
          <div className="serif italic text-[28px] text-white leading-none">
            Bazar
          </div>
          <p className="mt-3 text-[13px] leading-[1.6] max-w-[280px] text-[oklch(0.7_0.005_80)]">
            Bespoke real estate advisory for investors and sellers across the
            United Arab Emirates.
          </p>
          <div className="flex gap-2.5 mt-5">
            {SOCIAL.map((s) => (
              <a
                key={s}
                href="#"
                className="w-8 h-8 rounded-full border border-[oklch(0.3_0_0)] flex items-center justify-center text-[10px] tracking-wider hover:border-white hover:text-white transition-colors"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="text-[12px] font-medium text-[oklch(0.7_0.005_80)] uppercase tracking-wider mb-4">
              {col.title}
            </h4>
            <ul className="flex flex-col gap-2.5 text-[13.5px]">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[oklch(0.28_0_0)] pt-6 flex flex-wrap justify-between gap-4 text-[12px] text-[oklch(0.6_0.005_80)]">
        <div>
          © {new Date().getFullYear()} Bazar Real Estate Brokerage LLC · ORN
          28041 · Abu Dhabi, UAE
        </div>
        <div className="flex gap-6">
          <Link href="/legal/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/legal/cookies" className="hover:text-white">
            Cookies
          </Link>
          <Link href="/sitemap.xml" className="hover:text-white">
            Sitemap
          </Link>
        </div>
      </div>
    </footer>
  );
}
