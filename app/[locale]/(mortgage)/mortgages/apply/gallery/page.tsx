import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { callerIsStaff } from "@/lib/mortgage-requests/server/http";
import { DocumentsGallery } from "../_steps/documents-gallery";

/**
 * W6's designed state, drawn from fixtures (docs/mortgage/IMPLEMENTATION.md
 * §1.14 "Design comparison"): every upload row state at once — added,
 * uploading at 64%, the oversize licence, three statements — which the live
 * flow only passes through for a moment. For comparing against the PNG.
 *
 * Off the production deployment unless the visitor is signed-in staff; never
 * linked from anywhere.
 */
export default async function DocumentsGalleryPage() {
  if (env.VERCEL_ENV === "production") {
    const db = createAdminClient();
    if (!db || !(await callerIsStaff(db))) notFound();
  }
  return <DocumentsGallery />;
}
