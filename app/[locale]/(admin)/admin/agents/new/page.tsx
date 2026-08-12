import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Eyebrow } from "@/components/brand/eyebrow";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import { InviteAgentForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  if (!(await currentUserIsAdmin())) redirect("/admin?error=admins_only");

  return (
    <CmsShell
      title="Invite advisor"
      breadcrumbs={
        <Link
          href="/admin/agents"
          className="inline-flex items-center gap-1 hover:text-bz-ink-2"
        >
          <ArrowLeft size={11} strokeWidth={1.8} />
          Agents
        </Link>
      }
    >
      <div className="max-w-[720px]">
        <Eyebrow>Onboarding</Eyebrow>
        <h2
          className="serif text-[28px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.012em" }}
        >
          Send a staff invitation.
        </h2>
        <p className="mt-3 text-[13.5px] text-bz-muted max-w-[60ch]">
          Bazar caps senior advisor headcount at twelve — review carefully.
          The invitee receives a magic-link email and lands on a profile
          completion flow when they first sign in.
        </p>

        <div className="mt-10">
          <InviteAgentForm />
        </div>
      </div>
    </CmsShell>
  );
}
