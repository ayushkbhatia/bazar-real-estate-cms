/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * G-5 catches a physical Tailwind utility. It cannot see this one.
 *
 * Both logo marquees are a doubled track inside `overflow: hidden`, animated
 * to `translate3d(-50%, 0, 0)` for a seamless loop. Under `dir="rtl"` the flex
 * row is laid out from the right, so the track's overflow spills LEFT and its
 * right edge starts flush with the container's — moving it further left drags
 * the whole strip into empty space. On /ar the logos ran off the start of the
 * page once and never came back.
 *
 * It is invisible to every other guard in the suite: the CSS is a template
 * literal inside a `<style>` tag, it contains no Tailwind utility, and a
 * jsdom test cannot measure it because jsdom has no layout. So this asserts
 * the shape of the fix rather than its effect — an RTL keyframe exists, it is
 * selected under `[dir="rtl"]`, and it moves the opposite way.
 *
 * Verified once by hand against the running page by stepping each animation's
 * `currentTime` through a full cycle: with the mirrored keyframe the track
 * overhangs the container on both sides at every point, so the window is never
 * bare.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..");

const MARQUEES = [
  {
    file: "app/[locale]/(public)/_components/partner-marquee.tsx",
    track: "bz-marquee__track",
    ltr: "bz-marquee-scroll",
    rtl: "bz-marquee-scroll-rtl",
  },
  {
    file: "app/[locale]/(public)/_components/developer-marquee.tsx",
    track: "bz-devmarquee__track",
    ltr: "bz-devmarquee-scroll",
    rtl: "bz-devmarquee-scroll-rtl",
  },
];

function source(file: string): string {
  return readFileSync(join(REPO_ROOT, file), "utf8");
}

describe.each(MARQUEES)("$file", ({ file, track, ltr, rtl }) => {
  const css = source(file);

  it("still scrolls left in the default direction", () => {
    expect(css).toContain(`@keyframes ${ltr}`);
    expect(css).toMatch(
      new RegExp(`@keyframes ${ltr} \\{[^}]*\\}[^@]*translate3d\\(-50%`),
    );
  });

  it("selects a mirrored keyframe under dir=rtl", () => {
    expect(css).toMatch(
      new RegExp(`\\[dir="rtl"\\][^{]*\\.${track.replace("__", "__")}\\s*\\{[^}]*animation-name:\\s*${rtl}`),
    );
  });

  it("mirrors the sign rather than reusing the LTR distance", () => {
    const block = css.slice(css.indexOf(`@keyframes ${rtl}`));
    const body = block.slice(0, block.indexOf("}", block.indexOf("to")));
    expect(body).toContain("translate3d(50%, 0, 0)");
    expect(body).not.toContain("translate3d(-50%");
  });

  it("keeps the doubled track that makes either direction seamless", () => {
    // A single copy wraps with a visible jump whichever way it moves.
    expect(css).toMatch(/\[\.\.\.[A-Z_]+, ?\.\.\.[A-Z_]+\]/);
  });
});
