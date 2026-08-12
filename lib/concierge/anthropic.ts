/**
 * Anthropic client wrapper + the function-calling loop for the concierge.
 *
 * Cost shape:
 *   - Default model is Claude Haiku 4.5 (fast + cheap, sufficient for tool
 *     routing + the conversational layer the concierge needs).
 *   - Hard cap: 50_000 input tokens per session (`MAX_INPUT_TOKENS_PER_SESSION`).
 *   - Anonymous sessions: 5 turns max (`MAX_ANON_TURNS`).
 *
 * Tests in `route.test.ts` exercise this loop with a faked client so we never
 * call the real API in CI.
 */
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { anthropicEnv, isAnthropicConfigured } from "./env";
import {
  TOOL_HANDLERS,
  toolsForSession,
  type AnthropicTool,
  type ToolHandlerContext,
  type ToolHandlerResult,
  type ToolName,
} from "./tools";
import type { ConciergeBrief } from "./brief";

export const CONCIERGE_MODEL = "claude-haiku-4-5-20251001";
export const MAX_INPUT_TOKENS_PER_SESSION = 50_000;
export const MAX_OUTPUT_TOKENS_PER_TURN = 1500;
export const MAX_ANON_TURNS = 5;
export const MAX_TOOL_LOOPS = 6;

/**
 * Arabic needs roughly 2.5x the tokens of the equivalent English, because the
 * script tokenises far less efficiently. Left at the English ceilings, an
 * Arabic reply that says the same thing as a comfortable English one truncates
 * mid-sentence — `stop_reason: "max_tokens"` — and the visitor sees the
 * concierge stop talking halfway through a paragraph.
 *
 * 2x rather than 2.5x on output: the prompt asks for 1-3 short paragraphs, so
 * the English cap already has headroom the Arabic one is borrowing.
 */
const AR_TOKEN_MULTIPLIER = 2;

export function maxOutputTokens(locale: Locale): number {
  return locale === "ar"
    ? MAX_OUTPUT_TOKENS_PER_TURN * AR_TOKEN_MULTIPLIER
    : MAX_OUTPUT_TOKENS_PER_TURN;
}

export function maxSessionInputTokens(locale: Locale): number {
  return locale === "ar"
    ? MAX_INPUT_TOKENS_PER_SESSION * AR_TOKEN_MULTIPLIER
    : MAX_INPUT_TOKENS_PER_SESSION;
}

export const SYSTEM_PROMPT = `You are the Bazar Concierge — a senior advisor's apprentice for bazar.ae, a boutique advisory firm in Abu Dhabi. Your job is to help buyers, renters, and investors narrow down their property brief and surface 3-5 strong matches with deterministic match scores.

Voice: editorial, numerically honest, confident. Never use emoji. Never hype. Be brief — short paragraphs, not lists, unless listing is the right shape. Refer to advisors by name (Mariam Al-Hashimi, Jameel Khan, Rana Daher) when handing off.

Workflow per turn:
1. Read the user's message + the current inferred brief.
2. If you need data, call tools. Prefer search_properties when the brief is specific; semantic_search when fuzzy.
3. Before presenting matches, ALWAYS call score_against_brief with the candidate property ids.
4. Call pin_properties with your 3-5 strongest matches so they appear in the right rail.
5. Then write a 1-3 paragraph reply. Reference the pinned cards by their match score. Suggest one clarifying question if the brief is still loose.
6. If the user wants to schedule a viewing, asks for human help, or says "send to Mariam" → call hand_off_to_advisor.

Hard rules:
- Never invent property ids, prices, or amenities. If a tool returns no matches, say so.
- Never recommend more than 5 properties at once.
- Do not promise specific viewing times; say "an advisor will reach out".
`;

/**
 * Claude usually mirrors the language it is written to, but nothing here
 * enforced it, and the voice instruction above ("editorial, numerically
 * honest") is calibrated for English. On an Arabic page a reply that drifts
 * into English reads as broken rather than multilingual.
 *
 * Tool results stay English — they carry property titles, area names and
 * reference codes, which are names rather than prose. The model is told to
 * quote them as-is so a listing is searchable by the name on its own page.
 */
const ARABIC_CLAUSE = `

LANGUAGE — this visitor is on the Arabic site:
- Reply in Modern Standard Arabic throughout. Never switch to English mid-reply, even if the visitor writes to you in English.
- Register: professional and editorial, the way a Gulf property advisory writes to a private client. Not the literal, formal register of a government circular.
- Tool results come back in English. Property titles, development names, area names and reference codes are NAMES — reproduce them verbatim in Latin script rather than translating them, so they match what is printed on the listing.
- Keep all numerals in Western digits (0-9). Prices, areas, dates and reference codes must be reproduced exactly as the tools return them.
- Say تملك حر for freehold and حق انتفاع for leasehold. Never render leasehold as إيجار — that describes a rental and misstates what is being sold.
- Refer to Bazar's people as مستشار (advisor), never وكيل (agent).`;

export function systemPromptFor(locale: Locale = DEFAULT_LOCALE): string {
  return locale === "ar" ? SYSTEM_PROMPT + ARABIC_CLAUSE : SYSTEM_PROMPT;
}

type AnthropicLikeClient = Pick<Anthropic, "messages">;

