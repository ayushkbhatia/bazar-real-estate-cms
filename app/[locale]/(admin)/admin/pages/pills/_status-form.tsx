"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_PILLS, type StatusPillOverrides } from "@/lib/card-labels";
import { updateStatusPills } from "./_actions";

const MAX_TEXT = 28;

/**
 * The status pills' words, English and Arabic. Each box shows the shipped
 * words as its placeholder, so a blank box says exactly what the site shows.
 */
export function StatusPillsForm({
  initial,
}: {
  initial: StatusPillOverrides;
}) {
  const [values, setValues] = useState<StatusPillOverrides>(initial);
  const [pending, start] = useTransition();

  function set(
    id: (typeof STATUS_PILLS)[number]["id"],
    key: "text" | "text_ar",
    v: string,
  ) {
    setValues((prev) => ({ ...prev, [id]: { ...prev[id], [key]: v } }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateStatusPills(values);
      if (res.status === "ok") toast.success(res.message ?? "Saved.");
      else toast.error(res.message);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-3xl">
      <header>
        <h2 className="text-[16px] font-medium">Status pills</h2>
        <p className="mt-1 text-[13px] text-bz-ink-2 leading-relaxed">
          The chips a card wears because of what a listing is — off-plan, for
          sale, for rent. Leave a box blank to keep the words shown in it.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {STATUS_PILLS.map((p) => (
          <li
            key={p.id}
            className="rounded-md border border-bz-border bg-bz-surface p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-bz-navy px-2.5 py-1 text-[11px] font-medium text-bz-bg">
                {values[p.id]?.text?.trim() || p.text}
              </span>
              <span className="text-[11.5px] text-bz-muted">{p.usedOn}</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${p.id}-en`}>English</Label>
                <Input
                  id={`${p.id}-en`}
                  value={values[p.id]?.text ?? ""}
                  placeholder={p.text}
                  maxLength={MAX_TEXT}
                  onChange={(e) => set(p.id, "text", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${p.id}-ar`}>Arabic</Label>
                <Input
                  id={`${p.id}-ar`}
                  dir="rtl"
                  lang="ar"
                  value={values[p.id]?.text_ar ?? ""}
                  placeholder={p.text_ar}
                  maxLength={MAX_TEXT}
                  onChange={(e) => set(p.id, "text_ar", e.target.value)}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" size={14} /> : null}
          Save status pills
        </Button>
      </div>
    </form>
  );
}
