"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { exitHref } from "@/lib/mortgage-requests/client/apply-state";
import { useApplyState } from "@/lib/mortgage-requests/client/apply-store";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { FlowLinkButton } from "./primitives";

/** The route's step name for analytics: the pattern, never the URL. */
export function stepOf(pathname: string): string {
  const last = pathname.replace(/\/$/, "").split("/").pop() ?? "";
  return last === "apply" ? "service" : last || "service";
}

/**
 * Exit (00-foundations §4): back to the mortgage page. No confirmation — it
 * isn't designed (FE-13), and nothing is lost: the answers stay in this
 * tab's storage for a return visit.
 */
export function ExitLink({ label }: { label: string }) {
  const [state] = useApplyState();
  const pathname = usePathname();
  return (
    <FlowLinkButton
      kind="ghost"
      size="sm"
      href={exitHref(state?.siteLocale)}
      onClick={() => trackMortgage("mortgage_apply_exit", { step: stepOf(pathname) })}
    >
      <X size={16} strokeWidth={1.6} aria-hidden />
      {label}
    </FlowLinkButton>
  );
}
