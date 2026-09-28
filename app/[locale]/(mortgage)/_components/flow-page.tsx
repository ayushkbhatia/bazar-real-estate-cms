"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { guardRedirect, type ApplyState, type FlowRoute } from "@/lib/mortgage-requests/client/apply-state";
import { useApplyState } from "@/lib/mortgage-requests/client/apply-store";
import { FlowStepper } from "./steps";

/**
 * A step's page inside the shell (00-foundations §4): the stepper, an
 * optional top slot, then the main column and the rail. The rail sits beside
 * the main column from 1024px (320px wide, 356px from 1280px, as designed)
 * and under it below that (proposed).
 */
export function FlowPage({
  step,
  last,
  top,
  rail,
  children,
}: {
  step?: number;
  last?: "documents" | "submit";
  top?: ReactNode;
  rail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex-1 px-4 pt-[30px] pb-16 md:px-6 lg:px-12">
      <div className="mx-auto max-w-[1216px]">
        {step !== undefined && last ? <FlowStepper step={step} last={last} /> : null}
        {top}
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_356px] xl:gap-[72px]">
          <div className="min-w-0">{children}</div>
          {rail ? <aside className="flex flex-col gap-4">{rail}</aside> : null}
        </div>
      </div>
    </main>
  );
}

/**
 * The wizard's state for a route, once the tab's storage has been read and
 * the route's guard is satisfied; null until then (the page renders nothing
 * state-dependent). A guard that fails replaces the route with the earliest
 * step still to do.
 */
export function useGuardedState(route: FlowRoute): [ApplyState | null, ReturnType<typeof useApplyState>[1]] {
  const [state, update] = useApplyState();
  const router = useRouter();
  const target = state ? guardRedirect(state, route) : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);
  return [state && !target ? state : null, update];
}

/** An empty main column while the tab's storage is read, so the shell doesn't jump. */
export function FlowPending() {
  return <main className="flex-1" aria-busy="true" />;
}
