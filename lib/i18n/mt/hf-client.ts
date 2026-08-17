/**
 * An `MtClient` backed by Hugging Face, so the pipeline is not tied to one
 * vendor's key.
 *
 * ## Why this is small
 *
 * `MtClient` (`translate.ts`) is a six-field structural interface, not the
 * Anthropic SDK's type. That was deliberate — it exists so the fakes in
 * `translate.test.ts` can satisfy it — and the payoff arrives here: a second
 * provider is one adapter and three one-line swaps at the construction sites,
 * with `translateField`, the masking, the glossary, the validator and both
 * gates untouched.
 *
 * ## What actually differs
 *
 * Hugging Face's router speaks OpenAI chat-completions, which puts the system
 * prompt in the message array rather than in its own field, and returns
 * `choices[].message.content` rather than a content-block list. Both are
 * mechanical. The one semantic difference worth naming is `stop_reason`:
 * Anthropic reports `"refusal"` as a distinct stop reason and `translateField`
 * has a whole re-roll path keyed on it. OpenAI-shaped APIs have no equivalent,
 * so a refusal arrives as ordinary text and is caught one layer later by
 * `validate`'s `refusal` code instead. That is a real loss of precision, not a
 * detail — it costs a retry that would otherwise have been cheap.
 *
 * ## What this does NOT change
 *
 * Nothing about what ships. The structural checks, the back-translation and the
 * equivalence comparator are all model-agnostic, so a weaker generator lowers
 * the PASS RATE and not the quality of what lands: more strings stay English,
 * none get worse. That is the property the gates were built for, and it is what
 * makes trying a different model a cheap experiment rather than a gamble.
 */
import type { MtClient } from "./translate";

/** The OpenAI-compatible router. Individual providers sit behind it. */
const HF_ROUTER = "https://router.huggingface.co/v1/chat/completions";

export type HfOptions = {
  token: string;
  /** Provider-qualified, e.g. `Qwen/Qwen2.5-72B-Instruct`. */
  model: string;
  baseUrl?: string;
  /** Retries on 429/5xx. The router cold-starts, and volume runs hit both. */
  maxRetries?: number;
  /**
   * Base backoff, doubled per attempt. Injectable so the retry tests assert
   * the behaviour without sleeping seven seconds to do it — a test that has to
   * wait out a real backoff is one somebody eventually deletes.
   */
  backoffMs?: number;
};

type ChatResponse = {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string } | string;
};

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export function huggingFaceClient(opts: HfOptions): MtClient {
  const url = opts.baseUrl ?? HF_ROUTER;
  const maxRetries = opts.maxRetries ?? 4;
  const backoffBase = opts.backoffMs ?? 1000;

  return {
    messages: {
      async create(args) {
        /*
         * System prompt as the first message.
         *
         * `MtClient` keeps `system` separate because that is Anthropic's shape
         * and because the register prompts are long enough to be worth naming.
         * Folding it in here rather than changing the interface keeps the
         * Anthropic path — still the default — exactly as it was.
         */
        const body = {
          model: opts.model,
          max_tokens: args.max_tokens,
          messages: [
            { role: "system", content: args.system },
            ...args.messages,
          ],
          // The translator is not a creative task: the same English should give
          // the same Arabic, which is the invariant `messages.test.ts` asserts.
          temperature: 0,
        };

        let lastError = "";
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          let res: Response;
          try {
            res = await fetch(url, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${opts.token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });
          } catch (e) {
            lastError = (e as Error).message;
            await backoff(attempt, backoffBase);
            continue;
          }

          if (!res.ok) {
            lastError = `${res.status} ${await res.text().catch(() => "")}`.slice(0, 300);
            // 401 and 404 will not fix themselves; a bad token or a model name
            // nobody serves should fail loudly on the first call rather than
            // after four silent backoffs.
            if (!RETRYABLE.has(res.status)) {
              throw new Error(`[hf] ${lastError}`);
            }
            await backoff(attempt, backoffBase);
            continue;
          }

          const json = (await res.json()) as ChatResponse;
          const choice = json.choices?.[0];
          const text = choice?.message?.content ?? "";
          return {
            content: [{ type: "text", text }],
            /*
             * Mapped as faithfully as the shape allows, and no further.
             *
             * `translateField` only branches on `"refusal"`, which OpenAI-shaped
             * APIs do not report — a refusal arrives as ordinary text and is
             * caught by `validate`'s `refusal` code instead. Inventing the value
             * here would be worse than not having it: the re-roll path would
             * fire on outputs that were merely truncated.
             */
            stop_reason: choice?.finish_reason ?? null,
          };
        }
        throw new Error(`[hf] gave up after ${maxRetries + 1} attempts: ${lastError}`);
      },
    },
  };
}

function backoff(attempt: number, base: number): Promise<void> {
  // 1s, 2s, 4s, 8s by default. The router cold-starts a model on first call and
  // a volume run will meet that repeatedly.
  return new Promise((r) => setTimeout(r, base * 2 ** attempt));
}

/**
 * The client a script should use, chosen from the environment.
 *
 * Anthropic stays the default because every calibration number in this repo —
 * the 8/8 known-bad recall, the 25% false-positive rate, the register
 * decisions — was measured against it. Switching provider silently would
 * invalidate all of them without saying so.
 */
export async function mtClientFromEnv(): Promise<{
  client: MtClient;
  proseModel: string;
  fastModel: string;
  provider: "anthropic" | "huggingface";
}> {
  const hfToken = process.env.HF_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  /*
   * An explicit choice beats the heuristic, because "the key is set" and "the
   * key works" are different things.
   *
   * This repo's `ANTHROPIC_API_KEY` was revoked mid-session while still sitting
   * in `.env.local`, so a present-means-preferred rule picks a dead key and
   * fails every call. Probing it would cost a request per run and still race
   * with the next revocation; saying which provider you want does not.
   */
  const forced = process.env.MT_PROVIDER;
  if (forced && forced !== "anthropic" && forced !== "huggingface") {
    throw new Error(`MT_PROVIDER must be "anthropic" or "huggingface", got "${forced}"`);
  }

  if (forced === "huggingface") {
    if (!hfToken) throw new Error("MT_PROVIDER=huggingface but HF_TOKEN is not set.");
    const prose = process.env.HF_MODEL ?? "Qwen/Qwen2.5-72B-Instruct";
    return {
      client: huggingFaceClient({ token: hfToken, model: prose }),
      proseModel: prose,
      fastModel: process.env.HF_MODEL_FAST ?? prose,
      provider: "huggingface",
    };
  }

  if (anthropicKey && forced !== "huggingface") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { MT_MODEL_PROSE } = await import("./translate");
    return {
      client: new Anthropic({ apiKey: anthropicKey }) as unknown as MtClient,
      proseModel: MT_MODEL_PROSE,
      fastModel: "claude-haiku-4-5-20251001",
      provider: "anthropic",
    };
  }

  if (hfToken) {
    const prose = process.env.HF_MODEL ?? "Qwen/Qwen2.5-72B-Instruct";
    const fast = process.env.HF_MODEL_FAST ?? prose;
    return {
      client: huggingFaceClient({ token: hfToken, model: prose }),
      proseModel: prose,
      fastModel: fast,
      provider: "huggingface",
    };
  }

  throw new Error(
    "No model credentials. Set ANTHROPIC_API_KEY, or HF_TOKEN for the " +
      "Hugging Face router (optionally HF_MODEL to pick the model).",
  );
}
