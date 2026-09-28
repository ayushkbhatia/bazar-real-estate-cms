"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/mortgage-requests/client/api";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { sendCode, verifyCode } from "@/lib/mortgage-requests/client/link-api";
import { cn } from "@/lib/utils";
import { FlowPage } from "../../../../_components/flow-page";
import { FlowButton } from "../../../../_components/primitives";
import { FlowHeading } from "../../../../_components/steps";

const COOLDOWN_SECONDS = 60;

/**
 * The code before a secure link opens (W8 "Enter code"; SPEC §8; FE-2: not
 * designed). One input with `autocomplete="one-time-code"`, not six boxes.
 * A right code sets the session cookie and the page re-renders as verified.
 */
export function CodeGate({ token, purpose }: { token: string; purpose: "reupload" | "preapproval_invite" }) {
  const t = useTranslations("mortgage");
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [attempts, setAttempts] = useState(0);

  // The resend cooldown's countdown.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const sent = await sendCode(token);
      setDestination(sent.destination);
      setWait(COOLDOWN_SECONDS);
      trackMortgage("mortgage_reupload_otp_sent", { purpose });
      requestAnimationFrame(() => input.current?.focus());
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "generic";
      if (code === "link_unavailable" || code === "link_locked") router.refresh();
      else if (code === "code_cooldown" || code === "rate_limited") setError(t("w8.code.error.cooldown"));
      else if (code === "code_failed") setError(t("w8.code.error.failed"));
      else setError(t("w8.code.error.generic"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError(t("w8.code.error.format"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyCode(token, digits);
      trackMortgage("mortgage_reupload_verified", { purpose });
      router.refresh();
    } catch (e) {
      const apiCode = e instanceof ApiError ? e.code : "generic";
      const next = attempts + 1;
      setAttempts(next);
      trackMortgage("mortgage_reupload_otp_failed", { attempt: next });
      if (apiCode === "code_wrong") {
        const left = Number((e as ApiError).details.attemptsLeft ?? 0);
        setError(t("w8.code.error.wrong", { count: left }));
      } else if (apiCode === "code_expired") setError(t("w8.code.error.expired"));
      else if (apiCode === "link_locked" || apiCode === "link_unavailable") router.refresh();
      else if (apiCode === "rate_limited") setError(t("w8.code.error.cooldown"));
      else setError(t("w8.code.error.generic"));
      setBusy(false);
    }
  };

  const errorId = `${id}-error`;
  return (
    <FlowPage>
      <FlowHeading eyebrow={t("w8.code.eyebrow")} title={t("w8.code.title")} lede={t("w8.code.lede")} />
      <div className="mt-8 max-w-[440px]">
        {destination ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
            noValidate
          >
            <p className="text-[14px] text-bz-ink-2" aria-live="polite">
              {t("w8.code.sent", { destination })}
            </p>
            <label htmlFor={`${id}-code`} className="mt-5 block text-[13px] font-medium">
              {t("w8.code.label")}
            </label>
            <input
              ref={input}
              id={`${id}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, "").slice(0, 7))}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? errorId : undefined}
              className={cn(
                "mono mt-2 h-12 w-full rounded-[10px] border bg-bz-surface px-4 text-[20px] tracking-[0.3em] outline-none focus-visible:border-bz-ink",
                error ? "border-[var(--mrq-danger-fg)]" : "border-bz-border-strong",
              )}
            />
            {error ? (
              <p id={errorId} role="alert" className="mt-2 text-[13px] text-[var(--mrq-danger-fg)]">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <FlowButton kind="primary" type="submit" disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
                {t("w8.code.submit")}
              </FlowButton>
              {wait > 0 ? (
                <span className="text-[12.5px] text-bz-muted">{t("w8.code.wait", { seconds: wait })}</span>
              ) : (
                <button type="button" onClick={() => void send()} disabled={busy} className="text-[13px] font-medium underline underline-offset-2">
                  {t("w8.code.resend")}
                </button>
              )}
            </div>
          </form>
        ) : (
          <>
            {error ? (
              <p role="alert" className="mb-4 text-[13px] text-[var(--mrq-danger-fg)]">
                {error}
              </p>
            ) : null}
            <FlowButton kind="primary" onClick={() => void send()} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
              {t("w8.code.send")}
            </FlowButton>
          </>
        )}
      </div>
    </FlowPage>
  );
}
