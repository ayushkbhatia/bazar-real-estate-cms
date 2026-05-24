/**
 * POST /api/concierge
 * Body: { sessionId?: string, message: string, briefPatch?: Partial<ConciergeBrief> }
 *
 * Streams Server-Sent Events for the function-calling loop. Each frame is a
 * single `data:` JSON line of type `LoopUpdate`.
 *
 *  • If `sessionId` is omitted (or unknown), a new session is created. For
 *    anon users we mint an `anon_token` and set it via Set-Cookie.
 *  • The first frame is always `{ kind: "session", id, anonToken? }`. The
 *    client should latch on to that id for future turns.
 *  • Live Anthropic calls are skipped when `ANTHROPIC_API_KEY` is unset; the
 *    route returns 503 in that case so the UI can render a graceful fallback.
 */
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isAnthropicConfigured } from "@/lib/concierge/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  conciergeBriefSchema,
  type ConciergeBrief,
} from "@/lib/concierge/brief";
import {
  COOKIE_NAME,
  appendMessages,
  createSession,
  isOverAnonLimit,
  loadSession,
  updateSession,
  type ConciergeSessionRow,
} from "@/lib/concierge/session";
import {
  getAnthropicClient,
  runConciergeLoop,
  MAX_ANON_TURNS,
} from "@/lib/concierge/anthropic";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  briefPatch: conciergeBriefSchema.partial().optional(),
});

export async function POST(req: NextRequest) {
  if (!isAnthropicConfigured) {
    return new Response(
      JSON.stringify({
        error:
          "ANTHROPIC_API_KEY is not set. The concierge is disabled in this environment.",
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  // Per-IP rate cap. Token-budget gating still applies further down — this
  // adds a request-rate ceiling so a single client can't burst the LLM.
  const rl = await checkRateLimit({
    name: "concierge",
    ip: extractClientIp(req.headers),
    requests: 20,
    windowSeconds: 60,
  });
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: rateLimitMessage(rl.retryAfterSeconds) }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(rl.retryAfterSeconds),
        },
      },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid request body.", issues: parsed.error.issues }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  const { sessionId, message, briefPatch } = parsed.data;

  // Resolve identity.
  const cookieStore = await cookies();
  let userId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  let anonToken: string | null = userId
    ? null
    : (cookieStore.get(COOKIE_NAME)?.value ?? null);

  // Load or create the session.
  let session: ConciergeSessionRow | null = null;
  if (sessionId) {
    session = await loadSession(sessionId, { userId, anonToken });
  }
  let isNewSession = false;
  if (!session) {
    if (!userId && !anonToken) anonToken = crypto.randomUUID();
    session = await createSession({ userId, anonToken });
    isNewSession = true;
  }

  if (isOverAnonLimit(session)) {
    return new Response(
      JSON.stringify({
        error: `Anonymous sessions are capped at ${MAX_ANON_TURNS} turns. Sign in to continue.`,
        sign_in_required: true,
      }),
      { status: 402, headers: { "content-type": "application/json" } },
    );
  }

  // Apply brief patch from the client (e.g. when a user removes a chip).
  if (briefPatch) {
    await updateSession(session.id, { brief: briefPatch });
    session = (await loadSession(session.id, { userId, anonToken })) ?? session;
  }

  const client = getAnthropicClient();
  if (!client) {
    return new Response(
      JSON.stringify({ error: "Anthropic client unavailable." }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  // Persist the user message.
  await appendMessages(session.id, [{ role: "user", content: message }]);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(frame: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      }

      send({
        kind: "session",
        id: session!.id,
        anonToken,
        isNewSession,
        brief: session!.brief,
        pinnedIds: session!.pinned_property_ids,
      });

      const loopMessages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: briefContextPreamble(session!.brief) },
            { type: "text" as const, text: message },
          ],
        },
      ];

      let inputTokensThisTurn = 0;
      let outputTokensThisTurn = 0;
      const collectedAssistantText: string[] = [];
      const collectedToolEvents: Array<{ name: string; result: unknown }> = [];
      let statePatch: {
        pinned_property_ids?: string[];
        hand_off?: { message?: string };
      } = {};

      try {
        for await (const update of runConciergeLoop({
          client,
          messages: loopMessages,
          brief: session!.brief,
          pinnedIds: session!.pinned_property_ids,
          anonymous: userId === null,
          totalInputTokensSoFar: session!.input_tokens,
        })) {
          send(update);
          if (update.kind === "text") collectedAssistantText.push(update.text);
          if (update.kind === "tokens") {
            inputTokensThisTurn += update.input;
            outputTokensThisTurn += update.output;
          }
          if (update.kind === "tool_result")
            collectedToolEvents.push({ name: update.name, result: update.result });
          if (update.kind === "state_patch") statePatch = { ...statePatch, ...update.patch };
        }
      } catch (err) {
        send({
          kind: "done",
          reason: "error",
          error: (err as Error).message ?? "Loop crashed.",
        });
      }

      // Persist the assistant turn.
      await appendMessages(session!.id, [
        {
          role: "assistant",
          content: collectedAssistantText.join("\n"),
          tool_use: collectedToolEvents.length > 0 ? collectedToolEvents : null,
          input_tokens: inputTokensThisTurn,
          output_tokens: outputTokensThisTurn,
        },
      ]);
      const patches: Parameters<typeof updateSession>[1] = {
        input_tokens: session!.input_tokens + inputTokensThisTurn,
        output_tokens: session!.output_tokens + outputTokensThisTurn,
        turn_count: session!.turn_count + 1,
      };
      if (statePatch.pinned_property_ids)
        patches.pinned_property_ids = statePatch.pinned_property_ids;
      if (statePatch.hand_off) {
        patches.handed_off_at = new Date().toISOString();
      }
      await updateSession(session!.id, patches);

      controller.close();
    },
  });

  const headers = new Headers({
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no",
  });
  if (anonToken && isNewSession) {
    headers.append(
      "set-cookie",
      `${COOKIE_NAME}=${anonToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    );
  }

  return new Response(stream, { status: 200, headers });
}

/** Compact preamble that gives Claude the current brief without us serialising
 *  the whole conversation history each turn. */
function briefContextPreamble(brief: ConciergeBrief): string {
  const parts: string[] = ["[CURRENT_BRIEF]"];
  if (brief.mode) parts.push(`mode=${brief.mode}`);
  if (brief.area_slugs?.length)
    parts.push(`areas=${brief.area_slugs.join(",")}`);
  if (brief.property_types?.length)
    parts.push(`types=${brief.property_types.join(",")}`);
  if (brief.beds_min != null) parts.push(`beds_min=${brief.beds_min}`);
  if (brief.beds_max != null) parts.push(`beds_max=${brief.beds_max}`);
  if (brief.price_min != null) parts.push(`price_min=${brief.price_min}`);
  if (brief.price_max != null) parts.push(`price_max=${brief.price_max}`);
  if (brief.must_have_amenities?.length)
    parts.push(`amenities=${brief.must_have_amenities.join("|")}`);
  if (brief.free_text_hints?.length)
    parts.push(`hints=${brief.free_text_hints.join("|")}`);
  if (parts.length === 1) parts.push("(empty)");
  parts.push("[/CURRENT_BRIEF]");
  return parts.join(" ");
}
