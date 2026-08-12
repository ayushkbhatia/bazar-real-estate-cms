"use client";

/**
 * Advisor context for the floating CTA rail.
 *
 * The rail is mounted once, in the public layout, so that WhatsApp floats on
 * every page. But on a property, off-plan or service page the buttons should
 * route to the advisor handling *that* record, and those pages are server
 * components rendered as `children` — below the rail's own mount point.
 *
 * So the layout wraps both in this provider, and a detail page drops a
 * `<FloatingCtaTarget>` anywhere in its tree to publish its advisor upward.
 * The component renders nothing; unmounting it on navigation clears the
 * target, which is what returns the rail to its site-wide behaviour.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export type FloatingCtaTargetValue = {
  advisorName: string;
  advisorPhone: string | null;
  advisorEmail: string | null;
  /** Listing reference, project name or service name for {context}. */
  contextRef: string;
  kind: "property" | "development" | "service";
};

type ContextShape = {
  target: FloatingCtaTargetValue | null;
  setTarget: Dispatch<SetStateAction<FloatingCtaTargetValue | null>>;
};

const FloatingCtaCtx = createContext<ContextShape>({
  target: null,
  setTarget: () => {},
});

export function FloatingCtaProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [target, setTarget] = useState<FloatingCtaTargetValue | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return (
    <FloatingCtaCtx.Provider value={value}>{children}</FloatingCtaCtx.Provider>
  );
}

export function useFloatingCtaTarget(): FloatingCtaTargetValue | null {
  return useContext(FloatingCtaCtx).target;
}

/**
 * Publish this page's advisor to the rail. Renders nothing.
 *
 * The cleanup only clears the target when it is still ours: during a client
 * navigation React can mount the next page's target before unmounting this
 * one, and an unconditional clear would wipe the incoming value.
 */
export function FloatingCtaTarget(props: FloatingCtaTargetValue) {
  const { setTarget } = useContext(FloatingCtaCtx);
  const { advisorName, advisorPhone, advisorEmail, contextRef, kind } = props;

  useEffect(() => {
    const value: FloatingCtaTargetValue = {
      advisorName,
      advisorPhone,
      advisorEmail,
      contextRef,
      kind,
    };
    setTarget(value);
    return () => setTarget((current) => (current === value ? null : current));
  }, [advisorName, advisorPhone, advisorEmail, contextRef, kind, setTarget]);

  return null;
}
