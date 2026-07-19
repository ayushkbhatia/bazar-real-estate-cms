"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { createEnquiry } from "../../_actions";

const PURPOSES = [
  { label: "Sell Your Property", intent: "sell" as const },
  { label: "Rent Your Property", intent: "rent" as const },
  { label: "Manage Your Property", intent: "manage" as const },
];

const DIAL_CODES = ["+971", "+966", "+44", "+1"];

/**
 * Home "List your property" (handoff §4). Split card: lead-gen form + photo.
 * Submits through the shared `createEnquiry` server action (source
 * "contact_page"); the chosen purpose rides in `intent` + the message, so
 * no schema/DB change is needed.
 */
export function ListYourProperty() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState("+971");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
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
    startTransition(async () => {
      const res = await createEnquiry({
        name,
        email,
        phone: phoneFull,
        message: `List my property — ${purpose.label}.`,
        intent: purpose.intent,
        source: "contact_page",
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
            List your property
          </div>
          <h2 className="serif mt-2 text-[32px] md:text-[40px] font-normal leading-[1.05] tracking-tight">
            List your property
          </h2>
          <p className="mt-3 max-w-[44ch] text-[14.5px] text-bz-ink-2 leading-relaxed">
            Looking to sell or rent? We&apos;ll handle the process for you.
          </p>

          {done ? (
            <div className="mt-8 flex items-start gap-3 rounded-lg border border-bz-border bg-bz-surface-2 p-5">
              <Check size={18} className="mt-0.5 text-bz-accent" />
              <div>
                <div className="text-[15px] font-medium">Thanks — we&apos;ve got it.</div>
                <p className="mt-1 text-[13.5px] text-bz-ink-2">
                  An advisor will be in touch shortly about listing your
                  property.
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
                <label className="text-[12px] font-medium text-bz-ink-2">
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
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="50 000 0000"
                    className="h-11 w-full rounded-md border border-bz-border bg-bz-surface px-3 text-[13.5px] outline-none focus:border-bz-accent"
                  />
                </div>
                {errors.phone ? (
                  <span className="text-[12px] text-bz-danger">{errors.phone}</span>
                ) : null}
              </div>

              <fieldset className="mt-1">
                <legend className="mb-2 text-[12px] font-medium text-bz-ink-2">
                  Property purpose
                </legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {PURPOSES.map((p) => {
                    const on = purpose.label === p.label;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPurpose(p)}
                        className={[
                          "h-11 rounded-md px-4 text-[13.5px] transition-colors sm:h-9",
                          on
                            ? "border border-bz-navy bg-bz-navy text-bz-bg"
                            : "border border-bz-border-strong bg-bz-surface text-bz-ink-2 hover:bg-bz-surface-2",
                        ].join(" ")}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {formError ? (
                <p className="text-[13px] text-bz-danger">{formError}</p>
              ) : null}

              <Button type="submit" disabled={pending} className="mt-2 h-11 self-start px-6">
                {pending ? "Submitting…" : "Submit"}
              </Button>
            </form>
          )}
        </div>

        {/* Photo */}
        <div className="relative min-h-[220px] bg-bz-ink md:min-h-0">
          <PlaceholderImage
            label="agent handing over keys"
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
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-bz-ink-2">{label}</label>
      <input
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
