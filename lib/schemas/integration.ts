import { z } from "zod";

/**
 * Sprint 3 (backfilled): integration schema for /admin/settings/integrations.
 * Sprint 8 lands the `integrations` table; Sprint 13 wires the real
 * external-service calls behind each row.
 */
export const INTEGRATION_KINDS = [
  "property_finder",
  "bayut",
  "whatsapp_cloud",
  "mailchimp",
  "mapbox",
  "meilisearch",
  "voyage_ai",
  "dld_comparables",
  "docusign",
  "resend",
  "posthog",
  "sentry",
] as const;

export const INTEGRATION_KIND_LABELS: Record<
  (typeof INTEGRATION_KINDS)[number],
  string
> = {
  property_finder: "Property Finder",
  bayut: "Bayut",
  whatsapp_cloud: "WhatsApp Business Cloud",
  mailchimp: "Mailchimp",
  mapbox: "Mapbox",
  meilisearch: "Meilisearch",
  voyage_ai: "Voyage AI (embeddings)",
  dld_comparables: "DLD comparables (CSV)",
  docusign: "DocuSign",
  resend: "Resend",
  posthog: "PostHog",
  sentry: "Sentry",
};

export const INTEGRATION_STATUSES = [
  "disconnected",
  "configured",
  "live",
  "error",
] as const;

export const integrationConfigSchema = z.object({
  kind: z.enum(INTEGRATION_KINDS),
  status: z.enum(INTEGRATION_STATUSES).default("disconnected"),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
  last_synced_at: z.string().datetime().nullable().optional(),
  last_error: z.string().nullable().optional(),
});

export type IntegrationConfig = z.infer<typeof integrationConfigSchema>;
