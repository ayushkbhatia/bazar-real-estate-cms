import { PublicMegaNav } from "@/components/brand/public-mega-nav";
import { PublicFooter } from "@/components/brand/public-footer";
import { getPublishedMegamenuHydrated } from "@/lib/queries/megamenu-hydrate";
import {
  AccountSidebar,
  AccountMobileNav,
} from "./_components/account-sidebar";

/**
 * The account tree shares the public site's megamenu rather than the older
 * PublicNav. PublicNav never collapsed — its link row, wordmark and right
 * cluster gave the header an 819px min-content floor, so every viewport
 * below that scrolled horizontally. PublicMegaNav already carries a
 * hamburger + drawer for the narrow case, so reusing it fixes the overflow
 * and keeps the two trees from drifting apart again.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const megamenu = await getPublishedMegamenuHydrated();
  return (
    <>
      <PublicMegaNav data={megamenu} />
      <AccountMobileNav />
      <div className="flex flex-1">
        <AccountSidebar />
        <main className="flex-1 px-4 py-6 md:px-12 md:py-12 min-w-0">
          {children}
        </main>
      </div>
      <PublicFooter />
    </>
  );
}
