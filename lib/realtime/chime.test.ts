import { describe, it, expect, beforeEach } from "vitest";
import { isChimeEnabled, setChimeEnabled, playChime } from "./chime";

beforeEach(() => {
  window.localStorage.clear();
});

describe("chime preference", () => {
  it("defaults to disabled", () => {
    expect(isChimeEnabled()).toBe(false);
  });

  it("persists enabled state in localStorage", () => {
    setChimeEnabled(true);
    expect(isChimeEnabled()).toBe(true);
    expect(window.localStorage.getItem("bz-notifications-chime")).toBe("on");
  });

  it("removes the key on disable rather than storing 'off'", () => {
    setChimeEnabled(true);
    setChimeEnabled(false);
    expect(isChimeEnabled()).toBe(false);
    expect(window.localStorage.getItem("bz-notifications-chime")).toBeNull();
  });

  it("dispatches a bz-chime-changed event on each set", () => {
    let received: { enabled: boolean } | null = null;
    const handler = (e: Event) => {
      received = (e as CustomEvent<{ enabled: boolean }>).detail;
    };
    window.addEventListener("bz-chime-changed", handler);
    setChimeEnabled(true);
    expect(received).toEqual({ enabled: true });
    setChimeEnabled(false);
    expect(received).toEqual({ enabled: false });
    window.removeEventListener("bz-chime-changed", handler);
  });
});

describe("playChime", () => {
  it("never throws — silently no-ops without AudioContext", () => {
    // jsdom doesn't provide AudioContext, so this path exercises the
    // "no Ctor → no-op" branch.
    expect(() => playChime()).not.toThrow();
  });
});
