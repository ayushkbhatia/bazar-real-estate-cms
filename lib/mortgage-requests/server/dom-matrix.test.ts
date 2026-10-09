/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it } from "vitest";
import { ensureDomMatrix } from "./dom-matrix";

const scope = globalThis as { DOMMatrix?: unknown };
const original = scope.DOMMatrix;

afterEach(() => {
  scope.DOMMatrix = original;
});

describe("ensureDomMatrix (pdf.js on Vercel)", () => {
  it("provides a DOMMatrix where the runtime has none, as Vercel's bundle does", () => {
    delete scope.DOMMatrix;
    ensureDomMatrix();
    const Ctor = scope.DOMMatrix as new (init?: number[]) => { a: number; d: number; e: number; isIdentity: boolean; multiplySelf(): unknown };
    expect(typeof Ctor).toBe("function");
    // pdf.js's module-level `new DOMMatrix()` must work, and so must the forms it draws with.
    expect(new Ctor().isIdentity).toBe(true);
    const m = new Ctor([2, 0, 0, 3, 10, 20]);
    expect([m.a, m.d, m.e]).toEqual([2, 3, 10]);
    expect(m.multiplySelf()).toBe(m);
  });

  it("leaves a real DOMMatrix alone", () => {
    class Real {}
    scope.DOMMatrix = Real;
    ensureDomMatrix();
    expect(scope.DOMMatrix).toBe(Real);
  });
});
