import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_BATCH_LIMIT, sendEmailBatch, type BatchEmailInput } from "@/lib/email";
import { readEmailBrand } from "@/lib/content-assets/system-resolve";
import type { EmailBrand } from "@/lib/content-assets/email-brand";
import type { EmailLocale } from "@/lib/content-assets/tokens";
import {
  editionLocale,
  renderNewsletter,
  unsubscribeHeaders,
  unsubscribeLinks,
  type CampaignRow,
} from "./campaign";
import { featureDrawer, newsletterFeatures, type NewsletterFeatures } from "./features";
import { unresolvedFeatures } from "./feature-render";
import { featureBlocksIn } from "@/lib/content-assets/email-feature";

/**
 * The newsletter sender: start a campaign, drain its deliveries in Resend
 * batches, close it when nothing is left. Runs as the service role, from the
 * send action (one drain straight away) and from /api/cron/newsletter-send
 * (every minute). See docs/NEWSLETTER.md.
 */

/** How many times a delivery may be attempted before it is marked failed. */
export const MAX_ATTEMPTS = 3;

type Db = NonNullable<ReturnType<typeof createAdminClient>>;

function db(): Db {
  const client = createAdminClient();
  if (!client) throw new Error("Newsletter sender: Supabase service role is not configured.");
  return client;
}

/** Snapshot a campaign's audience and mark it sending. Null when it was not in a startable state. */
export async function startCampaign(campaignId: string, client: Db = db()): Promise<number | null> {
  const { data, error } = await client.rpc("newsletter_start_campaign", { p_campaign: campaignId });
  if (error) throw new Error(`newsletter_start_campaign: ${error.message}`);
  return (data as number | null) ?? null;
}

