import { PublicNav } from "@/components/brand/public-nav";
import { PublicFooter } from "@/components/brand/public-footer";
import { AccountSidebar } from "./_components/account-sidebar";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicNav />
      <div className="flex flex-1">
        <AccountSidebar />
        <main className="flex-1 px-12 py-12 min-w-0">{children}</main>
      </div>
      <PublicFooter />
    </>
  );
}
