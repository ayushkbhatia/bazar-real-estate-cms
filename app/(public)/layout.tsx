import { PublicNav } from "@/components/brand/public-nav";
import { PublicFooter } from "@/components/brand/public-footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicNav />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </>
  );
}