/** Start every scheduled campaign whose time has come. */
export async function startDueCampaigns(client: Db = db(), now: Date = new Date()): Promise<string[]> {
  const { data, error } = await client
    .from("newsletter_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString());
  if (error) throw new Error(`due campaigns: ${error.message}`);
  const started: string[] = [];
  for (const row of data ?? []) {
    if ((await startCampaign(row.id, client)) !== null) started.push(row.id);
  }
  return started;
}

export type DrainReport = { batches: number; sent: number; skipped: number; failed: number; retried: number };

type Delivery = {
  id: string;
  campaign_id: string;
  subscriber_id: string;
  locale: string;
  attempts: number;
};

async function updateEach(
  client: Db,
  rows: { id: string; patch: Record<string, unknown> }[],
): Promise<void> {
  // Ten at a time: a batch is at most 100 rows, and PostgREST has no
  // per-row bulk update short of an upsert that would need every column.
  for (let i = 0; i < rows.length; i += 10) {
    await Promise.all(
      rows.slice(i, i + 10).map(({ id, patch }) =>
        client.from("newsletter_deliveries").update(patch as never).eq("id", id),
      ),
    );
  }
}

/** A stable key per batch, so a retried call Resend already accepted isn't sent twice. */
function batchKey(ids: string[]): string {
  return `newsletter-${createHash("sha256").update([...ids].sort().join(",")).digest("hex").slice(0, 40)}`;
}

/**
 * Send one claimed batch. Exported for the tests; `drainNewsletterQueue` is
 * the entry point.
 */
export async function sendClaimed(
  client: Db,
  claimed: Delivery[],
  brand: EmailBrand,
): Promise<Omit<DrainReport, "batches">> {
  const report = { sent: 0, skipped: 0, failed: 0, retried: 0 };
  if (claimed.length === 0) return report;

  const campaignIds = [...new Set(claimed.map((d) => d.campaign_id))];
  const subscriberIds = [...new Set(claimed.map((d) => d.subscriber_id))];
  const [{ data: campaigns, error: cErr }, { data: subscribers, error: sErr }] = await Promise.all([
    client
      .from("newsletter_campaigns")
      .select("id, subject, preheader, body, subject_ar, preheader_ar, body_ar")
      .in("id", campaignIds),
    client
      .from("newsletter_subscribers")
      .select("id, email, status, unsubscribe_token")
      .in("id", subscriberIds),
  ]);
  if (cErr || sErr) throw new Error(`load batch: ${(cErr ?? sErr)!.message}`);

  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c as Pick<CampaignRow, "id" | "subject" | "preheader" | "body" | "subject_ar" | "preheader_ar" | "body_ar">]));
  const subscriberById = new Map((subscribers ?? []).map((s) => [s.id, s]));

  // Featured records, looked up once per campaign and edition for the whole
  // batch — never per recipient. A batch is at most one minute's worth of a
  // send, so every reader of it sees the same prices.
  const features = new Map<string, Promise<NewsletterFeatures>>();
  const featuresFor = (campaign: { id: string; body: string; body_ar: string | null }, edition: EmailLocale) => {
    const key = `${campaign.id}:${edition}`;
    let hit = features.get(key);
    if (!hit) {
      hit = newsletterFeatures([edition === "ar" ? campaign.body_ar : campaign.body], edition);
      features.set(key, hit);
    }
    return hit;
  };

  const toSend: { delivery: Delivery; input: BatchEmailInput }[] = [];
  const skipped: { id: string; patch: Record<string, unknown> }[] = [];
  // Featured records the database didn't answer for: rather than mail cards
  // missing, the delivery goes back in the queue (and fails after
  // MAX_ATTEMPTS, like a refused batch).
  const deferred: { id: string; patch: Record<string, unknown> }[] = [];
  for (const delivery of claimed) {
    const campaign = campaignById.get(delivery.campaign_id);
    const subscriber = subscriberById.get(delivery.subscriber_id);
    // Unsubscribed (or bounced) since the snapshot: their choice wins.
    if (!campaign || !subscriber || subscriber.status !== "confirmed") {
      skipped.push({ id: delivery.id, patch: { status: "skipped", error: "no longer subscribed" } });
      continue;
    }
    const locale: EmailLocale = delivery.locale === "ar" ? "ar" : "en";
    const links = unsubscribeLinks(subscriber.unsubscribe_token, locale);
    const draft = {
      subject: campaign.subject,
      preheader: campaign.preheader,
      body: campaign.body,
      subject_ar: campaign.subject_ar ?? "",
      preheader_ar: campaign.preheader_ar ?? "",
      body_ar: campaign.body_ar ?? "",
    };
    const edition = editionLocale(draft, locale);
    const found = await featuresFor(campaign, edition);
    if (unresolvedFeatures(featureBlocksIn(edition === "ar" ? draft.body_ar : draft.body), found.lookup) > 0) {
      const final = delivery.attempts >= MAX_ATTEMPTS;
      if (final) report.failed += 1;
      else report.retried += 1;
      deferred.push({
        id: delivery.id,
        patch: { status: final ? "failed" : "queued", error: "featured listings could not be looked up" },
      });
      continue;
    }
    const email = renderNewsletter(draft, {
      brand,
      locale,
      unsubscribeUrl: links.page,
      features: (l) => featureDrawer(found, brand, l),
    });
    toSend.push({
      delivery,
      input: {
        to: subscriber.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: unsubscribeHeaders(subscriber.unsubscribe_token, locale),
      },
    });
  }
  await updateEach(client, [...skipped, ...deferred]);
  report.skipped += skipped.length;
  if (toSend.length === 0) return report;

  const result = await sendEmailBatch(
    toSend.map((t) => t.input),
    { idempotencyKey: batchKey(toSend.map((t) => t.delivery.id)) },
  );
  const now = new Date().toISOString();

  if (result.status === "ok") {
    await updateEach(
      client,
      toSend.map((t, i) => ({
        id: t.delivery.id,
        patch: { status: "sent", resend_id: result.ids[i] ?? null, sent_at: now, error: null },
      })),
    );
    report.sent += toSend.length;
  } else if (result.status === "skipped") {
    // Dry run or no key: nothing left, and nothing will on a retry.
    await updateEach(
      client,
      toSend.map((t) => ({ id: t.delivery.id, patch: { status: "skipped", error: result.reason } })),
    );
    report.skipped += toSend.length;
  } else {
    const patches = toSend.map((t) => {
      const final = t.delivery.attempts >= MAX_ATTEMPTS;
      if (final) report.failed += 1;
      else report.retried += 1;
      return {
        id: t.delivery.id,
        patch: { status: final ? "failed" : "queued", error: result.message.slice(0, 500) },
      };
    });
    await updateEach(client, patches);
  }
  return report;
}

