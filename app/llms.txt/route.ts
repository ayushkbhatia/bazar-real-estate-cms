import { env } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * `/llms.txt`: a plain-Markdown map of the pages an AI assistant should read
 * to answer questions about buying, renting and investing in Abu Dhabi
 * (llmstxt.org). It points at the pages that carry researched FAQs: the area
 * guides, the project pages, the guides and the service pages.
 *
 * The area and project lists are read live, so a new area or project appears
 * here without a deploy, and an unpublished one never does. A failed read
 * still serves the fixed sections, because a short map beats a 500.
 *
 * English only, with the Arabic tree named once: every page listed here has
 * an /ar twin, and listing both would double the file for no new information.
 */
export const revalidate = 86400;

const BASE = (env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae").replace(/\/+$/, "");

const GUIDES: [path: string, title: string][] = [
  ["/guides/golden-visa", "UAE Golden Visa through property"],
  ["/guides/property-linked-residency", "Property-linked residency"],
  ["/guides/kyc-non-residents", "KYC for non-resident buyers"],
  ["/guides/tax-residency", "UAE Tax Residency Certificate"],
  ["/guides/rental-process", "The Abu Dhabi rental process (Tawtheeq)"],
  ["/guides/required-documents", "Documents needed to rent in Abu Dhabi"],
  ["/guides/tenant-move-in", "Tenant move-in guide"],
  ["/guides/how-to-rent-out", "How to rent out your property in Abu Dhabi"],
  ["/guides/property-management", "Property management for landlords"],
];

const LANDINGS: [path: string, title: string][] = [
  ["/buy", "Buying property in Abu Dhabi"],
  ["/rent", "Renting in Abu Dhabi"],
  ["/off-plan", "Off-plan property in Abu Dhabi"],
  ["/commercial", "Commercial property in Abu Dhabi"],
  ["/areas", "Abu Dhabi communities"],
  ["/tools/mortgage", "Mortgage calculator and pre-approval"],
  ["/tools/valuation", "Property valuation"],
  ["/services", "Services"],
  ["/services/sell", "Selling your property"],
];

async function records(): Promise<{
  areas: { slug: string; name: string }[];
  projects: { slug: string; name: string }[];
}> {
  if (!isSupabaseConfigured) return { areas: [], projects: [] };
  try {
    const supabase = createSupabasePublicClient();
    const [areas, projects] = await Promise.all([
      supabase.from("areas").select("slug, name").eq("kind", "area").order("name"),
      supabase
        .from("developments")
        .select("slug, name")
        .not("published_at", "is", null)
        .order("name"),
    ]);
    return { areas: areas.data ?? [], projects: projects.data ?? [] };
  } catch (error) {
    console.error("[llms.txt] failed to read areas/projects", error);
    return { areas: [], projects: [] };
  }
}

const line = ([path, title]: [string, string]) => `- [${title}](${BASE}${path})`;

export async function GET() {
  const { areas, projects } = await records();
  const body = [
    "# Bazar Real Estate",
    "",
    "> Boutique real-estate advisory in Abu Dhabi, UAE: sales, leasing, off-plan, property management and mortgage advice. Every page below ends with an FAQ, also published as FAQPage structured data. Each page has an Arabic version under /ar.",
    "",
    "## Guides",
    ...GUIDES.map(line),
    "",
    "## Buying, renting and tools",
    ...LANDINGS.map(line),
    "",
    ...(areas.length
      ? ["## Area guides", ...areas.map((a) => line([`/areas/${a.slug}`, a.name])), ""]
      : []),
    ...(projects.length
      ? ["## Off-plan projects", ...projects.map((p) => line([`/developments/${p.slug}`, p.name])), ""]
      : []),
    "## Optional",
    line(["/insights", "Insights: market articles"]),
    line(["/developers", "Developer profiles"]),
    `- [Sitemap](${BASE}/sitemap.xml)`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
