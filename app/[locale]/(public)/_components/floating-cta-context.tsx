"use client";

/**
 * Page context for the floating CTA rail.
 *
 * The rail is mounted once, in the public layout, so that WhatsApp floats on
 * every page. But on a property, off-plan or service page the buttons should
 * route to the advisor handling *that* record, and the draft message should
 * name what the visitor is actually looking at — and those pages are server
 * components rendered as `children`, below the rail's own mount point.
 *
 * So the layout wraps both in this provider, and a detail page drops a
 * `<FloatingCtaTarget>` anywhere in its tree to publish itself upward. The
 * component renders nothing; unmounting it on navigation clears the target,
 * which is what returns the rail to its site-wide behaviour.
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
import type { FloatingCtaTokenValues } from "@/lib/schemas/floating-cta";

export type FloatingCtaTargetValue = {
  advisorName: string;
  advisorPhone: string | null;
  advisorEmail: string | null;
  /** What `{context}` resolves to: the listing title, project or service. */
  contextRef: string;
  kind: "property" | "development" | "service";
  /**
   * Everything else the message templates can draw on — price, beds, the
   * reference, the advisor's BRN. Typed against the token registry, so a page
   * cannot publish a key the editor is never offered, and a token offered in
   * the editor has somewhere to come from.
   *
   * `{advisor}` and `{context}` are filled from the fields above rather than
   * repeated here.
   */
  tokens?: FloatingCtaTokenValues;
  /**
   * Ids for the click log. Not used in any message — they exist so the office
   * can count clicks per listing and per advisor without matching on a name
   * that an editor may since have changed.
   */
  advisorId?: string | null;
  propertyId?: string | null;
  developmentId?: string | null;
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
 * Publish this page to the rail. Renders nothing.
 *
 * The effect keys off a serialised copy of the props rather than a dependency
 * list: the payload is plain data from a server component, and `tokens` is an
 * object literal rebuilt on every render, so listing it directly would
 * re-publish the target on every parent render forever.
 *
 * The cleanup only clears the target when it is still ours. During a client
 * navigation React can mount the next page's target before unmounting this
 * one, and an unconditional clear would wipe the incoming value.
 */
export function FloatingCtaTarget(props: FloatingCtaTargetValue) {
  const { setTarget } = useContext(FloatingCtaCtx);
  const signature = JSON.stringify(props);

  useEffect(() => {
    const value = JSON.parse(signature) as FloatingCtaTargetValue;
    setTarget(value);
    return () => setTarget((current) => (current === value ? null : current));
  }, [signature, setTarget]);

  return null;
}
