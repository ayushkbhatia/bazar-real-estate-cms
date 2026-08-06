import { PublicMegaNav } from "@/components/brand/public-mega-nav";
import { PublicFooter } from "@/components/brand/public-footer";
import { getPublishedMegamenuHydrated } from "@/lib/queries/megamenu-hydrate";
import { PreferencesPopover } from "./_components/preferences-popover";
import { MobilePreferences } from "./_components/mobile-preferences";
import { ShortlistDrawer } from "./_components/shortlist-drawer";
import { FooterTrust } from "./_components/footer-trust";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const megamenu = await getPublishedMegamenuHydrated();
  return (
    <>
      {/*
        Desktop preferences float as a sibling to the megamenu; the
        mobile equivalent is injected into the hamburger-drawer footer
        via `footerSlot` (the brand nav stays free of app-level imports).
      */}
      <PublicMegaNav data={megamenu} footerSlot={<MobilePreferences />} />
      {/* Gate matches PublicMegaNav's xl breakpoint — below it the drawer
          carries the preferences entry via footerSlot, so an md gate here
          would render both controls at once between 768 and 1279. */}
      {/* The control is fixed, so it floats over whatever the page puts
          underneath it — the home page's video hero, and now the buy/rent
          heroes when a background image is set. Its trigger is a ghost button
          in muted ink, which disappears against any of them. Giving the
          wrapper its own surface makes it legible over every hero without the
          control needing to know what it is sitting on. */}
      <div
        className="hidden xl:flex fixed top-[84px] right-4 z-30 rounded-full
          border border-bz-border bg-bz-surface/90 backdrop-blur-md bz-shadow-1"
      >
        <PreferencesPopover />
      </div>
      <main className="flex-1">{children}</main>
      {/*
        T3-B: floating shortlist drawer.  Self-renders nothing until the
        user has at least one shortlisted property, so the corner stays
        clean for fresh visitors.  Sits bottom-left so it doesn't fight
        with the advisor-contact rail at bottom-right.
      */}
      <ShortlistDrawer />
      {/* T1.5 quick win: single-line trust signal above the global footer.
          Wraps the locked PublicFooter rather than editing it. */}
      <FooterTrust />
      <PublicFooter />
    </>
  );
}
