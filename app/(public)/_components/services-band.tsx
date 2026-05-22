import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { SEED_SERVICES } from "@/lib/seeds/services";

/**
 * Sprint 4a: 5-column dark services band. Pulls names + one-liners from
 * the same seed source the /services pages use.
 */
export function ServicesBand() {
  return (
    <section className="bg-bz-ink text-white">
      <div className="px-12 py-20">
        <Eyebrow className="text-white/60">Services</Eyebrow>
        <h2
          className="serif text-[40px] mt-3 leading-tight max-w-[26ch]"
          style={{ letterSpacing: "-0.022em" }}
        >
          One advisor each. Five practices.
        </h2>
        <div className="mt-12 grid grid-cols-5 gap-10">
          {SEED_SERVICES.map((s, i) => (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              className="group block"
            >
              <div className="text-[11.5px] uppercase tracking-wider text-white/85">
                {`0${i + 1}`}
              </div>
              <div
                className="serif text-[22px] mt-3 leading-tight group-hover:text-bz-accent transition-colors"
                style={{ letterSpacing: "-0.012em" }}
              >
                {s.name}
              </div>
              <p className="mt-3 text-[13px] text-white/70 leading-relaxed">
                {s.one_liner}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
