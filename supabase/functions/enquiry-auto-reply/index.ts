/**
 * BF-6 — Supabase Edge Function: enquiry-auto-reply.
 *
 * Triggered by a Postgres webhook on `enquiries` INSERT (see
 * supabase/migrations/0030_enquiry_auto_reply_trigger.sql) for
 * sub-minute auto-acknowledgement of new enquiries. The Sprint 10
 * /api/cron/enquiry-auto-reply route remains as a 1-minute fallback
 * sweep — both write to enquiries.ack_sent_at, so dual-firing is safe.
 *
 * Deployment:
 *   supabase functions deploy enquiry-auto-reply --no-verify-jwt
 *
 * The function expects two secrets (set via `supabase secrets set`):
 *   RESEND_API_KEY        — sent over fetch to api.resend.com
 *   RESEND_FROM_ADDRESS   — display + envelope sender
 *   NEXT_PUBLIC_SITE_URL  — for siteUrl() in templates (optional)
 *
 * Falls back to ack-but-don't-send when RESEND_API_KEY is absent so
 * the function is safe to deploy before the email integration is live.
 */

// Edge runtime: Deno globals are ambient at deploy time. Excluded from
// the host project's tsc via supabase/functions/** in tsconfig.json.

interface EnquiryRow {
  id: string;
  name: string | null;
  email: string | null;
  brief_raw: string | null;
  property_id: string | null;
  ack_sent_at: string | null;
}

interface PostgresWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: EnquiryRow;
  old_record?: EnquiryRow | null;
  schema: string;
}

const RESEND_API = "https://api.resend.com/emails";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

function siteUrl(): string {
  const u = Deno.env.get("NEXT_PUBLIC_SITE_URL");
  return (u ?? "https://bazar-real-estate-cms.vercel.app").replace(/\/+$/, "");
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c: string) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function renderTemplate(opts: {
  name: string;
  message: string;
  propertyReference: string | null;
}): { subject: string; html: string; text: string } {
  const refLine = opts.propertyReference
    ? `For ${opts.propertyReference}`
    : "";
  const subject = opts.propertyReference
    ? `We received your brief on ${opts.propertyReference}`
    : "We received your brief";
  const text =
    `Hello ${opts.name},\n\n` +
    `Thank you for getting in touch with Bazar.\n\n` +
    (refLine ? `${refLine}\n\n` : "") +
    `One of our advisors will reach out within two hours during business ` +
    `hours, and by next morning otherwise.\n\n` +
    `Your message:\n` +
    `> ${opts.message.replace(/\n/g, "\n> ")}\n\n` +
    `— Bazar\n${siteUrl()}\n`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;background:#FAFAF6;color:#1B1A17;padding:24px">
<div style="max-width:540px;margin:0 auto">
  <div style="font-family:Georgia,serif;font-style:italic;font-size:22px;margin-bottom:24px">Bazar <span style="font-family:sans-serif;font-style:normal;font-size:12px;letter-spacing:.05em;color:#7d8e7e">· Abu Dhabi</span></div>
  <p>Hello ${escape(opts.name)},</p>
  <p>Thank you for getting in touch with Bazar.</p>
  ${refLine ? `<p style="font-size:13px;color:#5a5a55">${escape(refLine)}</p>` : ""}
  <p>One of our advisors will reach out within <strong>two hours during business hours</strong>, and by next morning otherwise.</p>
  <p style="margin-top:20px;padding:12px 16px;background:#fff;border-left:3px solid #4B5A4C;font-style:italic;color:#32312d">${escape(opts.message).replace(/\n/g, "<br>")}</p>
</div></body></html>`;
  return { subject, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let payload: PostgresWebhookPayload;
  try {
    payload = (await req.json()) as PostgresWebhookPayload;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "enquiries") {
    return new Response("ignored", { status: 200 });
  }

  const row = payload.record;
  if (!row.email || row.ack_sent_at) {
    return new Response("nothing to do", { status: 200 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddr =
    Deno.env.get("RESEND_FROM_ADDRESS") ?? "Bazar <hello@bazar.ae>";

  // Resolve property reference inline via service-role REST (no
  // supabase-js dep in Edge runtime).
  let propertyReference: string | null = null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (row.property_id && supabaseUrl && serviceRole) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/properties?id=eq.${row.property_id}&select=reference`,
        {
          headers: {
            apikey: serviceRole,
            Authorization: `Bearer ${serviceRole}`,
          },
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { reference: string }[];
        propertyReference = data[0]?.reference ?? null;
      }
    } catch {
      // Best-effort; falls through to null reference.
    }
  }

  if (!apiKey) {
    // No email — but still mark ack so the fallback cron doesn't dupe.
    await markAcked(row.id);
    return new Response(
      JSON.stringify({ ok: true, skipped: "no resend api key" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const tpl = renderTemplate({
    name: row.name ?? "there",
    message: row.brief_raw ?? "",
    propertyReference,
  });

  const sendRes = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddr,
      to: row.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    }),
  });

  if (!sendRes.ok) {
    const reason = await sendRes.text().catch(() => "");
    return new Response(
      JSON.stringify({ ok: false, reason: reason.slice(0, 200) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  await markAcked(row.id);
  return new Response(JSON.stringify({ ok: true, ack_sent: true }), {
    headers: { "Content-Type": "application/json" },
  });

  async function markAcked(enquiryId: string) {
    if (!supabaseUrl || !serviceRole) return;
    await fetch(`${supabaseUrl}/rest/v1/enquiries?id=eq.${enquiryId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ ack_sent_at: new Date().toISOString() }),
    });
  }
});
