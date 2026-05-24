import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { listIntegrations } from "@/lib/queries/integrations";
import {
  isMailchimpConfigured,
  isDocuSignConfigured,
  isMeilisearchConfigured,
  isVoyageConfigured,
  isMapboxConfigured,
} from "@/lib/env";
import type {
  IntegrationKind,
  IntegrationRow,
  IntegrationStatus,
} from "@/lib/types/sprint-8";

export const dynamic = "force-dynamic";

const KIND_META: Record<
  IntegrationKind,
  { label: string; blurb: string; href?: string; envVars: string[] }
> = {
  mapbox: {
    label: "Mapbox",
    blurb: "Geocoding, isochrones, contact + commute maps.",
    envVars: ["NEXT_PUBLIC_MAPBOX_TOKEN"],
  },
  meilisearch: {
    label: "Meilisearch",
    blurb: "Search index for /buy, /rent, /off-plan, /commercial.",
    envVars: [
      "MEILISEARCH_HOST",
      "MEILISEARCH_API_KEY",
      "NEXT_PUBLIC_MEILISEARCH_HOST",
      "NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY",
    ],
  },
  voyage_ai: {
    label: "Voyage AI",
    blurb: "Embeddings for /concierge semantic_search.",
    envVars: ["VOYAGE_API_KEY"],
  },
  property_finder: {
    label: "Property Finder",
    blurb: "Pull-based XML feed at /api/feeds/property-finder.xml.",
    envVars: ["PROPERTY_FINDER_FEED_TOKEN"],
  },
  bayut: {
    label: "Bayut",
    blurb: "Pull-based XML feed at /api/feeds/bayut.xml.",
    envVars: ["BAYUT_FEED_TOKEN"],
  },
  mailchimp: {
    label: "Mailchimp",
    blurb: "Newsletter subscribe + double-opt-in + unsubscribe webhook.",
    envVars: [
      "MAILCHIMP_API_KEY",
      "MAILCHIMP_LIST_ID",
      "MAILCHIMP_DC",
      "MAILCHIMP_WEBHOOK_SECRET",
    ],
  },
  whatsapp_cloud: {
    label: "WhatsApp Cloud API",
    blurb: "Post-launch upgrade. Today: wa.me deep links throughout.",
    envVars: [],
  },
  dld_open_data: {
    label: "DLD / DMT open data",
    blurb:
      "Weekly CSV import for /tools/valuation comparables. Configure csv_url on the integration row.",
    envVars: [],
  },
  docusign: {
    label: "DocuSign",
    blurb: "Envelope creation + signed-doc Connect webhook.",
    envVars: [
      "DOCUSIGN_INTEGRATION_KEY",
      "DOCUSIGN_USER_ID",
      "DOCUSIGN_ACCOUNT_ID",
      "DOCUSIGN_PRIVATE_KEY",
      "DOCUSIGN_BASE_URL",
      "DOCUSIGN_WEBHOOK_SECRET",
    ],
  },
  posthog: {
    label: "PostHog",
    blurb: "Product analytics + session replay (consent-gated).",
    envVars: ["NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST"],
  },
  sentry: {
    label: "Sentry",
    blurb: "Error tracking + performance traces.",
    envVars: ["NEXT_PUBLIC_SENTRY_DSN", "SENTRY_DSN"],
  },
  resend: {
    label: "Resend",
    blurb: "Transactional email.",
    envVars: ["RESEND_API_KEY", "RESEND_FROM_ADDRESS", "RESEND_REPLY_TO"],
  },
};

const STATUS_STYLES: Record<IntegrationStatus, string> = {
  disconnected: "bg-bz-surface-2 text-bz-muted",
  connected: "bg-bz-accent/15 text-bz-accent",
  error: "bg-red-100 text-red-800",
  paused: "bg-yellow-100 text-yellow-900",
};

function envConfigured(kind: IntegrationKind): boolean {
  switch (kind) {
    case "mapbox":
      return isMapboxConfigured;
    case "meilisearch":
      return isMeilisearchConfigured;
    case "voyage_ai":
      return isVoyageConfigured;
    case "mailchimp":
      return isMailchimpConfigured;
    case "docusign":
      return isDocuSignConfigured;
    default:
      return false;
  }
}

export default async function AdminSettingsIntegrationsPage() {
  const rows = await listIntegrations();
  const byKind = new Map<IntegrationKind, IntegrationRow>(
    rows.map((r) => [r.kind, r]),
  );
  const kinds = Object.keys(KIND_META) as IntegrationKind[];

  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-[860px]">
        <Eyebrow>Integrations</Eyebrow>
        <h1
          className="serif text-[32px] mt-2 font-normal leading-tight"
          style={{ letterSpacing: "-0.018em" }}
        >
          Connections to external services.
        </h1>
        <p className="mt-3 text-[14px] text-bz-muted leading-relaxed">
          Each integration card shows the in-database status (set by the
          relevant cron job or admin action) and the env-var configuration
          state. Cards stay visible even when the integration is
          disconnected — the dependent UI degrades gracefully.
        </p>
      </header>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {kinds.map((kind) => {
          const meta = KIND_META[kind];
          const row = byKind.get(kind);
          const status: IntegrationStatus = row?.status ?? "disconnected";
          const envOk = envConfigured(kind);
          return (
            <li
              key={kind}
              className="rounded-lg border border-bz-border bg-bz-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] text-bz-ink">{meta.label}</h3>
                    <span
                      className={`text-[10px] mono px-2 py-0.5 rounded uppercase tracking-wider ${STATUS_STYLES[status]}`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-2 text-[12.5px] text-bz-muted leading-relaxed">
                    {meta.blurb}
                  </p>
                </div>
              </div>

              {meta.envVars.length > 0 ? (
                <div className="mt-4 text-[11.5px] text-bz-muted">
                  Env vars{" "}
                  <span
                    className={
                      envOk ? "text-bz-accent" : "text-bz-ink-2"
                    }
                  >
                    · {envOk ? "configured" : "missing"}
                  </span>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {meta.envVars.map((v) => (
                      <li
                        key={v}
                        className="mono text-[10.5px] px-1.5 py-0.5 rounded bg-bz-bg border border-bz-border"
                      >
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {row?.last_synced_at ? (
                <div className="mt-3 text-[11px] text-bz-muted">
                  Last synced ·{" "}
                  <span className="mono text-bz-ink">
                    {new Date(row.last_synced_at).toLocaleString()}
                  </span>
                </div>
              ) : null}
              {row?.last_error ? (
                <div className="mt-2 text-[11px] text-red-700">
                  Last error · {row.last_error.slice(0, 200)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <section className="border-t border-bz-border pt-6 text-[12.5px] text-bz-muted">
        Full onboarding doc:{" "}
        <Link
          href="https://github.com/ayushkbhatia/bazar-real-estate-cms/blob/main/docs/INTEGRATIONS.md"
          target="_blank"
          rel="noopener"
          className="underline underline-offset-2 text-bz-ink-2 hover:text-bz-ink"
        >
          docs/INTEGRATIONS.md
        </Link>
      </section>
    </div>
  );
}
