import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";

const KPIS = [
  { label: "Active listings", value: "—", note: "Phase 1" },
  { label: "New enquiries", value: "—", note: "Phase 2" },
  { label: "Closing this month", value: "—", note: "Phase 2" },
  { label: "Avg. response time", value: "—", note: "Phase 2" },
];

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Phase 0 · Foundations</Eyebrow>
        <h1
          className="serif text-[32px] font-normal mt-2"
          style={{ letterSpacing: "-0.025em" }}
        >
          Good morning, advisor.
        </h1>
        <p className="mt-2 text-[14px] text-bz-muted max-w-[72ch]">
          The CMS shell is wired. Real KPIs and the lead inbox come online in
          Phase 1–2.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="p-5 border border-bz-border rounded-lg bg-bz-surface"
          >
            <div className="text-[12px] text-bz-muted">{kpi.label}</div>
            <div
              className="text-[28px] font-medium mt-1"
              style={{ letterSpacing: "-0.02em" }}
            >
              {kpi.value}
            </div>
            <div className="text-[11.5px] text-bz-muted-2 mt-2">
              {kpi.note}
            </div>
          </div>
        ))}
      </div>
      <div className="p-6 border border-bz-border rounded-lg bg-bz-surface">
        <Eyebrow>Next up</Eyebrow>
        <h2
          className="serif text-[20px] mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          Phase 1 · Public catalogue
        </h2>
        <ul className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed list-disc pl-5">
          <li>Drizzle/Supabase schema for properties, areas, developers, media</li>
          <li>Property edit form (Overview / Details / Pricing / Location / Amenities / SEO)</li>
          <li>Media library uploads to Supabase Storage</li>
          <li>Public Search page (Buy / Rent) with Mapbox sidebar</li>
          <li>Property detail page</li>
          <li>Meilisearch indexing on publish</li>
        </ul>
        <Button asChild variant="outline" className="mt-5">
          <a
            href="/docs/PROJECT_UNDERSTANDING.md"
            target="_blank"
            rel="noreferrer"
          >
            Open project understanding
          </a>
        </Button>
      </div>
    </div>
  );
}
