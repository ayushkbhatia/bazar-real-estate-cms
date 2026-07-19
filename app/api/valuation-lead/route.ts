/**
 * T1-E: Valuation lead-gate funnel.
 *
 * Two POST actions, switched on `body.action`:
 *
 *   - `issue` — accepts { email, phone?, name?, intent?, valuation_aed?,
 *     property_summary? }. Issues an OTP, emails it via Resend.
 *
 *   - `verify` — accepts { email, code, plus the same valuation payload }.
 *     Verifies the OTP, enqueues an enquiries row with intent
 *     'valuation_report', and emails the prepared report link.
 *
 * Pattern matches `/api/pdf/*` server actions: same env validation, same
 * authoring style, lives outside the (admin) auth wall.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const issueSchema = z.object({
  action: z.literal("issue"),
  email: z.string().email(),
  phone: z.string().optional(),
  name: z.string().min(1).max(120).optional(),
  intent: z.enum(["sell", "refinance", "curious", "other"]).optional(),
  /** The just-displayed midpoint estimate so the email can echo it back. */
  valuation_aed: z.number().int().nonnegative().optional(),
  property_summary: z.string().max(280).optional(),
});

const verifySchema = z.object({
  action: z.literal("verify"),
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  phone: z.string().optional(),
  name: z.string().min(1).max(120).optional(),
  intent: z.enum(["sell", "refinance", "curious", "other"]).optional(),
  valuation_aed: z.number().int().nonnegative().optional(),
  property_summary: z.string().max(280).optional(),
});

const bodySchema = z.discriminatedUnion("action", [issueSchema, verifySchema]);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  if (data.action === "issue") {
    try {
      const { code, expires_at } = await issueOtp({
        identifier: data.email,
        channel: "email",
        purpose: "valuation_lead",
        ip,
        user_agent: userAgent,
      });

      // Best-effort email; skipped silently if Resend not configured.
      await sendEmail({
        to: data.email,
        subject: `Your Bazar valuation code: ${code}`,
        text: `Your one-time code is ${code}. It expires in 10 minutes.\n\n— Bazar Real Estate`,
        html: `
          <div style="font-family:system-ui;color:#1B1A17">
            <p style="font-size:14px">Your one-time code:</p>
            <p style="font-family:'Courier New',monospace;font-size:28px;letter-spacing:6px;color:#1B1A17;margin:12px 0">${code}</p>
            <p style="font-size:13px;color:#99896e">Expires in 10 minutes. If you didn't request this, you can ignore it.</p>
          </div>
        `,
      });

      // In dev (no RESEND key), surface the code in the response so we can
      // hand-test the verify step. Production always returns the safe shape.
      if (env.NODE_ENV !== "production" && !env.RESEND_API_KEY) {
        return NextResponse.json({ ok: true, expires_at, debug_code: code });
      }
      return NextResponse.json({ ok: true, expires_at });
    } catch (err) {
      console.error("[valuation-lead] issue failed", err);
      return NextResponse.json(
        { error: "Could not issue code right now. Try again shortly." },
        { status: 503 },
      );
    }
  }

  // verify
  try {
    const result = await verifyOtp({
      identifier: data.email,
      code: data.code,
      purpose: "valuation_lead",
    });
    if (!result.ok) {
      const map: Record<string, { status: number; message: string }> = {
        expired: { status: 410, message: "Code expired. Request a new one." },
        wrong: { status: 401, message: "Code didn't match." },
        locked: {
          status: 429,
          message: "Too many attempts. Request a new code in a few minutes.",
        },
        not_found: {
          status: 404,
          message: "No active code for this email. Request a new one.",
        },
      };
      const info = map[result.reason ?? "wrong"]!;
      return NextResponse.json({ error: info.message }, { status: info.status });
    }

    // Enqueue an enquiry row so the assigned advisor picks it up.
    try {
      const supabase = createAdminClient();
      if (!supabase) {
        console.warn("[valuation-lead] enqueue skipped — admin client unavailable");
        return NextResponse.json({ ok: true });
      }
      const briefRaw =
        `Valuation report requested.\n` +
        (data.valuation_aed
          ? `Instant midpoint estimate: AED ${data.valuation_aed.toLocaleString()}.\n`
          : "") +
        (data.property_summary ? `Property: ${data.property_summary}\n` : "") +
        (data.intent ? `Intent: ${data.intent}` : "");
      await supabase.from("enquiries").insert({
        name: data.name ?? "Valuation lead",
        email: data.email,
        phone: data.phone ?? null,
        brief_raw: briefRaw,
        source: "valuation" as const,
      });
    } catch (err) {
      // Enqueue failure shouldn't block the success response — log + continue.
      console.warn("[valuation-lead] enqueue failed", err);
    }

    // Send the confirmation email
    await sendEmail({
      to: data.email,
      subject: "Your Bazar valuation report is on the way",
      text: `Thanks — a Bazar advisor will review the figures and send you the full report within 24 hours.\n\n— Bazar Real Estate`,
      html: `
        <div style="font-family:system-ui;color:#1B1A17">
          <p style="font-size:14px">Thanks for verifying.</p>
          <p style="font-size:14px;line-height:1.6">A Bazar advisor will review your property details, sense-check the instant estimate against the latest comparables, and send you the full advisor-prepared report within 24 hours.</p>
          <p style="font-size:13px;color:#99896e">Questions in the meantime? Reply to this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[valuation-lead] verify failed", err);
    return NextResponse.json(
      { error: "Verification failed. Try again." },
      { status: 500 },
    );
  }
}
