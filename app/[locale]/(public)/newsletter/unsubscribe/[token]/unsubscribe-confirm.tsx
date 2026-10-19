"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { unsubscribeNewsletterToken } from "../../../_actions/newsletter";

const HEADING = "serif text-[44px] mt-4 font-normal";
const HEADING_STYLE = { letterSpacing: "-0.025em", lineHeight: 1.1 } as const;

type Copy = {
  confirmTitle: string;
  confirmBody: string;
  confirmButton: string;
  removedTitle: string;
  removedBody: string;
  errorTitle: string;
};

/**
 * The unsubscribe happens on this button, never on page load: mail
 * scanners and link previewers open every URL in an email, and a page that
 * unsubscribed as it rendered removed people who never asked to go.
 */
export function UnsubscribeConfirm({
  token,
  copy,
}: {
  token: string;
  copy: Copy;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    { status: "idle" } | { status: "done" } | { status: "error"; message: string }
  >({ status: "idle" });

  if (state.status === "done") {
    return (
      <>
        <h1 className={HEADING} style={HEADING_STYLE}>
          {copy.removedTitle}
        </h1>
        <p className="mt-6 text-[16.5px] text-bz-ink-2 leading-relaxed">
          {copy.removedBody}
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className={HEADING} style={HEADING_STYLE}>
        {state.status === "error" ? copy.errorTitle : copy.confirmTitle}
      </h1>
      <p className="mt-6 text-[16.5px] text-bz-ink-2 leading-relaxed">
        {state.status === "error" ? state.message : copy.confirmBody}
      </p>
      <div className="mt-8">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await unsubscribeNewsletterToken(token);
              // A token that stopped matching between render and click was
              // removed some other way; either way the address is off the list.
              setState(
                result.status === "error"
                  ? { status: "error", message: result.message }
                  : { status: "done" },
              );
            })
          }
        >
          {copy.confirmButton}
        </Button>
      </div>
    </>
  );
}
