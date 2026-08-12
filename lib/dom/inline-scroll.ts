/**
 * Logical scroll coordinates for a horizontally scrolling element.
 *
 * `scrollLeft` is not a logical value. In the CSSOM-View model every engine
 * now implements, an RTL container reports `scrollLeft === 0` at the *inline
 * start* and counts **negative** toward the end. So code written against LTR
 * does not merely mirror in Arabic — it degenerates:
 *
 *   setCanPrev(el.scrollLeft > 1)          // always false: scrollLeft <= 0
 *   setCanNext(el.scrollLeft < max - 1)    // always true
 *   Math.max(0, Math.min(max, next))       // clamps [0, max] over a [-max, 0]
 *                                          // range, collapsing it to the
 *                                          // single point 0
 *
 * The visible result is a rail frozen on page one with both arrows lit — and
 * every area rail under the New Projects map is one of these.
 *
 * These helpers convert to a direction-agnostic space where 0 is always the
 * inline start and positive always means "further along". Callers do their
 * arithmetic there and convert back once, at the point of assignment.
 *
 * `rtl` is an explicit argument and is deliberately NOT sniffed from
 * `getComputedStyle`: jsdom's support for inherited `direction` is unreliable,
 * and `project-carousel.test.tsx` renders the component bare, so a sniffed
 * value would be undefined there. Passing it keeps the existing assertions
 * meaningful — `toScrollLeft(x, false) === x`.
 */

/** Distance from the inline start, always >= 0, in both directions. */
export function inlineScrollStart(el: HTMLElement, rtl: boolean): number {
  return rtl ? -el.scrollLeft : el.scrollLeft;
}

/** The furthest logical offset. Direction-agnostic already. */
export function maxInlineScroll(el: HTMLElement): number {
  return el.scrollWidth - el.clientWidth;
}

/** Logical offset back to the physical `scrollLeft` the DOM wants. */
export function toScrollLeft(offset: number, rtl: boolean): number {
  return rtl ? -offset : offset;
}

/** Clamp a logical offset into the scrollable range. */
export function clampInlineScroll(offset: number, max: number): number {
  return Math.max(0, Math.min(max, offset));
}
