import { redirect } from "next/navigation";
import { CmsShell } from "@/components/brand/cms-shell";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import { SettingsTabs } from "./_components/settings-tabs";

export const dynamic = "force-dynamic";

export default async function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentUserIsAdmin())) {
    redirect("/admin?error=admins_only");
  }
  return (
    <CmsShell title="Site settings" breadcrumbs="Admin">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-stretch lg:items-start">
        <SettingsTabs />
        <div className="flex-1 min-w-0 max-w-[920px]">{children}</div>
      </div>
    </CmsShell>
  );
}
