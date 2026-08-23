"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { subscribeToNewsletter } from "../_actions/newsletter";
import type { NewsletterSource } from "@/lib/schemas/newsletter";
import type { ResolvedForm } from "@/lib/forms/types";

type Props = {
  source: NewsletterSource;
  /** Visual variant for the dark editorial card vs the lighter inline forms. */
  variant?: "dark" | "light";
  /**
   * The `insights_newsletter` form from /admin/forms. Optional so a surface
   * that hasn't been wired yet keeps its built-in copy; when supplied, the
   * button, the placeholder and the confirmation are the editor's.
   *
   * The field list itself isn't editable — a double opt-in signup is one
   * email box, and the manager says so rather than pretending otherwise.
   */
  form?: ResolvedForm;
};

export function NewsletterSignup({ source, variant = "light", form }: Props) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await subscribeToNewsletter({ email, source });
      if (result.status === "ok") {
        setMessage({ kind: "success", text: result.message });
        setEmail("");
      } else if (result.status === "already_confirmed") {
        setMessage({ kind: "info", text: result.message });
      } else {
        setMessage({ kind: "error", text: result.message });
      }
    });
  };

  const onDark = variant === "dark";
  const emailField = form?.fields.find((f) => f.mapping === "email");

  // A switched-off signup leaves nothing behind: the surrounding card is page
  // copy and its own section toggle decides whether that stays.
  if (form && !form.enabled) return null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2 max-w-md">
        <Input
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder={emailField?.placeholder ?? "you@email.com"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label={emailField?.label ?? "Email address"}
          /*
            The Input primitive is `h-8`, and the coarse-pointer floor in
            globals.css only lifts `[data-slot="button"]` — so on a phone this
            field sat 32px tall beside a 44px Subscribe button in the same
            flex row. `items-stretch` could not have levelled them: a flex
            item with a definite height is not stretched. 44px on the phone
            fixes the tap target and the mismatch in one; `md:h-8` is the
            desktop pair exactly as it was.
          */
          className={cn(
            "h-11 md:h-8",
            onDark &&
              "bg-white/10 text-white placeholder:text-white/40 border-white/20",
          )}
        />
        <Button type="submit" disabled={pending}>
          <Mail size={14} strokeWidth={1.8} />
          {pending
            ? (form?.copy.pending_label ?? "Subscribing…")
            : (form?.copy.submit_label ?? "Subscribe")}
        </Button>
      </div>
      {message ? (
        <p
          className={`text-[12.5px] leading-snug max-w-md ${
            message.kind === "error"
              ? "text-[oklch(0.65_0.18_28)]"
              : onDark
                ? "text-white/70"
                : "text-bz-muted"
          }`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
