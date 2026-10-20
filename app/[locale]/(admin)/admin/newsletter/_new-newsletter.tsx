"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { FileText, LayoutGrid, Loader2, Newspaper, Plus, Rocket, House } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { STARTERS, STARTER_META, type Starter } from "@/lib/newsletter/starters";
import { createCampaign } from "./_actions";

const ICON: Record<Starter, typeof Plus> = {
  blank: FileText,
  digest: Newspaper,
  listings: House,
  launches: Rocket,
  insights: LayoutGrid,
};

function StarterButton({ starter, chosen, onChoose }: { starter: Starter; chosen: Starter | null; onChoose: (s: Starter) => void }) {
  const { pending } = useFormStatus();
  const Icon = ICON[starter];
  const busy = pending && chosen === starter;
  return (
    <button
      type="submit"
      name="starter"
      value={starter}
      disabled={pending}
      onClick={() => onChoose(starter)}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-start transition-colors",
        "border-bz-border hover:border-bz-navy hover:bg-bz-surface-2 disabled:opacity-60",
        busy && "border-bz-navy bg-bz-surface-2",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bz-surface-2 text-bz-ink-2">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} strokeWidth={1.8} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-bz-ink">{STARTER_META[starter].label}</span>
        <span className="block text-[11.5px] leading-snug text-bz-muted">{STARTER_META[starter].hint}</span>
      </span>
    </button>
  );
}

/**
 * "New newsletter": a blank page or a starter layout, filled with what is
 * newest on the site in both editions (lib/newsletter/starters.ts).
 */
export function NewNewsletterButton() {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Starter | null>(null);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus size={14} strokeWidth={1.8} />
        New newsletter
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>New newsletter</DialogTitle>
            <DialogDescription>
              Start blank, or from a layout already filled with the newest listings, launches and articles — English and
              Arabic. Everything in it can be changed in the editor.
            </DialogDescription>
          </DialogHeader>
          <form action={createCampaign} className="grid gap-2 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <StarterButton key={s} starter={s} chosen={chosen} onChoose={setChosen} />
            ))}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
