"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  RefreshCw,
  X,
  Sparkles,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import type { ConciergeBrief, BriefChip } from "@/lib/concierge/brief";
import { formatBriefForWhatsApp } from "@/lib/concierge/handoff";
import { buildAdvisorWhatsAppLink } from "@/lib/whatsapp";
import { formatArea, formatPrice, usePreferences } from "@/lib/preferences";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolEvents?: ToolEvent[];
  ts: number;
};

type ToolEvent = {
  name: string;
  status: "running" | "done";
  summary?: string;
};

type Scoreable = {
  id: string;
  ref: string;
  title: string;
  area: string | null;
  mode: string;
  type: string;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  price_aed: number;
};

type ScoreFactor = {
  label: string;
  status: "match" | "partial" | "miss";
  weight: number;
};

type Score = {
  property_id: string;
  score: number;
  factors: ScoreFactor[];
};

/**
 * The four starters, as message keys.
 *
 * These are the one place in this file where the English is also *input* — a
 * click sends the string to the model as the visitor's first message. That is
 * the right behaviour translated: an Arabic-reading visitor should send an
 * Arabic brief, and `lib/concierge` already carries a locale clause from P0.5.
 */
const PROMPT_SUGGESTIONS = [
  "suggestion1",
  "suggestion2",
  "suggestion3",
  "suggestion4",
] as const;

/** Shared shape for the two helpers that render tool activity. */
type T = ReturnType<typeof useTranslations>;

let tickCounter = 0;
function nextTick(): number {
  tickCounter += 1;
  return tickCounter;
}

