import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 7g (backfilled): embed block type editor (iframe / video URL).
 * Sprint 8 adds the schema + renderer.
 */
export function EmbedBlockEditor({
  data,
  onChange,
}: {
  data: { url?: string; kind?: "iframe" | "video" | "tweet"; height?: number };
  onChange: (next: {
    url: string;
    kind: "iframe" | "video" | "tweet";
    height: number;
  }) => void;
}) {
  return (
    <div className="rounded-md border border-bz-border bg-bz-bg p-4">
      <Eyebrow>Embed block</Eyebrow>
      <p className="mt-2 text-[12px] text-bz-muted">
        Drop in a video URL (YouTube / Vimeo) or any allow-listed iframe
        URL. The renderer sandboxes embeds; allow-list lives in site
        settings (Sprint 13).
      </p>
      <div className="mt-3 grid grid-cols-[1fr_120px_100px] gap-2">
        <input
          value={data.url ?? ""}
          onChange={(e) =>
            onChange({
              url: e.target.value,
              kind: data.kind ?? "iframe",
              height: data.height ?? 400,
            })
          }
          placeholder="https://www.youtube.com/embed/…"
          className="h-9 px-3 rounded border border-bz-border bg-bz-surface text-[13px]"
        />
        <select
          value={data.kind ?? "iframe"}
          onChange={(e) =>
            onChange({
              url: data.url ?? "",
              kind: e.target.value as "iframe" | "video" | "tweet",
              height: data.height ?? 400,
            })
          }
          className="h-9 px-2.5 rounded border border-bz-border bg-bz-surface text-[13px]"
        >
          <option value="iframe">iframe</option>
          <option value="video">video</option>
          <option value="tweet">tweet</option>
        </select>
        <input
          type="number"
          value={data.height ?? 400}
          onChange={(e) =>
            onChange({
              url: data.url ?? "",
              kind: data.kind ?? "iframe",
              height: Number(e.target.value),
            })
          }
          placeholder="Height"
          className="h-9 px-3 rounded border border-bz-border bg-bz-surface text-[13px]"
        />
      </div>
    </div>
  );
}
