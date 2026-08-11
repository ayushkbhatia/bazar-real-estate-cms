"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  blankFeature,
  blankMilestone,
  milestoneTotal,
  type DevelopmentContentInput,
  type FeatureBlock,
  type PaymentMilestone,
} from "@/lib/schemas/development-content";
import type { MediaOption } from "../../../master/[key]/_editor";
import { ImagePicker } from "./_images-card";
import { LocationPicker } from "../../../../properties/[id]/_components/location-picker";
import { saveDevelopmentContent } from "../_actions";

export type NeighbourOption = { id: string; name: string };
export type AdvisorOption = { user_id: string; display_name: string };

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]";

/**
 * The parts of a project page that come from the development record rather
 * than its section document — payment plan, named features, map pin,
 * neighbouring projects, FAQs and the lead advisor. One card, one save, since
 * four of them share the `meta` jsonb column.
 */
export function DevelopmentContentCard({
  slug,
  initial,
  media: initialMedia,
  neighbours,
  advisors,
  mapboxAvailable,
}: {
  slug: string;
  initial: DevelopmentContentInput;
  media: MediaOption[];
  neighbours: NeighbourOption[];
  advisors: AdvisorOption[];
  mapboxAvailable: boolean;
}) {
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof DevelopmentContentInput>(
    key: K,
    value: DevelopmentContentInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveDevelopmentContent(slug, form);
      if (result.status === "ok") {
        toast.success(result.message);
        setDirty(false);
        router.refresh();
      } else if (result.status === "invalid") {
        toast.error(result.message, {
          description: result.issues.slice(0, 4).join("\n"),
        });
      } else {
        toast.error(result.message);
      }
    });
  }

  const plan = form.payment_plan;
  const total = plan ? milestoneTotal(plan.milestones) : 0;

  function setPlan(next: Partial<NonNullable<typeof plan>>) {
    if (!plan) return;
    set("payment_plan", { ...plan, ...next });
  }

  function setMilestone(i: number, next: Partial<PaymentMilestone>) {
    if (!plan) return;
    const milestones = plan.milestones.slice();
    milestones[i] = { ...milestones[i], ...next };
    setPlan({ milestones });
  }

  function setFeature(i: number, next: Partial<FeatureBlock>) {
    const blocks = form.feature_blocks.slice();
    blocks[i] = { ...blocks[i], ...next };
    set("feature_blocks", blocks);
  }

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-[13.5px] font-medium">Page content</h2>
          <p className="text-[11.5px] text-bz-muted">
            Payment plan, features, map pin, neighbours, FAQs and the lead
            advisor. These live on the project record, so the public page and
            the record editor stay in step.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onSave} disabled={pending || !dirty}>
          <Save size={13} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save content"}
        </Button>
      </div>

      {/* ── Payment plan ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-bz-border pt-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[12.5px] font-medium mr-auto">Payment plan</h3>
          {plan ? (
            <span
              className={cn(
                "text-[11.5px] tabular-nums",
                total === 100 ? "text-bz-muted" : "text-[oklch(0.45_0.13_28)]",
              )}
            >
              {total}% of 100%
            </span>
          ) : null}
          {plan ? (
            <button
              type="button"
              onClick={() => set("payment_plan", null)}
              className="text-[11.5px] text-bz-muted hover:text-bz-ink"
            >
              Remove plan
            </button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                set("payment_plan", {
                  name: "",
                  milestones: [blankMilestone()],
                  construction_pct: null,
                  handover_pct: null,
                  post_handover_pct: null,
                  post_handover_months: null,
                })
              }
            >
              <Plus size={12} strokeWidth={1.8} /> Add a payment plan
            </Button>
          )}
        </div>

        {plan ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="plan_name">Plan name</Label>
                <Input
                  id="plan_name"
                  value={plan.name}
                  placeholder="60/40 post-handover"
                  onChange={(e) => setPlan({ name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="post_months">Post-handover months</Label>
                <Input
                  id="post_months"
                  type="number"
                  value={plan.post_handover_months ?? ""}
                  onChange={(e) =>
                    setPlan({
                      post_handover_months:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <ul className="flex flex-col gap-2">
              {plan.milestones.map((m, i) => (
                <li key={i} className="flex items-end gap-2">
                  <div className="flex-1 flex flex-col gap-1">
                    <Label htmlFor={`ms_label_${i}`} className="text-[11px]">
                      Stage
                    </Label>
                    <input
                      id={`ms_label_${i}`}
                      className={fieldCls}
                      value={m.label}
                      placeholder="Booking"
                      onChange={(e) => setMilestone(i, { label: e.target.value })}
                    />
                  </div>
                  <div className="w-[140px] flex flex-col gap-1">
                    <Label htmlFor={`ms_timing_${i}`} className="text-[11px]">
                      When
                    </Label>
                    <input
                      id={`ms_timing_${i}`}
                      className={fieldCls}
                      value={m.timing ?? ""}
                      placeholder="Q3 2026"
                      onChange={(e) =>
                        setMilestone(i, { timing: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="w-[90px] flex flex-col gap-1">
                    <Label htmlFor={`ms_pct_${i}`} className="text-[11px]">
                      %
                    </Label>
                    <input
                      id={`ms_pct_${i}`}
                      type="number"
                      className={fieldCls}
                      value={m.percent}
                      onChange={(e) =>
                        setMilestone(i, { percent: Number(e.target.value) })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove stage ${i + 1}`}
                    onClick={() =>
                      setPlan({
                        milestones: plan.milestones.filter((_, x) => x !== i),
                      })
                    }
                    className="h-8 w-8 inline-flex items-center justify-center rounded text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
                  >
                    <Trash2 size={13} strokeWidth={1.7} />
                  </button>
                </li>
              ))}
            </ul>

            {plan.milestones.length < 12 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  setPlan({ milestones: [...plan.milestones, blankMilestone()] })
                }
              >
                <Plus size={12} strokeWidth={1.8} /> Add stage
              </Button>
            ) : null}

            {total !== 100 ? (
              <p className="text-[11.5px] text-[oklch(0.45_0.13_28)]">
                Stages add up to {total}%. The page still renders — but buyers
                read this as the whole schedule, so it should reach 100%.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[12px] text-bz-muted">
            No plan yet. The Payment plan section stays hidden on the page until
            one is added.
          </p>
        )}
      </div>

      {/* ── Named features ───────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-bz-border pt-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[12.5px] font-medium mr-auto">Named features</h3>
          <span className="text-[11.5px] text-bz-muted">
            {form.feature_blocks.length}/8
          </span>
        </div>
        <p className="text-[11.5px] text-bz-muted">
          Each one gets its own image and a line or two of copy. Leave the list
          empty and the page falls back to generating blocks from the
          project&apos;s amenities.
        </p>

        <ul className="flex flex-col gap-3">
          {form.feature_blocks.map((b, i) => (
            <li
              key={b.key}
              className="rounded border border-bz-border bg-bz-surface-2 p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <input
                  className={cn(fieldCls, "flex-1")}
                  value={b.title}
                  placeholder="Feature title — “The beach club”"
                  onChange={(e) => setFeature(i, { title: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Remove feature ${i + 1}`}
                  onClick={() =>
                    set(
                      "feature_blocks",
                      form.feature_blocks.filter((_, x) => x !== i),
                    )
                  }
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
                >
                  <Trash2 size={12} strokeWidth={1.7} />
                </button>
              </div>
              <textarea
                className={cn(fieldCls, "resize-y min-h-[60px]")}
                value={b.copy}
                placeholder="A sentence or two on what it is and who it's for."
                onChange={(e) => setFeature(i, { copy: e.target.value })}
              />
              <ImagePicker
                label="Image"
                value={b.media_id ?? null}
                media={media}
                onChange={(id) => setFeature(i, { media_id: id })}
                onUploaded={(m) => setMedia((cur) => [m, ...cur])}
              />
            </li>
          ))}
        </ul>

        {form.feature_blocks.length < 8 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              set("feature_blocks", [
                ...form.feature_blocks,
                blankFeature(form.feature_blocks.length),
              ])
            }
          >
            <Plus size={12} strokeWidth={1.8} /> Add feature
          </Button>
        ) : null}
      </div>

      {/* ── Location ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-bz-border pt-4">
        <h3 className="text-[12.5px] font-medium">Location</h3>
        <p className="text-[11.5px] text-bz-muted">
          Drops the pin on the project page&apos;s map and places it among the
          neighbouring projects.
        </p>
        <LocationPicker
          propertyId={slug}
          initialGeo={form.coords}
          mapboxAvailable={mapboxAvailable}
          onChange={(next) => set("coords", next)}
        />
      </div>

      {/* ── Neighbours ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-bz-border pt-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[12.5px] font-medium mr-auto">
            Nearby Developments
          </h3>
          <span className="text-[11.5px] text-bz-muted">
            {form.nearby_ids.length}/3
          </span>
        </div>
        <p className="text-[11.5px] text-bz-muted">
          Up to three projects, in this order. Leave empty and the page shows
          other projects in the same area automatically.
        </p>
        {[0, 1, 2].map((slot) => (
          <select
            key={slot}
            className={fieldCls}
            value={form.nearby_ids[slot] ?? ""}
            onChange={(e) => {
              const next = form.nearby_ids.slice();
              if (e.target.value) next[slot] = e.target.value;
              else next.splice(slot, 1);
              set(
                "nearby_ids",
                next.filter(Boolean).slice(0, 3),
              );
            }}
          >
            <option value="">Slot {slot + 1} — empty</option>
            {neighbours.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        ))}
      </div>

      {/* ── FAQs ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-bz-border pt-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[12.5px] font-medium mr-auto">FAQs</h3>
          <span className="text-[11.5px] text-bz-muted">
            {form.faq.length}/12
          </span>
        </div>
        <p className="text-[11.5px] text-bz-muted">
          Shown on the page and published as FAQ schema for search. Empty falls
          back to the standard off-plan questions.
        </p>
        <ul className="flex flex-col gap-2">
          {form.faq.map((entry, i) => (
            <li
              key={i}
              className="rounded border border-bz-border bg-bz-surface-2 p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <input
                  className={cn(fieldCls, "flex-1")}
                  value={entry.q}
                  placeholder="Question"
                  onChange={(e) => {
                    const faq = form.faq.slice();
                    faq[i] = { ...faq[i], q: e.target.value };
                    set("faq", faq);
                  }}
                />
                <button
                  type="button"
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() =>
                    set(
                      "faq",
                      form.faq.filter((_, x) => x !== i),
                    )
                  }
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
                >
                  <Trash2 size={12} strokeWidth={1.7} />
                </button>
              </div>
              <textarea
                className={cn(fieldCls, "resize-y min-h-[60px]")}
                value={entry.a}
                placeholder="Answer"
                onChange={(e) => {
                  const faq = form.faq.slice();
                  faq[i] = { ...faq[i], a: e.target.value };
                  set("faq", faq);
                }}
              />
            </li>
          ))}
        </ul>
        {form.faq.length < 12 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => set("faq", [...form.faq, { q: "", a: "" }])}
          >
            <Plus size={12} strokeWidth={1.8} /> Add question
          </Button>
        ) : null}
      </div>

      {/* ── Advisor ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-bz-border pt-4">
        <h3 className="text-[12.5px] font-medium">Lead advisor</h3>
        <p className="text-[11.5px] text-bz-muted">
          Shown in the banner at the foot of the page. Unset picks an advisor
          who covers the project&apos;s area.
        </p>
        <select
          className={cn(fieldCls, "max-w-md")}
          value={form.lead_advisor_id ?? ""}
          onChange={(e) => set("lead_advisor_id", e.target.value || null)}
        >
          <option value="">Automatic — by area</option>
          {advisors.map((a) => (
            <option key={a.user_id} value={a.user_id}>
              {a.display_name}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
