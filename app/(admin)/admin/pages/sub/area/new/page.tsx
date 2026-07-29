import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { AreaKind } from "@/lib/schemas/area";
import { NewAreaForm } from "./_form";

export const dynamic = "force-dynamic";

async function fetchParents() {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("areas")
    .select("id, name, kind")
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as { id: string; name: string; kind: AreaKind }[];
}

export default async function NewAreaPage() {
  const parents = await fetchParents();

  return (
    <CmsShell
      title="Add area"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/sub" className="hover:text-bz-ink">
            Sub-pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/sub/area" className="hover:text-bz-ink">
            Areas
          </Link>
          <ChevronRight size={11} />
          <span>New</span>
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-bz-ink-2 max-w-[70ch] leading-relaxed">
          Creates a community guide at{" "}
          <span className="mono">/areas/&lt;link&gt;</span> using the standard
          template. Listings, schools and market data attach themselves to the
          area once it exists.
        </p>
        <NewAreaForm parents={parents} />
      </div>
    </CmsShell>
  );
}
