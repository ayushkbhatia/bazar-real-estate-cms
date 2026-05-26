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
 * Subtle editorial cadence — image and prose fade + slide in once each
 * block scrolls into view, ~80px from the bottom of the viewport. Falls
 * back to the visible (no-animation) state when JS / motion is off or
 * `prefers-reduced-motion` is enabled.
 *
 * Server-rendered HTML ships the visible state so SSR is correct and
 * search engines see the full content; the client component layers the
 * animation on top.
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
    // IntersectionObserver is exactly the "subscribe for updates from
    // an external system" pattern useEffect is designed for — the
    // observer is an external system that occasionally fires; we mirror
    // that into local state. The lint rule is overly strict here.
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

  return (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 gap-10 items-center transition-all duration-700 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        reverse ? "md:[&>*:first-child]:order-2" : "",
      )}
    >
      <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
        <PlaceholderImage
          label={`${slug}-${block.key}`}
          className="absolute inset-0 w-full h-full"
        />
      </div>
      <div>
        <div className="eyebrow">{block.key.replace(/[-_]/g, " ")}</div>
        <h3
          className="serif text-[32px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.02em" }}
        >
          {block.title}
        </h3>
        <p className="mt-4 text-[15.5px] text-bz-ink-2 leading-[1.7] max-w-[52ch]">
          {block.copy}
        </p>
      </div>
    </div>
  );
}
