import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { StaffSignInForm } from "./_form";

export const metadata: Metadata = {
  title: "Staff sign-in",
  description: "Sign in to the Bazar admin panel.",
  // Never index the staff door.
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ redirect?: string | string[] }>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const requested = typeof sp.redirect === "string" ? sp.redirect : undefined;

  // Already signed in as active staff? Skip the form and go straight in.
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: staffRow } = await supabase
        .from("staff")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (staffRow?.status === "active") redirect("/admin");
    }
  }

  return <StaffSignInForm redirectTo={requested} />;
}