export function ConciergeChat() {
  const t = useTranslations("tools");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [brief, setBrief] = useState<ConciergeBrief>({ chips: [] });
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [scoresById, setScoresById] = useState<Record<string, Score>>({});
  const [propsById, setPropsById] = useState<Record<string, Scoreable>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const pinnedCards = useMemo(() => {
    return pinnedIds
      .map((id) => ({
        score: scoresById[id],
        property: propsById[id],
      }))
      .filter((row) => row.property)
      .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0));
  }, [pinnedIds, scoresById, propsById]);

  async function sendMessage(text: string, briefPatch?: Partial<ConciergeBrief>) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setInput("");
    // ts/IDs only need to be unique within this session; the bumping counter
    // avoids react-hooks/purity (which forbids Date.now() during render).
    const now = nextTick();
    const userMsg: UiMessage = {
      id: `u-${now}`,
      role: "user",
      text: trimmed,
      ts: now,
    };
    const assistantMsg: UiMessage = {
      id: `a-${now}`,
      role: "assistant",
      text: "",
      toolEvents: [],
      ts: now,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const body: Record<string, unknown> = { message: trimmed };
    if (sessionId) body.sessionId = sessionId;
    if (briefPatch) body.briefPatch = briefPatch;

    try {
      const response = await fetch("/api/concierge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok || !response.body) {
        const errJson = await response.json().catch(() => ({}));
        const msg =
          errJson?.error ?? `Concierge unavailable (${response.status}).`;
        setError(msg);
        setSending(false);
        return;
      }
      await consumeStream(response.body, assistantMsg.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function consumeStream(body: ReadableStream<Uint8Array>, assistantId: string) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice("data:".length).trim();
        if (!payload) continue;
        let frame: Record<string, unknown>;
        try {
          frame = JSON.parse(payload);
        } catch {
          continue;
        }
        applyFrame(frame, assistantId);
      }
    }
  }

  function applyFrame(frame: Record<string, unknown>, assistantId: string) {
    const kind = frame.kind as string;
    if (kind === "session") {
      setSessionId(String(frame.id));
      if (frame.brief)
        setBrief(frame.brief as ConciergeBrief);
      if (Array.isArray(frame.pinnedIds))
        setPinnedIds(frame.pinnedIds as string[]);
      return;
    }
    if (kind === "text") {
      const text = String(frame.text ?? "");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, text: (m.text ?? "") + text } : m,
        ),
      );
      return;
    }
    if (kind === "tool_use") {
      const event: ToolEvent = {
        name: String(frame.name),
        status: "running",
      };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, toolEvents: [...(m.toolEvents ?? []), event] }
            : m,
        ),
      );
      return;
    }
    if (kind === "tool_result") {
      const name = String(frame.name);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;
          const events = (m.toolEvents ?? []).map((e, i, arr) => {
            if (e.name === name && e.status === "running" && i === arr.findLastIndex((x) => x.name === name && x.status === "running")) {
              return { ...e, status: "done" as const, summary: summariseResult(name, frame.result, t) };
            }
            return e;
          });
          return { ...m, toolEvents: events };
        }),
      );
      handleToolResult(name, frame.result);
      return;
    }
    if (kind === "state_patch") {
      const patch = frame.patch as { pinned_property_ids?: string[] };
      if (patch?.pinned_property_ids) setPinnedIds(patch.pinned_property_ids);
      return;
    }
    if (kind === "done") {
      if (frame.error) setError(String(frame.error));
      return;
    }
  }

  function handleToolResult(name: string, raw: unknown) {
    const result = (raw ?? {}) as Record<string, unknown>;
    if (name === "search_properties" || name === "semantic_search") {
      const rows = Array.isArray(result.results)
        ? (result.results as Array<Scoreable>)
        : [];
      setPropsById((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.id] = r;
        return next;
      });
    }
    if (name === "score_against_brief") {
      const scores = Array.isArray(result.scores)
        ? (result.scores as Score[])
        : [];
      setScoresById((prev) => {
        const next = { ...prev };
        for (const s of scores) next[s.property_id] = s;
        return next;
      });
    }
  }

  function removeChip(chip: BriefChip) {
    const newChips = (brief.chips ?? []).filter((c) => c.id !== chip.id);
    const nextBrief: ConciergeBrief = { ...brief, chips: newChips };
    // Project the chip removal back to structured fields (best-effort).
    if (chip.field === "area_slugs" && nextBrief.area_slugs) {
      nextBrief.area_slugs = nextBrief.area_slugs.filter(
        (s) => !chip.label.toLowerCase().includes(s.replace(/-/g, " ")),
      );
    }
    setBrief(nextBrief);
    // Send a quick patch turn so the next reply respects the new brief.
    sendMessage(`(brief edited: removed "${chip.label}")`, nextBrief);
  }

  function resetSession() {
    setSessionId(null);
    setMessages([]);
    setBrief({ chips: [] });
    setPinnedIds([]);
    setScoresById({});
    setPropsById({});
    setError(null);
  }

  return (
    <div className="bg-bz-bg">
      {/* Top bar */}
      <section className="px-4 md:px-12 pt-10 pb-6 border-b border-bz-border">
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <div className="eyebrow inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-bz-success" />
              {t("concierge.online")}
            </div>
            <h1
              className="serif text-[28px] md:text-[40px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              {t("concierge.headingLead")}{" "}
              <span className="text-bz-muted">·</span>{" "}
              <em
                style={{ fontStyle: "italic", fontSize: 32 }}
              >
                {t("concierge.headingEmphasis")}
              </em>
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetSession}>
              <RefreshCw size={14} strokeWidth={1.6} />
              {t("concierge.newBrief")}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] min-h-[760px] overflow-hidden border-b border-bz-border">
        {/* LEFT — Conversation */}
        <div className="flex flex-col border-e border-bz-border overflow-hidden">
          <div className="flex-1 px-4 md:px-12 py-8 flex flex-col gap-6 overflow-auto">
            {messages.length === 0 ? (
              <EmptyState onPick={sendMessage} />
            ) : null}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} t={t} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 md:px-12 pt-5 pb-8 border-t border-bz-border bg-bz-bg">
            {error ? (
              <div className="mb-3 text-[12.5px] text-bz-danger">{error}</div>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="bg-bz-surface border border-bz-border-strong rounded-2xl p-2 flex flex-col"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                rows={2}
                placeholder={t("concierge.composerPlaceholder")}
                className="border-0 px-3 py-2.5 resize-none bg-transparent outline-none text-[14px]"
              />
              <div className="flex justify-between items-center px-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => sendMessage(t("concierge.handOffPrompt"))}
                  className="text-[11.5px] text-bz-muted hover:text-bz-ink"
                >
                  {t("concierge.handOff")}
                </button>
                <Button type="submit" size="sm" disabled={sending || !input.trim()}>
                  <Send size={14} strokeWidth={1.6} />
                  {t("concierge.send")}
                </Button>
              </div>
            </form>
            <AdvisorWhatsAppHandoff brief={brief} t={t} />
            <div className="mt-4 flex gap-1.5 flex-wrap">
              <div className="eyebrow me-2 mt-1">{t("concierge.try")}</div>
              {PROMPT_SUGGESTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => sendMessage(t(`concierge.${key}`))}
                  className="h-7 px-2.5 rounded text-[11.5px] bg-bz-surface border border-bz-border text-bz-muted hover:text-bz-ink hover:border-bz-ink-2"
                >
                  {t(`concierge.${key}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Brief rail */}
        <aside className="bg-bz-surface-2 flex flex-col overflow-hidden">
          <div className="px-7 pt-6 pb-5 bg-bz-surface border-b border-bz-border">
            <Eyebrow>{t("concierge.briefHeading")}</Eyebrow>
            {(brief.chips ?? []).length === 0 ? (
              <p className="text-[12.5px] text-bz-muted mt-3">
                {t("concierge.briefEmpty")}
              </p>
            ) : (
              <div className="flex gap-1.5 flex-wrap mt-3">
                {(brief.chips ?? []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => removeChip(c)}
                    className="inline-flex items-center gap-1 h-[26px] px-2.5 rounded-full text-[12px] font-medium bg-bz-accent-soft text-bz-accent hover:bg-bz-accent hover:text-white"
                  >
                    {c.label}
                    <X size={10} strokeWidth={2} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="px-7 py-4 flex justify-between items-center text-[12px] text-bz-muted border-b border-bz-border">
            <span>
              {t("concierge.matchCount", { count: pinnedCards.length })} ·{" "}
              {t("concierge.scoredAgainst")}
            </span>
          </div>
          <div className="px-7 py-4 flex flex-col gap-2.5 overflow-auto">
            {pinnedCards.length === 0 ? (
              <div className="py-12 text-center text-[12.5px] text-bz-muted">
                {t("concierge.noPinned")}
              </div>
            ) : (
              pinnedCards.map(({ score, property }) => (
                <ResultCard
                  key={property.id}
                  property={property}
                  score={score}
                  t={t}
                />
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const t = useTranslations("tools");
  return (
    <div className="flex flex-col gap-3 items-start">
      <Eyebrow>
        <span className="inline-flex items-center gap-1">
          <Sparkles size={11} strokeWidth={1.8} />
          {t("concierge.quickStarts")}
        </span>
      </Eyebrow>
      <p className="text-[14px] text-bz-muted leading-[1.6] max-w-[60ch]">
        {t("concierge.emptyBody")}
      </p>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-[60ch]">
        {PROMPT_SUGGESTIONS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onPick(t(`concierge.${key}`))}
            className="text-start px-4 py-3 rounded-lg bg-bz-surface border border-bz-border hover:border-bz-ink-2 text-[13px] text-bz-ink-2 flex justify-between items-center"
          >
            {t(`concierge.${key}`)}
            <ArrowRight size={14} strokeWidth={1.6} className="text-bz-muted shrink-0 ms-3" />
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, t }: { message: UiMessage; t: T }) {
  if (message.role === "user") {
    return (
      <div className="self-end max-w-[78%]">
        <div className="eyebrow text-end mb-1.5">{t("concierge.you")}</div>
        <div className="bg-bz-ink text-bz-bg px-5 py-3.5 rounded-2xl rounded-se-sm text-[14.5px] leading-[1.55]">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[88%]">
      <div className="eyebrow inline-flex items-center gap-1.5 mb-1.5">
        <Sparkles size={12} strokeWidth={1.8} className="text-bz-accent" />
        <span className="text-bz-accent">{t("concierge.botName")}</span>
      </div>
      <div className="bg-bz-surface border border-bz-border px-5 py-4 rounded-2xl rounded-ss-sm text-[14.5px] leading-[1.6]">
        {message.text ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : (
          <p className="text-bz-muted">{t("concierge.thinking")}</p>
        )}
        {message.toolEvents && message.toolEvents.length > 0 ? (
          <div className="mt-4 p-3 bg-bz-surface-2 rounded-lg text-[12px] text-bz-muted">
            <div className="eyebrow mb-1.5">{t("concierge.myWork")}</div>
            <div className="flex flex-col gap-1">
              {message.toolEvents.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <span
                    className={
                      e.status === "done" ? "text-bz-success" : "text-bz-muted"
                    }
                  >
                    {e.status === "done" ? "✓" : "⋯"}
                  </span>
                  <span>
                    {humaniseTool(e.name, t)}
                    {e.summary ? ` · ${e.summary}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResultCard({
  property,
  score,
  t,
}: {
  property: Scoreable;
  score?: Score;
  t: T;
}) {
  const value = score?.score ?? null;
  const { prefs } = usePreferences();
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-4">
      <div className="flex gap-3 items-start">
        <div className="w-20 h-20 rounded bg-bz-surface-2 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium truncate">
                {property.title}
              </div>
              <div className="text-[11.5px] text-bz-muted mt-0.5 truncate">
                {t("concierge.cardSpec", {
                  price: formatPrice(property.price_aed, prefs),
                  beds: property.beds,
                  size: property.built_up_ft2
                    ? formatArea(property.built_up_ft2, prefs.area_unit)
                    : property.type,
                })}
              </div>
              <div className="text-[11px] text-bz-muted mt-1">
                {property.area ?? t("concierge.fallbackArea")}
              </div>
            </div>
            <div className="text-center shrink-0">
              <div
                className={`mono text-[16px] font-semibold ${
                  value != null && value >= 90
                    ? "text-bz-success"
                    : value != null && value >= 75
                      ? "text-bz-ink"
                      : "text-bz-muted"
                }`}
              >
                {value ?? "—"}
              </div>
              <div className="text-[9px] text-bz-muted uppercase tracking-wider">
                {t("concierge.match")}
              </div>
            </div>
          </div>
        </div>
      </div>
      {score?.factors && score.factors.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1">
          {score.factors.map((f, i) => (
            <div
              key={i}
              className={`flex gap-1.5 items-center text-[11.5px] ${
                f.status === "match"
                  ? "text-bz-ink-2"
                  : f.status === "partial"
                    ? "text-bz-muted"
                    : "text-bz-muted-2"
              }`}
            >
              <span
                className={
                  f.status === "match"
                    ? "text-bz-success"
                    : f.status === "partial"
                      ? "text-bz-warning"
                      : "text-bz-muted-2"
                }
              >
                {f.status === "match" ? "✓" : f.status === "partial" ? "!" : "–"}
              </span>
              <span className="truncate">{f.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The tool name, as a line the visitor can read.
 *
 * The switch is gone: the six tool names are the message keys. `has` guards
 * the default — a tool the catalogue does not know about shows its raw name
 * rather than the string `tools.concierge.tool.new_thing`, which is what
 * `getMessageFallback` would otherwise render on the page.
 */
function humaniseTool(name: string, t: T): string {
  const key = `concierge.tool.${name}`;
  return t.has(key) ? t(key) : name;
}

function summariseResult(
  name: string,
  result: unknown,
  t: T,
): string | undefined {
  const r = (result ?? {}) as Record<string, unknown>;
  if (name === "search_properties" || name === "semantic_search") {
    const count = Array.isArray(r.results) ? r.results.length : 0;
    return t("concierge.candidates", { count });
  }
  if (name === "score_against_brief") {
    const scores = (r.scores as Array<{ score: number }>) ?? [];
    if (scores.length === 0) return t("concierge.noCandidates");
    const top = Math.max(...scores.map((s) => s.score));
    return t("concierge.topScore", { score: top });
  }
  if (name === "pin_properties") {
    return t("concierge.pinnedCount", { count: Number(r.pinned ?? 0) });
  }
  if (name === "get_market_stats") {
    return r.count != null
      ? t("concierge.listingsInArea", {
          count: Number(r.count),
          area: String(r.area ?? ""),
        })
      : undefined;
  }
  return undefined;
}

/**
 * Below-composer secondary action: open WhatsApp with the inferred brief
 * pre-filled as the first message. Lets the user escape the chat into a
 * live conversation without losing the context they just built up.
 */
function AdvisorWhatsAppHandoff({
  brief,
  t,
}: {
  brief: ConciergeBrief;
  t: T;
}) {
  const url = useMemo(
    () => buildAdvisorWhatsAppLink(formatBriefForWhatsApp(brief)),
    [brief],
  );
  if (!url) return null;
  return (
    <div className="mt-3 flex justify-center">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="advisor-whatsapp-handoff"
        className="inline-flex items-center gap-2 text-[12.5px] text-bz-muted hover:text-bz-accent"
      >
        <MessageCircle size={13} strokeWidth={1.6} />
        {t("concierge.whatsAppHandoff")}
      </a>
    </div>
  );
}
