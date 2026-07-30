import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mediaPublicUrl } from "@/lib/media";
import { isSupabaseConfigured } from "@/lib/env";
import { currentUserIsAdmin, getStaffAuthMeta } from "@/lib/queries/staff";
import { AgentEditForm } from "./_form";
import { AgentAccessCard } from "./_access-card";
import { sendStaffPasswordLink } from "../_actions";

/** Portraits offered by the photo picker — the library's image assets. */
async function fetchPhotoOptions() {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("media_assets")
    .select("id, filename, storage_key, mime_type")
    .is("deleted_at", null)
    .like("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((m) => ({
    id: m.id,
    filename: m.filename,
    url: mediaPublicUrl(m.storage_key),
  }));
}

export default async function AdminAgentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/admin");
  if (!(await currentUserIsAdmin())) redirect("/admin?error=admins_only");
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff")
    .select(
      "user_id, display_name, slug, title, brn, bio, photo_url, languages, specialties, credentials, role, status",
    )
    .eq("user_id", id)
    .maybeSingle();

  if (error || !data) notFound();

  const [photoOptions, authMeta] = await Promise.all([
    fetchPhotoOptions(),
    getStaffAuthMeta(data.user_id),
  ]);

  const initial = {
    display_name: data.display_name,
    slug: data.slug,
    title: data.title ?? "",
    brn: data.brn ?? "",
    bio: data.bio ?? "",
    photo_url: data.photo_url ?? "",
    languages: Array.isArray(data.languages) ? (data.languages as string[]) : [],
    specialties: data.specialties ?? [],
    credentials: data.credentials ?? [],
  };

  return (
    <CmsShell
      title={data.display_name}
      breadcrumbs={
        <Link
          href="/admin/agents"
          className="inline-flex items-center gap-1 hover:text-bz-ink-2"
        >
          <ArrowLeft size={11} strokeWidth={1.8} />
          Agents
        </Link>
      }
      primary={
        <Button asChild variant="outline" size="sm">
          <Link
            href={`/agents/${data.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={13} strokeWidth={1.7} />
            View public profile
          </Link>
        </Button>
      }
    >
      <div className="max-w-[820px]">
        <div className="flex items-center gap-3 text-[12px] text-bz-muted">
          <span className="uppercase tracking-wider">Role</span>
          <span className="text-bz-ink-2 capitalize">{data.role}</span>
          <span>·</span>
          <span className="uppercase tracking-wider">Status</span>
          <span className="text-bz-ink-2 capitalize">{data.status}</span>
        </div>

        <Eyebrow className="mt-6">Profile</Eyebrow>
        <h2
          className="serif text-[28px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.012em" }}
        >
          Edit advisor profile.
        </h2>
        <p className="mt-3 text-[13.5px] text-bz-muted max-w-[60ch]">
          These fields appear on the public agent profile at{" "}
          <span className="mono">/agents/{data.slug}</span> and on listings this
          advisor is assigned to.
        </p>

        <div className="mt-8">
          <AgentAccessCard
            userId={data.user_id}
            email={authMeta?.email ?? null}
            lastSignInAt={authMeta?.last_sign_in_at ?? null}
            displayName={data.display_name}
            suspended={data.status === "suspended"}
            // By reference — see the note on the prop.
            sendLink={sendStaffPasswordLink}
          />
        </div>

        <div className="mt-10">
          <AgentEditForm photoOptions={photoOptions} userId={data.user_id} initial={initial} />
        </div>
      </div>
    </CmsShell>
  );
}
