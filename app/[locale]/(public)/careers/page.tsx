import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { SEED_CAREERS } from "@/lib/seeds/careers";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Open advisor and operations roles at Bazar Real Estate. We hire slowly and by exception.",
};

function formatPosted(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CareersPage() {
  return (
    <div className="bg-bz-bg">
      {/* Hero */}
      <section className="px-12 pt-20 pb-14 max-w-[1200px]">
        <Eyebrow>Careers</Eyebrow>
        <h1
          className="serif text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          We hire by exception.
        </h1>
        <p className="mt-8 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          Bazar caps senior advisor headcount at twelve. We add operations and
          junior roles cautiously. Open roles are listed below — if nothing
          fits, we keep a folder open for senior advisor introductions year-round
          at{" "}
          <a
            href="mailto:careers@bazar.ae"
            className="text-bz-ink underline underline-offset-2 hover:text-bz-accent"
          >
            careers@bazar.ae
          </a>
          .
        </p>
      </section>

      {/* Why */}
      <section className="border-y border-bz-border bg-bz-surface">
        <div className="px-12 py-12 max-w-[1200px] grid grid-cols-3 gap-12">
          <div>
            <div className="text-[11.5px] uppercase tracking-wider text-bz-accent">
              01 · Fewer, bigger
            </div>
            <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">
              You will close more, but slower. Advisors on the book average 12
              transactions a year, not 60. Each one matters.
            </p>
          </div>
          <div>
            <div className="text-[11.5px] uppercase tracking-wider text-bz-accent">
              02 · Real ownership
            </div>
            <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">
              Senior advisors take a profit share on their book after year one
              — not a sliding commission tier. The economics scale with you.
            </p>
          </div>
          <div>
            <div className="text-[11.5px] uppercase tracking-wider text-bz-accent">
              03 · Operations behind you
            </div>
            <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">
              KYC, conveyancing, audit, photography, marketing — all in-house.
              You sell the property; we run the process around it.
            </p>
          </div>
        </div>
      </section>

      {/* Open roles */}
      <section className="px-12 py-20 max-w-[1200px]">
        <Eyebrow>Open roles</Eyebrow>
        <h2
          className="serif text-[44px] mt-3 leading-[1.05]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {SEED_CAREERS.length} positions currently open.
        </h2>

        <ul className="mt-12 flex flex-col gap-10">
          {SEED_CAREERS.map((role) => (
            <li
              key={role.id}
              className="rounded-lg border border-bz-border bg-bz-surface p-8"
            >
              <div className="flex items-baseline justify-between gap-6 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 text-[12px] text-bz-muted">
                    <span className="uppercase tracking-wider text-bz-accent">
                      {role.team}
                    </span>
                    <span>·</span>
                    <span>{role.type}</span>
                    <span>·</span>
                    <span className="mono">Posted {formatPosted(role.posted)}</span>
                  </div>
                  <h3
                    className="serif text-[28px] mt-3 leading-tight"
                    style={{ letterSpacing: "-0.014em" }}
                  >
                    {role.title}
                  </h3>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-bz-ink-2">
                    <MapPin size={13} strokeWidth={1.7} />
                    {role.location}
                  </div>
                </div>
                <Button asChild>
                  <a
                    href={`mailto:${role.apply_email}?subject=${encodeURIComponent(`Application — ${role.title}`)}`}
                  >
                    Apply
                  </a>
                </Button>
              </div>

              <p className="mt-6 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[68ch]">
                {role.intro}
              </p>

              <div className="mt-8 grid grid-cols-2 gap-10">
                <div>
                  <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                    You will
                  </div>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {role.responsibilities.map((r) => (
                      <li
                        key={r}
                        className="text-[13.5px] text-bz-ink leading-relaxed"
                      >
                        · {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                    You bring
                  </div>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {role.requirements.map((r) => (
                      <li
                        key={r}
                        className="text-[13.5px] text-bz-ink leading-relaxed"
                      >
                        · {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
