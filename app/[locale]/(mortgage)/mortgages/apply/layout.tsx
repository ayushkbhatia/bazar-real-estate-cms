import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { callerIsStaff, readFlag } from "@/lib/mortgage-requests/server/http";

export const dynamic = "force-dynamic";

/**
 * The application (W1–W7) is behind the `mortgage_requests` flag (SPEC §4.1;
 * `mortgage_settings.flag`): off, every step is a 404; staff, only signed-in
 * staff see it; public, everyone. Read per request, so flipping it in the CMS
 * needs no deploy.
 */
async function flowOpen(): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const flag = await readFlag(db);
  if (flag === "public") return true;
  return flag === "staff" && (await callerIsStaff(db));
}

export default async function ApplyLayout({ children }: { children: React.ReactNode }) {
  if (!(await flowOpen())) notFound();
  return children;
}
