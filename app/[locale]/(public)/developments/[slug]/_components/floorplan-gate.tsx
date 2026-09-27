"use client";

/**
 * The lead gate in front of a project's floor plans.
 *
 * Mounted wherever a project whose `meta.floorplan_gated` is true shows its
 * layouts: the unit-type tabs and the unfiled-plans grid on
 * `/developments/[slug]`, and the Floor plans section of a campaign page. Each
 * card blurs its drawing behind "Request layout", and the dialog is the
 * `development_floorplan` form from /admin/forms — drawn by `FormRenderer` and
 * filed through `submitForm`, as the brochure gate is, so the lead lands in
 * Enquiries against the project and in the form's Responses.
 *
 * It used to POST to `/api/valuation-lead` with `action: "issue"`, which only
 * ever emails a verification code: no request ever became an enquiry, and
 * once that route began requiring a phone number every request was a 400.
 *
 * Success opens every gated layout of the project, not only the one asked
 * for. The visitor has left their details once; asking again for the next
 * drawing would only file the same lead twice. The unlock lasts the browser
 * session, so a reload does not ask a third time.
 */

import { useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { FileText, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import { formatArea, usePreferences } from "@/lib/preferences";
import type { ResolvedForm } from "@/lib/forms/types";
import { renderFormCopy } from "@/lib/forms/resolve";
import { FormRenderer } from "@/app/[locale]/(public)/_components/forms/form-renderer";

type Props = {
  /** `development_floorplan`, resolved by the page. Mount only while enabled. */
  form: ResolvedForm;
  /** Filed on the enquiry, and the key the unlock is held under. */
  developmentId: string;
  developmentName: string;
  /** Floor-plan record from `listFloorPlans()`. */
  plan: {
    id: string;
    label: string;
    area_ft2: number | null;
    media: {
      storage_key: string;
      filename: string;
      alt_text: string | null;
    } | null;
  };
  /**
   * The layout as the advisor should read it in the brief — "1 Bedroom ·
   * Type 2" where the card alone says "Type 2". Defaults to the plan's label.
   */
  layoutName?: string;
  /** The card as it reads unlocked. */
  children: React.ReactNode;
};

export function FloorplanGate({
  form,
  developmentId,
  developmentName,
  plan,
  layoutName,
  children,
}: Props) {
  const t = useTranslations("development.floorplanGate");
  const { prefs } = usePreferences();
  const unlocked = useFloorplansUnlocked(developmentId);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const tokens = { project: developmentName };
  // The dialog header owns the title and the blurb, so the body must not
  // render them a second time.
  const body: ResolvedForm = {
    ...form,
    copy: { ...form.copy, title: null, subtitle: null },
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDone(false);
      }}
    >
      {/* The grid item, in both states. Focusable so that closing the dialog
          can land on the drawing it opened — the button that opened it is
          gone by then. */}
      <div
        ref={cardRef}
        tabIndex={-1}
        className="flex flex-col outline-none *:grow"
      >
        {unlocked ? (
          children
        ) : (
          <div className="rounded-lg border border-bz-border bg-bz-surface p-4">
            <div className="relative aspect-square rounded overflow-hidden">
              {plan.media ? (
                <Image
                  src={mediaPublicUrl(plan.media.storage_key)}
                  alt={plan.media.alt_text ?? plan.label}
                  fill
                  sizes="33vw"
                  className="object-cover rounded blur-sm scale-105"
                />
              ) : (
                <PlaceholderImage
                  label={plan.label
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")}
                  className="absolute inset-0 w-full h-full"
                />
              )}
              {/* Lock overlay */}
              <div className="absolute inset-0 bg-bz-bg/55 backdrop-blur-[2px] flex items-center justify-center">
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary" className="gap-1.5">
                    <Lock size={12} strokeWidth={1.8} />
                    {t("request")}
                  </Button>
                </DialogTrigger>
              </div>
            </div>
            <div className="flex justify-between items-center mt-3">
              <div>
                <div className="text-[14px] font-medium">{plan.label}</div>
                <div className="text-[11.5px] text-bz-ink-2">
                  {formatArea(plan.area_ft2, prefs)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <DialogContent
        className="sm:max-w-[420px]"
        onCloseAutoFocus={(event) => {
          if (!unlocked) return;
          event.preventDefault();
          cardRef.current?.focus();
        }}
      >
        {done ? (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-bz-accent/15 text-bz-accent flex items-center justify-center mx-auto mb-3">
                <FileText size={20} strokeWidth={1.8} />
              </div>
              <DialogTitle className="serif text-[24px] text-center leading-tight">
                {renderFormCopy(form.copy.success_title, tokens)}
              </DialogTitle>
              <DialogDescription className="text-center">
                {renderFormCopy(form.copy.success_body, tokens)}
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => setOpen(false)} className="mt-2">
              {t("view")}
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              {/* pe-8 keeps a long project name clear of the close button. */}
              <DialogTitle className="serif text-[24px] leading-tight pe-8">
                {renderFormCopy(form.copy.title, tokens)}
              </DialogTitle>
              <DialogDescription>
                {renderFormCopy(form.copy.subtitle, tokens)}
              </DialogDescription>
            </DialogHeader>
            <FormRenderer
              form={body}
              tokens={tokens}
              context={{
                developmentId,
                developmentName,
                scenario: layoutName ?? plan.label,
              }}
              toastErrors
              onSuccess={() => {
                setDone(true);
                unlockFloorplans(developmentId);
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── the unlock ──────────────────────────────────────────────────────────

/**
 * Projects whose layouts this visitor has unlocked, shared by every gate on
 * the page and kept in `sessionStorage` for the rest of the visit.
 *
 * A module-level set rather than state in each gate, because the gates do not
 * share a parent: the unit-type tabs and the unfiled-plans grid are separate
 * sections, and on a campaign page they are separate blocks. Storage is a
 * convenience, never a requirement — a private window or blocked storage just
 * means the gate asks again after a reload.
 */
const UNLOCK_KEY = "bz-floorplans-unlocked";
const listeners = new Set<() => void>();
let unlockedIds: ReadonlySet<string> | null = null;

function readUnlocked(): ReadonlySet<string> {
  if (unlockedIds) return unlockedIds;
  let ids: string[] = [];
  try {
    const parsed: unknown = JSON.parse(
      window.sessionStorage.getItem(UNLOCK_KEY) ?? "[]",
    );
    if (Array.isArray(parsed)) {
      ids = parsed.filter((id): id is string => typeof id === "string");
    }
  } catch {
    // Unreadable or blocked storage — nothing is unlocked yet.
  }
  unlockedIds = new Set(ids);
  return unlockedIds;
}

function unlockFloorplans(developmentId: string) {
  const next = new Set(readUnlocked());
  next.add(developmentId);
  unlockedIds = next;
  try {
    window.sessionStorage.setItem(UNLOCK_KEY, JSON.stringify([...next]));
  } catch {
    // Still unlocked for this page view; only the reload forgets.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useFloorplansUnlocked(developmentId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readUnlocked().has(developmentId),
    // The server renders every gate locked; an unlock recorded earlier in the
    // visit applies straight after hydration.
    () => false,
  );
}
