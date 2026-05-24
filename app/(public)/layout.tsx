import { PublicMegaNav } from "@/components/brand/public-mega-nav";
import { PublicFooter } from "@/components/brand/public-footer";
import { getPublishedMegamenu } from "@/lib/queries/megamenu";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const megamenu = await getPublishedMegamenu();
  return (
    <>
      <PublicMegaNav data={megamenu} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </>
  );
}
