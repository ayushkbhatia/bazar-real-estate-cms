import { PublicMegaNav } from "@/components/brand/public-mega-nav";
import { PublicFooter } from "@/components/brand/public-footer";
import { getPublishedMegamenuHydrated } from "@/lib/queries/megamenu-hydrate";
import { listFloatingCtas } from "@/lib/queries/floating-ctas";
import {
  getPublicBranding,
  getPublicUnitLabels,
} from "@/lib/queries/site-settings";
import { getPublicFooter } from "@/lib/queries/footer";
import { getHeaderCta } from "@/lib/queries/header-cta";
import { getShortlistCopy } from "@/lib/queries/content-sections";
import { asLocale } from "@/lib/i18n/locales";
import { getAdvisorWhatsAppNumber } from "@/lib/whatsapp";
import { UnitLabelsProvider } from "@/lib/preferences";
import { PreferencesPopover } from "./_components/preferences-popover";
import { LocaleToggle } from "./_components/locale-toggle";
import { MobilePreferences } from "./_components/mobile-preferences";
import { ShortlistDrawer } from "./_components/shortlist-drawer";
import { FooterTrust } from "./_components/footer-trust";
import { FloatingCtaProvider } from "./_components/floating-cta-context";
import { FloatingCtaRail } from "./_components/floating-cta-rail";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Threaded explicitly rather than read from the request. Layouts render
  // before the pages beneath them, so an ambient read here runs before any
  // page can call setRequestLocale — which drops the whole subtree to
  // on-demand rendering. assert-static-routes.mjs caught exactly that on
  // /legal, a page whose entire body is a redirect.
  const { locale } = await params;
  const active = asLocale(locale);
  const [
    megamenu,
    floatingCtas,
    branding,
    footer,
    shortlistCopy,
    unitLabels,
    headerCta,
  ] = await Promise.all([
    getPublishedMegamenuHydrated(active),
    listFloatingCtas(),
    getPublicBranding(active),
    // Same contract as the megamenu above: the locale is threaded in rather
    // than read ambiently, so the layout does not force its subtree dynamic.
    getPublicFooter(active),
    // The shortlist card is a client component and cannot read its own
    // document, so its copy is resolved here and handed down. Same
    // cookie-free public client as the four above, so it costs a round trip
    // and not the subtree's render mode.
    getShortlistCopy(active),
    // The words every price and every area on the site is written with —
    // "AED", "ft²", and their Arabic equivalents. Same cookie-free public
    // client as the five above, and the same reason it is resolved here: the
    // components that render them are client components scattered across the
    // marketplace, and none of them can read a settings row of its own.
    getPublicUnitLabels(active),
    // The header's CTA button. Same contract as the six above: the locale
    // is threaded in rather than read ambiently, so the layout does not
    // force its subtree dynamic. The nav is a client component and cannot
    // read its own document, so the two labels and the href are resolved
    // here and handed down — the same reason `getShortlistCopy` is here.
    getHeaderCta(active),
  ]);
  // Resolved here rather than inside the nav so the brand component stays a
  // presentational client component with no data dependency of its own.
  const logo = branding.logo_url
    ? {
        url: branding.logo_url,
        style: branding.logo_style,
        name: branding.brand_name,
      }
    : null;
  // The footer has its own file — the surface is ink, so the artwork that
  // works there is normally the reversed variant of the top bar's. No
  // fallback to `logo_url`: a dark lockup dropped onto the dark footer would
  // read as a missing image, where the typeset wordmark always reads.
  const footerLogo = branding.footer_logo_url
    ? { url: branding.footer_logo_url, name: branding.brand_name }
    : null;
  return (
    // The provider wraps `children` as well as the rail: a detail page deep in
    // the tree publishes its advisor upward through it, which is how one
    // site-wide rail still routes to the person handling that listing.
    <UnitLabelsProvider labels={unitLabels}>
      <FloatingCtaProvider>
        {/*
        Desktop preferences float as a sibling to the megamenu; the
        mobile equivalent is injected into the hamburger-drawer footer
        via `footerSlot` (the brand nav stays free of app-level imports).
      */}
        <PublicMegaNav
          data={megamenu}
          logo={logo}
          footerSlot={<MobilePreferences />}
          cta={headerCta}
        />
        {/*
        The header chrome that could not go in the header.

        `PublicMegaNav` takes exactly one render slot — `footerSlot`, and only
        the mobile drawer renders it — so anything else has to compose
        alongside the bar rather than inside it. (`cta` above is not a
        counter-example: it is resolved copy the nav draws itself, not a
        subtree handed in.) That is the same reason `FooterTrust`
        wraps `PublicFooter` instead of editing it.

        Position is measured, not guessed. The bar is 72px and the inline-end
        is occupied at EVERY breakpoint: the xl+ CTA sits at end-12, and below
        xl the `ms-auto` cluster (List + hamburger) takes the same edge and
        flips to the physical left under `dir="rtl"`. The free middle only
        exists between md and xl. So there is no horizontal slot inside the bar
        that is safe at all widths, and this sits just under it instead.

        z-25, in the gap deliberately left between the megamenu panel's z-30
        and the sticky search chrome's z-20.

        Below the panel: it docks at top-[72px] and would otherwise be
        overlapped by a control floating at 84. The preferences pill has had
        that bug quietly since it shipped — it was hard to notice while the
        pill was the only thing there.

        Above the search chrome, which is the half that used to be wrong. This
        was z-20 too, and the filter bar and the development sub-nav both moved
        onto `top-[var(--bz-header-h)]` (72px) in Phase 3 — so they occupy the
        exact band this floats in. Equal z-index is settled by tree order and
        this div is a sibling BEFORE `<main>`, so the opaque bar won every
        time: measured on /buy/search at 1440 after a 900px scroll,
        `elementFromPoint` at the pill's own centre returned the filter bar's
        row, not the pill. The control was painted, inert, and had been on all
        six search routes and every development page — on DESKTOP, where it was
        never gated. Hiding it below xl never addressed that; it only removed
        the evidence from phones.

        Stacking above the bar is only half the fix, because whatever the pill
        covers becomes unreachable in turn — and on mobile that is the Filters
        button, the only route into the filter sheet. The bars reserve
        `--bz-locale-pill-gutter` at their inline end so nothing lands under
        it. Both halves are required; either alone just moves the dead control.
      */}
        <div className="fixed top-[84px] end-4 z-[25] flex items-center gap-2">
          {/*
          Ungated, unlike the preferences pill beside it.

          It carried `hidden xl:flex` for one release. The reasoning was that
          `mobile-preferences.tsx` renders a real `LanguageSwitch` in the
          drawer, so below xl this was the second locale control rather than
          the only one, and the second one was the one colliding with the
          search chrome.

          Both halves of that were wrong. The collision was never a mobile
          problem — see the z-index note above; it was measured on desktop at
          1440, where this pill has never been gated. And the drawer control is
          not an equivalent: it is three taps deep, behind a hamburger and then
          a row labelled "Currency & units", which is a label that says nothing
          about language to the one visitor who cannot read the rest of the
          page. `locale-toggle.tsx` opens by explaining that this is exactly
          what it exists to prevent.

          So language is one tap again at every width, and the collision is
          fixed where it lives — in the stacking order and in the bars' own
          inline-end gutter — rather than by removing the control from the
          viewports that were not causing it.

          Preferences stays at xl: currency and area unit are refinements of
          something already legible, and the drawer's "Currency & units" row is
          an honest label for them.
        */}
          <LocaleToggle current={active} />
          {/* Gate matches PublicMegaNav's xl breakpoint — below it the drawer
            carries the preferences entry via footerSlot, so an md gate here
            would render both controls at once between 768 and 1279. */}
          <div className="hidden xl:flex">
            <PreferencesPopover />
          </div>
        </div>
        <main className="flex-1">{children}</main>
        {/*
        T3-B: floating shortlist drawer.  Self-renders nothing until the
        user has at least one shortlisted property, so the corner stays
        clean for fresh visitors.  Sits bottom-left so it doesn't fight
        with the floating CTA rail at bottom-right.
      */}
        <ShortlistDrawer copy={shortlistCopy} />
        {/* Floating contact CTAs, from `floating_ctas` (see
          /admin/floating-ctas). Mounted here rather than per page so
          WhatsApp floats site-wide; the rail itself decides which buttons
          a given page earns. The env number is resolved server-side so the
          client component never reaches into `lib/env`. */}
        <FloatingCtaRail
          ctas={floatingCtas}
          fallbackPhone={getAdvisorWhatsAppNumber()}
        />
        {/* T1.5 quick win: single-line trust signal above the global footer.
          Reads the same `footer_settings.legal_line` the footer's own bottom
          bar does, so the two can no longer drift apart. */}
        <FooterTrust legalLine={footer.settings.legal_line} />
        <PublicFooter data={footer} logo={footerLogo} />
      </FloatingCtaProvider>
    </UnitLabelsProvider>
  );
}
