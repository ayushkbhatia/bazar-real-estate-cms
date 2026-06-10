import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  ACCOUNT_KYC_LABELS,
  type AccountProfileInput,
} from "@/lib/schemas/account-profile";
import { ProfileForm } from "./_form";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your name, language, residency, and notification preferences.",
};

const KYC_BADGE: Record<
  string,
  { bg: string; text: string }
> = {
  unverified: { bg: "bg-bz-surface-2", text: "text-bz-ink-2" },
  pending: { bg: "bg-yellow-100", text: "text-yellow-900" },
  verified: { bg: "bg-bz-accent-soft", text: "text-bz-accent" },
  rejected: { bg: "bg-red-50", text: "text-red-700" },
};

export default async function AccountProfilePage() {
  if (!isSupabaseConfigured) redirect("/sign-in");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: account } = await supabase
    .from("accounts")
    .select(
      "first_name, last_name, nationality, preferred_language, residency_status, marketing_opt_in, kyc_status, kyc_verified_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const initial: AccountProfileInput = {
    first_name: account?.first_name ?? "",
    last_name: account?.last_name ?? "",
    nationality: account?.nationality ?? "",
    preferred_language: account?.preferred_language ?? "en",
    residency_status: account?.residency_status ?? null,
    marketing_opt_in: account?.marketing_opt_in ?? false,
  };

  const kycStatus = account?.kyc_status ?? "unverified";
  const badge = KYC_BADGE[kycStatus] ?? KYC_BADGE.unverified;

  return (
    <div className="max-w-[760px]">
      <Eyebrow>Profile</Eyebrow>
      <h1
        className="serif text-[30px] md:text-[48px] mt-2 font-normal leading-[1.05]"
        style={{ letterSpacing: "-0.025em" }}
      >
        Your details.
      </h1>
      <p className="mt-4 text-[15px] text-bz-muted max-w-[60ch]">
        We keep this private to Bazar. Verification documents (passport,
        Emirates ID) live in your <Link href="/account/documents" className="text-bz-ink underline underline-offset-2">document vault</Link>.
      </p>

      {/* Account header strip */}
      <div className="mt-10 rounded-lg border border-bz-border bg-bz-surface p-6 flex items-center gap-5">
        <div className="w-12 h-12 rounded-full bg-bz-accent text-bz-accent-fg inline-flex items-center justify-center font-medium">
          {(user.email?.[0] ?? "·").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-bz-ink truncate">{user.email}</div>
          <div className="text-[12px] text-bz-muted mt-0.5 inline-flex items-center gap-1.5">
            <ShieldCheck size={12} strokeWidth={1.7} />
            <span>KYC ·</span>
            <span
              className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-medium ${badge.bg} ${badge.text}`}
            >
              {ACCOUNT_KYC_LABELS[kycStatus] ?? kycStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="mt-10">
        <ProfileForm initial={initial} />
      </div>

      {/* PDPL actions */}
      <div className="mt-14 border-t border-bz-border pt-10">
        <Eyebrow>Your data (UAE PDPL)</Eyebrow>
        <p className="mt-3 text-[14px] text-bz-ink-2 max-w-[60ch] leading-relaxed">
          Under the UAE Personal Data Protection Law, you can request a full
          export of your data at any time, or ask us to delete your account.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/account/data-export">
              <Download size={14} strokeWidth={1.7} />
              Export my data
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/account/data-deletion" className="text-bz-danger">
              <Trash2 size={14} strokeWidth={1.7} />
              Delete my account
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
