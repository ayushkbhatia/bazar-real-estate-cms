import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";

export function ServiceCard({
  slug,
  name,
  one_liner,
}: {
  slug: string;
  name: string;
  one_liner: string;
}) {
  return (
    <Link
      href={`/services/${slug}`}
      className="group block rounded-lg border border-bz-border bg-bz-surface p-6 md:p-8 hover:border-bz-border-strong transition-colors"
    >
      <div className="text-[11.5px] uppercase tracking-wider text-bz-accent">
        {`0${["sell", "buy", "manage", "conveyancing", "invest"].indexOf(slug) + 1}`}
      </div>
      <h3
        className="serif text-[26px] mt-3 leading-tight"
        style={{ letterSpacing: "-0.012em" }}
      >
        {name}
      </h3>
      <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">
        {one_liner}
      </p>
      <div className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] text-bz-ink-2 group-hover:text-bz-accent transition-colors">
        Learn more
        <ArrowRight size={13} strokeWidth={1.8} />
      </div>
    </Link>
  );
}
