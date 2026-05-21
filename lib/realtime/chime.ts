// Soft, short notification chime synthesized via Web Audio API. We avoid
// shipping an mp3 to keep the bundle minimal and respect the user's audio
// stack — the synthesized tone is < 200 bytes of code and produces a
// pleasant "ding" with a quick decay envelope.

let cachedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!cachedCtx) {
    try {
      cachedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  return cachedCtx;
}

/**
 * Play a tiny two-oscillator "ding" (E6 + A5, 400 ms decay). Safe to call
 * from anywhere on the client — silently no-ops on the server or when the
 * browser blocks audio (no user gesture yet, missing AudioContext, etc.).
 */
export function playChime(): void {
  const ctx = getCtx();
  if (!ctx) return;

  // Some browsers suspend the context until a user gesture. Resuming is
  // safe to call repeatedly.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = "sine";
  osc2.type = "sine";
  osc1.frequency.value = 1320; // E6 lead
  osc2.frequency.value = 880; // A5 undertone

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  // Soft ADSR — quick attack, gentle exponential decay.
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.4);
  osc2.stop(now + 0.4);
}

// ─── Preference (localStorage) ────────────────────────────────────────

const PREFERENCE_KEY = "bz-notifications-chime";

export function isChimeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setChimeEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) {
      window.localStorage.setItem(PREFERENCE_KEY, "on");
    } else {
      window.localStorage.removeItem(PREFERENCE_KEY);
    }
    // Notify other tabs / mounted listeners in the same tab.
    window.dispatchEvent(
      new CustomEvent("bz-chime-changed", { detail: { enabled: on } }),
    );
  } catch {
    // localStorage may be unavailable (private browsing) — silent no-op.
  }
}
