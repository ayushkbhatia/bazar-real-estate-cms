import { PublicNav } from "@/components/brand/public-nav";
import { PublicFooter } from "@/components/brand/public-footer";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicNav />
      <main className="flex-1 px-12 py-12">{children}</main>
      <PublicFooter />
    </>
  );
}