/**
 * Claim and send batches until the queue is empty, `maxBatches` is reached or
 * `deadlineMs` passes. Spaced half a second apart: Resend's default rate is
 * two requests a second.
 */
export async function drainNewsletterQueue(
  opts: { maxBatches?: number; deadlineMs?: number; client?: Db } = {},
): Promise<DrainReport> {
  const client = opts.client ?? db();
  const maxBatches = opts.maxBatches ?? 10;
  const deadline = Date.now() + (opts.deadlineMs ?? 45_000);
  const report: DrainReport = { batches: 0, sent: 0, skipped: 0, failed: 0, retried: 0 };
  let brand: EmailBrand | null = null;

  while (report.batches < maxBatches && Date.now() < deadline) {
    const { data, error } = await client.rpc("newsletter_claim_deliveries", { p_limit: EMAIL_BATCH_LIMIT });
    if (error) throw new Error(`newsletter_claim_deliveries: ${error.message}`);
    const claimed = (data ?? []) as Delivery[];
    if (claimed.length === 0) break;
    brand ??= await readEmailBrand();
    const r = await sendClaimed(client, claimed, brand);
    report.batches += 1;
    report.sent += r.sent;
    report.skipped += r.skipped;
    report.failed += r.failed;
    report.retried += r.retried;
    if (r.retried > 0) break; // Resend refused a batch: leave the rest for the next run.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return report;
}

/** Close every sending campaign with nothing left queued or in flight. */
export async function finishCampaigns(client: Db = db()): Promise<string[]> {
  const { data, error } = await client.from("newsletter_campaigns").select("id").eq("status", "sending");
  if (error) throw new Error(`sending campaigns: ${error.message}`);
  const finished: string[] = [];
  for (const row of data ?? []) {
    const { count, error: countError } = await client
      .from("newsletter_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", row.id)
      .in("status", ["queued", "sending"]);
    if (countError) throw new Error(`pending count: ${countError.message}`);
    if ((count ?? 0) > 0) continue;
    const { error: updateError } = await client
      .from("newsletter_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "sending");
    if (updateError) throw new Error(`finish campaign: ${updateError.message}`);
    finished.push(row.id);
  }
  return finished;
}

export type SenderReport = DrainReport & { started: string[]; finished: string[] };

/** One pass of the sender: what the minute cron runs. */
export async function runNewsletterSender(opts: { deadlineMs?: number } = {}): Promise<SenderReport> {
  const client = db();
  const started = await startDueCampaigns(client);
  const drained = await drainNewsletterQueue({ client, deadlineMs: opts.deadlineMs });
  const finished = await finishCampaigns(client);
  return { ...drained, started, finished };
}

export type DeliveryCounts = Record<"queued" | "sending" | "sent" | "failed" | "skipped", number> & {
  /** What Resend's webhook reported afterwards (0164); zero until it is set up. */
  delivered: number;
  bounced: number;
  complained: number;
};

export const EMPTY_DELIVERY_COUNTS: DeliveryCounts = {
  queued: 0,
  sending: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
  delivered: 0,
  bounced: 0,
  complained: 0,
};

/** Delivery counts for a campaign: by send status, then by what Resend reported. */
export async function deliveryCounts(campaignId: string, client: Db = db()): Promise<DeliveryCounts> {
  const statuses = ["queued", "sending", "sent", "failed", "skipped"] as const;
  const events = [
    ["delivered", "delivered_at"],
    ["bounced", "bounced_at"],
    ["complained", "complained_at"],
  ] as const;
  const head = () =>
    client.from("newsletter_deliveries").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);
  const counts = await Promise.all([
    ...statuses.map(async (status) => {
      const { count } = await head().eq("status", status);
      return [status, count ?? 0] as const;
    }),
    ...events.map(async ([key, column]) => {
      const { count } = await head().not(column, "is", null);
      return [key, count ?? 0] as const;
    }),
  ]);
  return { ...EMPTY_DELIVERY_COUNTS, ...Object.fromEntries(counts) };
}
