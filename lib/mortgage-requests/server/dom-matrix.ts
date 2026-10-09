/**
 * A stand-in `DOMMatrix` for pdf.js on the server.
 *
 * pdf.js builds one at module load (`const SCALE_MATRIX = new DOMMatrix()` in
 * the legacy build), and in Node it fills the global from the optional
 * `@napi-rs/canvas` package. That package is loaded through a runtime
 * `require`, which Vercel's file tracing never sees, so the deployed bundle
 * doesn't have it: every PDF upload failed with "DOMMatrix is not defined"
 * until this (error_events, `mortgage.files.complete`, 9 Oct 2026). Local
 * development and CI install the package, so neither showed it.
 *
 * We only open PDFs to count pages and detect a password; nothing is drawn,
 * and drawing is the only place pdf.js does arithmetic with a DOMMatrix. So
 * this holds the six affine values and answers the methods with itself — it
 * is never used for maths. The real class wins wherever one exists.
 */

type MatrixInit = ArrayLike<number> | string | undefined;

class DOMMatrixStub {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: MatrixInit) {
    if (init && typeof init !== "string" && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = Array.from(init).slice(0, 6) as number[];
    }
  }

  get is2D(): boolean {
    return true;
  }

  get isIdentity(): boolean {
    return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
  }

  multiplySelf(): this {
    return this;
  }
  preMultiplySelf(): this {
    return this;
  }
  translateSelf(): this {
    return this;
  }
  scaleSelf(): this {
    return this;
  }
  invertSelf(): this {
    return this;
  }
  multiply(): DOMMatrixStub {
    return this;
  }
  translate(): DOMMatrixStub {
    return this;
  }
  scale(): DOMMatrixStub {
    return this;
  }
  inverse(): DOMMatrixStub {
    return this;
  }
}

/** Give the runtime a `DOMMatrix` if it has none. Call before importing pdf.js. */
export function ensureDomMatrix(): void {
  const scope = globalThis as { DOMMatrix?: unknown };
  if (typeof scope.DOMMatrix === "undefined") scope.DOMMatrix = DOMMatrixStub;
}
