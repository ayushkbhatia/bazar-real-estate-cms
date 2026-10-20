/**
 * The `sizes` for a full-bleed photo hero: an `object-cover` image filling a
 * section that is the full viewport wide and has a height of its own.
 *
 * `sizes` describes only width, and "100vw" is right on a desktop, where the
 * section is far wider than tall. On a phone it is the other way round — a
 * 390px-wide hero is 420–640px tall, or taller where the copy and a form card
 * set its height — so a landscape photo is drawn at height × aspect and its
 * sides cropped away. Asking for 100vw there fetched a 1200px file and
 * stretched it 1.6–5× (measured on production at 390px @3x, 2026-10-20).
 *
 * A fixed 680px rather than a vw multiple: at 3x it lands on the 2048
 * `deviceSizes` candidate on every phone width (a vw value crosses 2048 at
 * 393px and jumps to 3840, a desktop file for a phone's LCP image that is
 * mostly crop), and at 2x on 1920. That covers a 3:2 photo in a ~450px-tall
 * hero fully and gets taller heroes most of the way there. Past 680px the
 * viewport itself is wider, so 100vw takes over.
 */
export const HERO_SIZES = "(max-width: 680px) 680px, 100vw";
