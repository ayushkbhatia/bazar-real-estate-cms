import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Eyebrow } from "@/components/brand/eyebrow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { env } from "@/lib/env";
import { CopyButton } from "./_copy-button";

export const metadata: Metadata = {
  title: "Referrals",
  description:
    "Invite a friend to engage Bazar — you both earn an AED credit when the engagement closes.",
};

/**
 * Until Sprint 8 lands the `referrals` table, derive a deterministic code
 * from the user's auth UID. Sprint 9 will swap to a real `referrals` row
 * lookup with status + payout columns.
 */
function deriveCodeFromUserId(userId: string): string {
  const last8 = userId.replace(/-/g, "").slice(-8).toUpperCase();
  return `BAZ-${last8}`;
}

export default async function AccountReferralsPage() {
  if (!isSupabaseConfigured) redirect("/sign-in");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const code = deriveCodeFromUserId(user.id);
  const baseUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://bazar-real-estate-cms.vercel.app";
  const inviteUrl = `${baseUrl}/?ref=${encodeURIComponent(code)}`;

  return (
    <div className="max-w-[860px]">
      <Eyebrow>Referrals</Eyebrow>
      <h1
        className="serif text-[48px] mt-2 font-normal leading-[1.05]"
        style={{ letterSpacing: "-0.025em" }}
      >
        Refer. Earn. Quietly.
      </h1>
      <p className="mt-4 text-[15px] text-bz-muted max-w-[60ch]">
        When a friend you refer engages Bazar and the engagement closes,
        you both earn AED 5,000 toward future advisory fees.
      </p>

      {/* Invite link */}
      <section className="mt-10 rounded-lg border border-bz-border bg-bz-surface p-7">
        <Eyebrow>Your invite link</Eyebrow>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 items-center">
          <div className="font-mono text-[13.5px] text-bz-ink overflow-x-auto whitespace-nowrap px-4 py-3 rounded-md bg-bz-bg border border-bz-border">
            {inviteUrl}
          </div>
          <CopyButton text={inviteUrl} />
        </div>
        <div className="mt-4 text-[12px] text-bz-muted">
          Your code: <span className="mono text-bz-ink">{code}</span>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-12 grid grid-cols-3 gap-6">
        <div className="rounded-md border border-bz-border bg-bz-surface p-6">
          <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
            Visits
          </div>
          <div
            className="serif text-[36px] mt-1 leading-none"
            style={{ letterSpacing: "-0.018em" }}
          >
            0
          </div>
        </div>
        <div className="rounded-md border border-bz-border bg-bz-surface p-6">
          <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
            Briefs
          </div>
          <div
            className="serif text-[36px] mt-1 leading-none"
            style={{ letterSpacing: "-0.018em" }}
          >
            0
          </div>
        </div>
        <div className="rounded-md border border-bz-border bg-bz-surface p-6">
          <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
            Closed (AED)
          </div>
          <div
            className="serif text-[36px] mt-1 leading-none"
            style={{ letterSpacing: "-0.018em" }}
          >
            —
          </div>
        </div>
      </section>

      {/* Activity */}
      <section className="mt-12">
        <Eyebrow>Activity</Eyebrow>
        <div className="mt-4 rounded-md border border-dashed border-bz-border bg-bz-bg p-8 text-center">
          <p className="text-[14px] text-bz-ink-2">
            Referral tracking lands in Sprint 8 alongside the{" "}
            <span className="mono text-bz-ink">referrals</span> table.
          </p>
          <p className="mt-2 text-[12.5px] text-bz-muted">
            Until then, share your link — we&apos;ll match new sign-ups against
            your code when the table goes live.
          </p>
        </div>
      </section>

      {/* Terms */}
      <section className="mt-12 border-t border-bz-border pt-10">
        <Eyebrow>How it works</Eyebrow>
        <ol className="mt-5 flex flex-col gap-3 max-w-[60ch]">
          <li className="text-[14px] text-bz-ink leading-relaxed">
            <span className="mono text-bz-muted">01 ·</span> Share your invite
            link. We attribute the visit to you on first arrival.
          </li>
          <li className="text-[14px] text-bz-ink leading-relaxed">
            <span className="mono text-bz-muted">02 ·</span> When your referral
            signs a Bazar engagement (buy, sell, or invest mandate), the
            referral is qualified.
          </li>
          <li className="text-[14px] text-bz-ink leading-relaxed">
            <span className="mono text-bz-muted">03 ·</span> On DLD transfer or
            engagement close, you both receive AED 5,000 in advisory credit.
          </li>
          <li className="text-[14px] text-bz-ink leading-relaxed">
            <span className="mono text-bz-muted">04 ·</span> Credit is
            redeemable against your next Bazar engagement within 24 months.
          </li>
        </ol>
      </section>
    </div>
  );
}
