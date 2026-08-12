"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { accessLinkItem } from "@/lib/staff-invitations";
import type { PasswordLinkResult } from "../_actions";

/**
 * Account access for one staff member: what address they sign in with, whether
 * they have ever managed to, and a button to email them a fresh set-password
 * link.
 *
 * The sign-in history is the point of the panel. "Never signed in" is the state
 * that made the invitation bug invisible for weeks — an admin had no way to see
 * that someone they had invited still couldn't get in.
 */
export function AgentAccessCard({
  userId,
  email,
  lastSignInAt,
  displayName,
  suspended = false,
  sendLink,
}: {
  userId: string;
  email: string | null;
  lastSignInAt: string | null;
  displayName: string;
  /** A password link would hand back the access a suspension removed. */
  suspended?: boolean;
  /**
   * Passed by reference from the server page — an arrow wrapper here would be
   * a plain function and couldn't cross the server/client boundary.
   */
  sendLink: (userId: string) => Promise<PasswordLinkResult>;
}) {
  const [pending, start] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Shared with the Users & roles dropdown so the two can't drift on wording
  // or on when the action is unavailable.
  const access = accessLinkItem({
    hasSignedIn: lastSignInAt !== null,
    email,
    suspended,
  });

  function send() {
    if (
      !confirm(
        `Email ${displayName} a link to set a new password?\n\nTheir current password keeps working until they use it. The link is valid for 14 days and can be used once.`,
      )
    )
      return;
    start(async () => {
      const result = await sendLink(userId);
      if (result.status === "ok") {
        toast.success(result.message);
        setSentTo(email);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-5">
      <Eyebrow>Account access</Eyebrow>
      <div className="mt-3 flex flex-col gap-2 text-[13px]">
        <div className="inline-flex items-center gap-1.5 text-bz-ink-2">
          <Mail size={13} strokeWidth={1.8} className="text-bz-muted" />
          {email ?? (
            <span className="text-bz-muted">
              No email on this account — nowhere to send a link.
            </span>
          )}
        </div>
        <div className="text-[12.5px] text-bz-muted">
          {lastSignInAt ? (
            <>
              Last signed in{" "}
              {new Date(lastSignInAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </>
          ) : (
            "Has never signed in."
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={send}
          disabled={pending || access.disabled}
        >
          {pending ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <KeyRound size={13} strokeWidth={1.7} />
              {access.label}
            </>
          )}
        </Button>
        {sentTo ? (
          <span className="text-[12px] text-bz-muted">Sent to {sentTo}.</span>
        ) : access.disabled ? (
          <span className="text-[12px] text-bz-muted">
            Unavailable{access.suffix}.
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-bz-muted max-w-[58ch]">
        Emails a single-use link, valid for 14 days, that lets{" "}
        {displayName.split(" ")[0]} choose a new password. Their role and
        profile are unchanged, and their current password keeps working until
        the link is used.
      </p>
    </div>
  );
}
