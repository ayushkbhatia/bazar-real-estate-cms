import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listAgents } from "@/lib/queries/agents";

export const metadata: Metadata = {
  title: "Our team",
  description:
    "Twelve senior advisors across buy, sell, rent, off-plan, and investment desks in Abu Dhabi.",
};

export default async function AgentsIndexPage() {
  const agents = await listAgents();
  return (
    <div className="bg-bz-bg">
      <section className="px-12 pt-20 pb-14 max-w-[1200px]">
        <Eyebrow>Our team</Eyebrow>
        <h1
          className="serif text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Twelve advisors.<br />
          By design.
        </h1>
        <p className="mt-8 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          Bazar caps senior advisor headcount. Each advisor owns the
          relationship end-to-end — no junior handoffs, no fee-shares. When you
          engage Bazar, you engage a person.
        </p>
      </section>

      <section className="px-12 pb-24 max-w-[1280px]">
        <div className="grid grid-cols-3 gap-8 gap-y-12">
          {agents.map((a) => (
            <Link
              key={a.user_id}
              href={`/agents/${a.slug}`}
              className="group block"
            >
              {a.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.photo_url}
                  alt={a.display_name}
                  className="w-full aspect-[4/5] rounded-md object-cover"
                />
              ) : (
                <PlaceholderImage
                  label={a.slug}
                  className="w-full aspect-[4/5] rounded-md"
                />
              )}
              <div className="mt-4">
                <div className="text-[16px] text-bz-ink group-hover:text-bz-accent transition-colors">
                  {a.display_name}
                </div>
                {a.title ? (
                  <div className="text-[12.5px] text-bz-muted mt-0.5">
                    {a.title}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.specialties.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center h-6 px-2 rounded-sm border border-bz-border text-[11px] text-bz-ink-2"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                {a.languages.length > 0 ? (
                  <div className="mt-3 mono text-[11px] text-bz-muted">
                    {a.languages.join(" · ")}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
