import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import type { MediaOption } from "../../../master/[key]/_editor";
import { NewDevelopmentPageForm } from "./_form";

export const dynamic = "force-dynamic";

async function fetchOptions() {
  if (!isSupabaseConfigured)
    return { developers: [], areas: [], media: [] as MediaOption[] };
  const supabase = await createSupabaseServerClient();
  const [developers, areas, media] = await Promise.all([
    supabase.from("developers").select("id, name").order("name"),
    supabase.from("areas").select("id, name").order("name"),
    supabase
      .from("media_assets")
      .select("id, filename, storage_key, mime_type")
      .is("deleted_at", null)
      .like("mime_type", "image/%")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  return {
    developers: developers.data ?? [],
    areas: areas.data ?? [],
    media: (media.data ?? []).map((m) => ({
      id: m.id,
      filename: m.filename,
      url: mediaPublicUrl(m.storage_key),
    })),
  };
}

export default async function NewDevelopmentPage() {
  const { developers, areas, media } = await fetchOptions();

  return (
    <CmsShell
      title="Add development page"
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
          <span>New</span>
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-bz-ink-2 max-w-[70ch] leading-relaxed">
          Creates a project page at{" "}
          <span className="mono">/developments/&lt;link&gt;</span> using the
          standard template. You&apos;ll land on its editor next, where you can
          switch sections on and off and set the copy. Units, floor plans and
          payment plans are added on the development record.
        </p>
        <NewDevelopmentPageForm
          developers={developers}
          areas={areas}
          media={media}
        />
      </div>
    </CmsShell>
  );
}
