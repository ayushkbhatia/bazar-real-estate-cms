import { PublicMegaNav } from "@/components/brand/public-mega-nav";
import { PublicFooter } from "@/components/brand/public-footer";
import { getPublishedMegamenu } from "@/lib/queries/megamenu";
import { PreferencesPopover } from "./_components/preferences-popover";
import { ShortlistDrawer } from "./_components/shortlist-drawer";
import { FooterTrust } from "./_components/footer-trust";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const megamenu = await getPublishedMegamenu();
  return (
    <>
      <PublicMegaNav data={megamenu} />
      {/*
        Preferences popover floats as a sibling to the megamenu (rather than
        wrapping it) — the megamenu is a locked brand component and editing
        it in place is out of scope. Desktop-only for Phase 1; mobile users
        will get a parallel surface inside the hamburger drawer in a
        follow-up (also locked at the moment).
      */}
      <div className="hidden md:flex fixed top-[84px] right-4 z-30">
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
