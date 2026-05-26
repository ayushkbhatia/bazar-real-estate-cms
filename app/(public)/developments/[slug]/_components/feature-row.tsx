"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { cn } from "@/lib/utils";
import type { NamedFeatureBlock } from "@/lib/queries/development-extras";

type Props = {
  block: NamedFeatureBlock;
  reverse: boolean;
  slug: string;
};

/**
 * Subscribe to `prefers-reduced-motion`. `useSyncExternalStore` is the
 * blessed React-18 pattern for matchMedia — no setState-in-effect.
 */
function getMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function getServerMotionSnapshot(): boolean {
  return false; // SSR assumes motion is on
}
function subscribeMotion(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/**
 * T3-D: IntersectionObserver-driven reveal on a single feature block.
 *
 * T3-D cleanup: the reveal now staggers eyebrow → title → image → prose
 * via per-element transition delays once the row crosses the trigger
 * line. Server-rendered HTML still ships the visible state so SSR + SEO
 * are correct.
 *
 * Honours `prefers-reduced-motion` via `useSyncExternalStore` on the
 * matchMedia query; the staggered cadence collapses to instant reveal
 * when reduced motion is on.
 */
export function FeatureRow({ block, reverse, slug }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const reduceMotion = useSyncExternalStore(
    subscribeMotion,
    getMotionSnapshot,
    getServerMotionSnapshot,
  );

  useEffect(() => {
    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            return;
          }
        }
      },
      { rootMargin: "0px 0px -80px 0px", threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduceMotion]);

  // Stagger ladder. Each step waits 120ms longer than the previous. With
  // reduced motion the delay collapses to zero so the reveal happens
  // synchronously (no animation, no waiting).
  const step = (n: number) =>
    reduceMotion ? "0ms" : visible ? `${n * 120}ms` : "0ms";
  const motionCls = (n: number) =>
    cn(
      "transition-all duration-700 ease-out",
      visible
        ? "opacity-100 translate-y-0"
        : "opacity-0 translate-y-3",
    );

  return (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 gap-10 items-center",
        reverse ? "md:[&>*:first-child]:order-2" : "",
      )}
    >
      <div
        className={cn(
          "relative aspect-[4/3] rounded-lg overflow-hidden",
          motionCls(2),
        )}
        style={{ transitionDelay: step(2) }}
      >
        <PlaceholderImage
          label={`${slug}-${block.key}`}
          className="absolute inset-0 w-full h-full"
        />
      </div>
      <div>
        <div className={motionCls(0)} style={{ transitionDelay: step(0) }}>
          <div className="eyebrow">{block.key.replace(/[-_]/g, " ")}</div>
        </div>
        <h3
          className={cn(
            "serif text-[32px] mt-2 leading-tight",
            motionCls(1),
          )}
          style={{ letterSpacing: "-0.02em", transitionDelay: step(1) }}
        >
          {block.title}
        </h3>
        <p
          className={cn(
            "mt-4 text-[15.5px] text-bz-ink-2 leading-[1.7] max-w-[52ch]",
            motionCls(3),
          )}
          style={{ transitionDelay: step(3) }}
        >
          {block.copy}
        </p>
      </div>
    </div>
  );
}