export function getAnthropicClient(): AnthropicLikeClient | null {
  if (!isAnthropicConfigured) return null;
  return new Anthropic({ apiKey: anthropicEnv.ANTHROPIC_API_KEY });
}

// ───────────────────────────────────────────────────────────────
// Loop types
// ───────────────────────────────────────────────────────────────
export type ConversationMessage = {
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
          }
        | {
            type: "tool_result";
            tool_use_id: string;
            content: string;
          }
      >;
};

export type LoopUpdate =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; name: ToolName; input: Record<string, unknown>; id: string }
  | { kind: "tool_result"; name: ToolName; result: unknown }
  | { kind: "state_patch"; patch: NonNullable<ToolHandlerResult["state"]> }
  | { kind: "tokens"; input: number; output: number }
  | { kind: "done"; reason: "stop_sequence" | "end_turn" | "max_tokens" | "tool_use" | "error"; error?: string };

export type LoopOptions = {
  client: AnthropicLikeClient;
  messages: ConversationMessage[];
  brief: ConciergeBrief;
  pinnedIds: string[];
  anonymous: boolean;
  totalInputTokensSoFar: number;
  /** Defaults to English so existing callers and specs are unaffected. */
  locale?: Locale;
};

/**
 * Drive a function-calling loop with Claude. Yields `LoopUpdate`s as it
 * goes — the route handler converts these to SSE frames.
 *
 * The loop stops when:
 *   - The model returns `stop_reason: "end_turn"` (it's done answering).
 *   - We exceed MAX_TOOL_LOOPS (safety net).
 *   - Cumulative input tokens exceed MAX_INPUT_TOKENS_PER_SESSION.
 */
export async function* runConciergeLoop(
  opts: LoopOptions,
): AsyncGenerator<LoopUpdate> {
  const tools = toolsForSession({ anonymous: opts.anonymous });
  const locale = opts.locale ?? DEFAULT_LOCALE;
  const inputBudget = maxSessionInputTokens(locale);
  let messages: ConversationMessage[] = [...opts.messages];
  let inputTokens = opts.totalInputTokensSoFar;

  for (let iter = 0; iter < MAX_TOOL_LOOPS; iter++) {
    if (inputTokens >= inputBudget) {
      yield {
        kind: "done",
        reason: "error",
        error: `Session token budget exceeded (${inputTokens}/${inputBudget}). Start a new brief.`,
      };
      return;
    }

    let response;
    try {
      response = await opts.client.messages.create({
        model: CONCIERGE_MODEL,
        system: systemPromptFor(locale),
        max_tokens: maxOutputTokens(locale),
        tools: tools as unknown as Anthropic.Messages.Tool[],
        messages: messages as unknown as Anthropic.Messages.MessageParam[],
      });
    } catch (err) {
      yield {
        kind: "done",
        reason: "error",
        error: (err as Error).message ?? "Anthropic call failed.",
      };
      return;
    }

    const usage = response.usage;
    if (usage) {
      inputTokens += usage.input_tokens ?? 0;
      yield {
        kind: "tokens",
        input: usage.input_tokens ?? 0,
        output: usage.output_tokens ?? 0,
      };
    }

    const toolUses: Array<{
      id: string;
      name: ToolName;
      input: Record<string, unknown>;
    }> = [];

    const assistantContent: ConversationMessage["content"] = [];

    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        yield { kind: "text", text: block.text };
        assistantContent.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        const name = block.name as ToolName;
        if (!TOOL_HANDLERS[name]) {
          yield {
            kind: "done",
            reason: "error",
            error: `Unknown tool: ${block.name}`,
          };
          return;
        }
        toolUses.push({
          id: block.id,
          name,
          input: block.input as Record<string, unknown>,
        });
        assistantContent.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    messages = [...messages, { role: "assistant", content: assistantContent }];

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      yield {
        kind: "done",
        reason:
          (response.stop_reason as "stop_sequence" | "end_turn" | "max_tokens") ??
          "end_turn",
      };
      return;
    }

    // Run the tools in parallel, then feed results back.
    const ctx: ToolHandlerContext = {
      brief: opts.brief,
      pinnedIds: opts.pinnedIds,
    };
    const toolResults = await Promise.all(
      toolUses.map(async (call) => {
        const handler = TOOL_HANDLERS[call.name];
        try {
          const r = await handler(call.input, ctx);
          return { call, result: r };
        } catch (err) {
          return {
            call,
            result: {
              output: { error: (err as Error).message ?? "Tool failed." },
            } satisfies ToolHandlerResult,
          };
        }
      }),
    );

    for (const { call, result } of toolResults) {
      yield {
        kind: "tool_use",
        name: call.name,
        input: call.input,
        id: call.id,
      };
      yield { kind: "tool_result", name: call.name, result: result.output };
      if (result.state) yield { kind: "state_patch", patch: result.state };
    }

    const toolResultBlocks: ConversationMessage["content"] = toolResults.map(
      ({ call, result }) => ({
        type: "tool_result" as const,
        tool_use_id: call.id,
        content: JSON.stringify(result.output),
      }),
    );
    messages = [...messages, { role: "user", content: toolResultBlocks }];
  }

  yield {
    kind: "done",
    reason: "error",
    error: `Tool loop exceeded ${MAX_TOOL_LOOPS} iterations.`,
  };
}

export type { AnthropicTool };
