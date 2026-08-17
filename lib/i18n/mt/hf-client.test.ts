/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { huggingFaceClient } from "./hf-client";

const ok = (text: string, finish = "stop") =>
  new Response(
    JSON.stringify({ choices: [{ message: { content: text }, finish_reason: finish }] }),
    { status: 200 },
  );

afterEach(() => vi.unstubAllGlobals());

function stub(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const r of responses) fetchMock.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const call = (client: ReturnType<typeof huggingFaceClient>) =>
  client.messages.create({
    model: "ignored",
    max_tokens: 256,
    system: "You translate English to Arabic.",
    messages: [{ role: "user", content: "Submit" }],
  });

describe("huggingFaceClient", () => {
  it("returns the text in the content-block shape MtClient expects", async () => {
    stub(ok("إرسال"));
    const out = await call(huggingFaceClient({ token: "t", model: "m" }));
    expect(out.content).toEqual([{ type: "text", text: "إرسال" }]);
  });

  it("folds the system prompt into the message array", async () => {
    // `MtClient` keeps `system` separate because that is Anthropic's shape.
    // OpenAI-compatible APIs do not, and losing the register prompt here would
    // be invisible — the model would answer, just in the wrong voice.
    const fetchMock = stub(ok("إرسال"));
    await call(huggingFaceClient({ token: "t", model: "m" }));
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.messages[0]).toEqual({
      role: "system",
      content: "You translate English to Arabic.",
    });
    expect(body.messages[1]).toEqual({ role: "user", content: "Submit" });
  });

  it("pins temperature to 0", async () => {
    // The same English must give the same Arabic — `messages.test.ts` asserts
    // it, and a sampling default would break it silently across re-runs.
    const fetchMock = stub(ok("إرسال"));
    await call(huggingFaceClient({ token: "t", model: "m" }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string).temperature).toBe(0);
  });

  it("sends the token as a bearer", async () => {
    const fetchMock = stub(ok("x"));
    await call(huggingFaceClient({ token: "hf_secret", model: "m" }));
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer hf_secret");
  });

  it("retries a 429 and succeeds", async () => {
    // The router cold-starts and rate-limits; a volume run meets both.
    const fetchMock = stub(new Response("slow down", { status: 429 }), ok("إرسال"));
    const out = await call(huggingFaceClient({ token: "t", model: "m", maxRetries: 1, backoffMs: 1 }));
    expect(out.content[0]!.text).toBe("إرسال");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails loudly on 401 instead of backing off four times", async () => {
    // A bad token will not fix itself. Retrying it turns a one-second error
    // into a fifteen-second one and buries the cause.
    const fetchMock = stub(new Response("bad token", { status: 401 }));
    await expect(call(huggingFaceClient({ token: "t", model: "m" }))).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget rather than hanging", async () => {
    stub(
      new Response("", { status: 503 }),
      new Response("", { status: 503 }),
      new Response("", { status: 503 }),
    );
    await expect(
      call(huggingFaceClient({ token: "t", model: "m", maxRetries: 2, backoffMs: 1 })),
    ).rejects.toThrow(/gave up after 3 attempts/);
  });

  it("passes finish_reason through without inventing a refusal", async () => {
    /*
     * `translateField` branches on `stop_reason === "refusal"` and re-rolls.
     * OpenAI-shaped APIs have no such value, so mapping one in would fire that
     * path on output that was merely truncated.
     */
    stub(ok("partial", "length"));
    const out = await call(huggingFaceClient({ token: "t", model: "m" }));
    expect(out.stop_reason).toBe("length");
    expect(out.stop_reason).not.toBe("refusal");
  });
});

describe("mtClientFromEnv", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("honours an explicit MT_PROVIDER over a key that happens to be set", async () => {
    /*
     * The case that made this necessary: `ANTHROPIC_API_KEY` was revoked
     * mid-session while still sitting in `.env.local`. "Set" and "works" are
     * different things, and a present-means-preferred rule picks the dead one.
     */
    const { mtClientFromEnv } = await import("./hf-client");
    process.env.ANTHROPIC_API_KEY = "sk-ant-revoked";
    process.env.HF_TOKEN = "hf_live";
    process.env.MT_PROVIDER = "huggingface";
    const { provider } = await mtClientFromEnv();
    expect(provider).toBe("huggingface");
  });

  it("still prefers Anthropic when nothing is forced", async () => {
    // Every calibration figure in the repo was measured against it, so the
    // default must not drift silently.
    const { mtClientFromEnv } = await import("./hf-client");
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    process.env.HF_TOKEN = "hf_x";
    delete process.env.MT_PROVIDER;
    const { provider } = await mtClientFromEnv();
    expect(provider).toBe("anthropic");
  });

  it("rejects a provider name it does not know", async () => {
    const { mtClientFromEnv } = await import("./hf-client");
    process.env.MT_PROVIDER = "ollama";
    await expect(mtClientFromEnv()).rejects.toThrow(/MT_PROVIDER/);
  });

  it("says what to set when there are no credentials at all", async () => {
    const { mtClientFromEnv } = await import("./hf-client");
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.HF_TOKEN;
    delete process.env.MT_PROVIDER;
    await expect(mtClientFromEnv()).rejects.toThrow(/HF_TOKEN/);
  });
});
