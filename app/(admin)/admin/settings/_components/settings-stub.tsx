import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Shared placeholder for settings sub-tabs whose backend lands in a later
 * sprint. PM can navigate, see the intended scope, and identify which
 * sprint will activate the screen.
 */
export function SettingsStub({
  title,
  intro,
  willShipIn,
  bullets,
}: {
  title: string;
  intro: string;
  willShipIn: string;
  bullets: string[];
}) {
  return (
    <div>
      <Eyebrow>Settings · {title}</Eyebrow>
      <h2
        className="serif text-[28px] mt-2 leading-tight"
        style={{ letterSpacing: "-0.012em" }}
      >
        {title}
      </h2>
      <p className="mt-3 text-[14px] text-bz-ink-2 max-w-[60ch] leading-relaxed">
        {intro}
      </p>
      <div className="mt-8 rounded-md border border-dashed border-bz-border bg-bz-surface p-6 max-w-[640px]">
        <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
          Lands in
        </div>
        <div className="mono text-[13px] mt-1 text-bz-accent">
          {willShipIn}
        </div>
        <ul className="mt-4 flex flex-col gap-1.5">
          {bullets.map((b) => (
            <li key={b} className="text-[13.5px] text-bz-ink-2 leading-snug">
              · {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
