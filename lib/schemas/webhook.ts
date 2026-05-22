import { z } from "zod";

/**
 * Sprint 3 (backfilled): webhook schema for /admin/settings/api outgoing
 * webhooks. Sprint 8 lands the `webhooks` table.
 */
export const WEBHOOK_EVENTS = [
  "property.published",
  "property.unpublished",
  "property.sold",
  "enquiry.created",
  "enquiry.assigned",
  "enquiry.closed",
  "viewing.scheduled",
  "viewing.completed",
  "deal.created",
  "deal.advanced",
  "deal.closed",
  "valuation.requested",
] as const;

export const WEBHOOK_EVENT_LABELS: Record<
  (typeof WEBHOOK_EVENTS)[number],
  string
> = {
  "property.published": "Property published",
  "property.unpublished": "Property unpublished",
  "property.sold": "Property marked sold",
  "enquiry.created": "Enquiry submitted",
  "enquiry.assigned": "Enquiry assigned to advisor",
  "enquiry.closed": "Enquiry closed",
  "viewing.scheduled": "Viewing scheduled",
  "viewing.completed": "Viewing completed",
  "deal.created": "Deal opened",
  "deal.advanced": "Deal stage advanced",
  "deal.closed": "Deal closed",
  "valuation.requested": "Valuation requested",
};

export const webhookSchema = z.object({
  target_url: z
    .string()
    .url("Use a full https:// URL")
    .max(500, "URL is too long"),
  description: z.string().max(200).nullable().optional(),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, "Subscribe to at least one event"),
  active: z.boolean().default(true),
});

export type WebhookInput = z.infer<typeof webhookSchema>;
