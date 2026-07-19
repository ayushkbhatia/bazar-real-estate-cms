"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import type { OffplanProjectOption } from "@/lib/queries/offplan-map";
import { createEnquiry } from "../../_actions";

const DIAL_CODES = ["+971", "+966", "+44", "+1"];

const TIMELINES = [
  { label: "Ready to buy", value: "now" as const },
  { label: "Next 3 months", value: "three_months" as const },
  { label: "Next 6 months", value: "six_months" as const },
  { label: "Just exploring", value: "browsing" as const },
];

/**
 * New Projects "Register your interest" lead form. A project-specific
 * cousin of the home "List your property" card: the visitor picks a live
 * off-plan project (or "Not sure yet"), and the enquiry is filed against
 * that development so an advisor can follow up with availability, floor
 * plans, and payment plans. Flows through the shared `createEnquiry`
 * action (source "contact_page") — no schema/DB change needed.
 */
export function ProjectInterestForm({
  projects,
}: {
  projects: OffplanProjectOption[];
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState("+971");
  const [phone, setPhone] = useState("");
  const [projectId, setProjectId] = useState("");
  const [timeline, setTimeline] = useState(TIMELINES[0].value);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const name = `${firstName} ${lastName}`.trim();
    const phoneFull = phone.trim() ? `${dial} ${phone.trim()}` : "";
    const project = projects.find((p) => p.id === projectId);
    const projectLabel = project ? project.name : "Not sure yet";
    const message = [
      `New project interest — ${projectLabel}.`,
      note.trim() ? note.trim() : null,
    ]
      .filter(Boolean)
      .join(" ");

    startTransition(async () => {
      const res = await createEnquiry({
        name,
        email,
        phone: phoneFull,
        message,
        intent: "buy",
        timeline,
        source: "contact_page",
        development_id: project ? project.id : null,
      });
      if (res.status === "ok") {
        setDone(true);
      } else {
        setFormError(res.message);
        if (res.fieldErrors) setErrors(res.fieldErrors);
      }
    });
  }

  return (
    <section className="px-4 md:px-12 py-14 md:py-20">
      <div className="grid overflow-hidden rounded-2xl border border-bz-border bg-bz-surface md:grid-cols-[1.05fr_1fr]">
        {/* Form */}
        <div className="p-6 md:p-14">
          <div
            className="text-[11px] font-medium uppercase text-bz-accent"
            style={{ letterSpacing: "0.12em" }}
          >
            Register your interest
          </div>
          <h2 className="serif mt-2 text-[32px] md:text-[40px] font-normal leading-[1.05] tracking-tight">
            Interested in a new project?
          </h2>
          <p className="mt-3 max-w-[46ch] text-[14.5px] text-bz-ink-2 leading-relaxed">
            Tell us which launch caught your eye — an advisor will share
            availability, floor plans, and payment plans.
          </p>

          {done ? (
            <div className="mt-8 flex items-start gap-3 rounded-lg border border-bz-border bg-bz-surface-2 p-5">
              <Check size={18} className="mt-0.5 text-bz-accent" />
              <div>
                <div className="text-[15px] font-medium">
                  Thanks — we&apos;ve got it.
                </div>
                <p className="mt-1 text-[13.5px] text-bz-ink-2">
                  An advisor will be in touch shortly about the project you
                  registered for.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LabeledInput
                  label="First name"
                  value={firstName}
                  onChange={setFirstName}
                  placeholder="First name"
                  error={errors.name}
                />
                <LabeledInput
                  label="Last name"
                  value={lastName}
                  onChange={setLastName}
                  placeholder="Last name"
                />
              </div>
              <LabeledInput
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@email.com"
                error={errors.email}
              />
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="pi-phone"
                  className="text-[12px] font-medium text-bz-ink-2"
                >
                  Phone number
                </label>
                <div className="flex gap-2">
                  <select
                    aria-label="Dialing code"
                    value={dial}
                    onChange={(e) => setDial(e.target.value)}
                    className="h-11 w-[92px] shrink-0 rounded-md border border-bz-border bg-bz-surface px-2 text-[13.5px] outline-none focus:border-bz-accent"
                  >
                    {DIAL_CODES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    id="pi-phone"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="50 000 0000"
                    className="h-11 w-full rounded-md border border-bz-border bg-bz-surface px-3 text-[13.5px] outline-none focus:border-bz-accent"
                  />
                </div>
                {errors.phone ? (
                  <span className="text-[12px] text-bz-danger">
                    {errors.phone}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="project-of-interest"
                  className="text-[12px] font-medium text-bz-ink-2"
                >
                  Project of interest
                </label>
                <select
                  id="project-of-interest"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="h-11 rounded-md border border-bz-border bg-bz-surface px-3 text-[13.5px] outline-none focus:border-bz-accent"
                >
                  <option value="">Not sure yet — help me choose</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.areaName ? `${p.name} — ${p.areaName}` : p.name}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset className="mt-1">
                <legend className="mb-2 text-[12px] font-medium text-bz-ink-2">
                  Timeline
                </legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {TIMELINES.map((t) => {
                    const on = timeline === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTimeline(t.value)}
                        className={[
                          "h-11 rounded-md px-4 text-[13.5px] transition-colors sm:h-9",
                          on
                            ? "border border-bz-navy bg-bz-navy text-bz-bg"
                            : "border border-bz-border-strong bg-bz-surface text-bz-ink-2 hover:bg-bz-surface-2",
                        ].join(" ")}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="project-note"
                  className="text-[12px] font-medium text-bz-ink-2"
                >
                  Anything else? <span className="text-bz-muted">(optional)</span>
                </label>
                <textarea
                  id="project-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Budget, bedrooms, must-haves…"
                  className="rounded-md border border-bz-border bg-bz-surface px-3 py-2 text-[13.5px] outline-none focus:border-bz-accent resize-y"
                />
              </div>

              {formError ? (
                <p className="text-[13px] text-bz-danger">{formError}</p>
              ) : null}

              <Button
                type="submit"
                disabled={pending}
                className="mt-2 h-11 self-start px-6"
              >
                {pending ? "Submitting…" : "Register interest"}
              </Button>
              <p className="text-[11.5px] text-bz-muted -mt-1">
                By submitting you agree to be contacted by a Bazar advisor.
              </p>
            </form>
          )}
        </div>

        {/* Photo */}
        <div className="relative min-h-[220px] bg-bz-ink md:min-h-0">
          <PlaceholderImage
            label="off-plan development · architectural render"
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </section>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
}) {
  const id = `pi-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-bz-ink-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-md border border-bz-border bg-bz-surface px-3 text-[13.5px] outline-none focus:border-bz-accent"
      />
      {error ? <span className="text-[12px] text-bz-danger">{error}</span> : null}
    </div>
  );
}
