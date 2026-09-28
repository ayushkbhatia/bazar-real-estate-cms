/**
 * @vitest-environment node
 */
import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { buildPdf } from "../testing/fixtures";
import { clamdScanner, devScanner, eicarTestBytes } from "./scan";

describe("the dev scanner", () => {
  it("flags the EICAR test string and passes everything else", async () => {
    expect(await devScanner.scan(eicarTestBytes())).toBe("infected");
    expect(await devScanner.scan(buildPdf())).toBe("clean");
  });

  it("finds EICAR inside a larger file", async () => {
    const eicar = eicarTestBytes();
    const file = new Uint8Array(5000);
    file.set(eicar, 1234);
    expect(await devScanner.scan(file)).toBe("infected");
  });
});

describe("the clamd scanner (INSTREAM over TCP)", () => {
  let server: Server | null = null;
  afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

  /** A stand-in clamd that checks the framing and answers with `reply`. */
  function fakeClamd(reply: (received: Buffer) => string | null): Promise<number> {
    return new Promise((resolve) => {
      server = createServer((socket) => {
        let buffer = Buffer.alloc(0);
        socket.on("data", (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          const command = "zINSTREAM\0";
          if (buffer.length < command.length) return;
          expect(buffer.subarray(0, command.length).toString()).toBe(command);
          // Walk the length-prefixed chunks to the zero-length terminator.
          let offset = command.length;
          const payload: Buffer[] = [];
          while (offset + 4 <= buffer.length) {
            const size = buffer.readUInt32BE(offset);
            if (size === 0) {
              const answer = reply(Buffer.concat(payload));
              if (answer === null) return; // say nothing: a hung daemon
              socket.end(`${answer}\0`);
              return;
            }
            if (offset + 4 + size > buffer.length) return;
            payload.push(buffer.subarray(offset + 4, offset + 4 + size));
            offset += 4 + size;
          }
        });
      }).listen(0, "127.0.0.1", () => resolve((server!.address() as { port: number }).port));
    });
  }

  it("streams the whole file and reads a clean verdict", async () => {
    const file = buildPdf({ pages: 2, padToBytes: 200_000 }); // several 64 KB chunks
    let seen = 0;
    const port = await fakeClamd((received) => {
      seen = received.length;
      return "stream: OK";
    });
    expect(await clamdScanner({ host: "127.0.0.1", port }).scan(file)).toBe("clean");
    expect(seen).toBe(file.length);
  });

  it("reads an infection", async () => {
    const port = await fakeClamd(() => "stream: Win.Test.EICAR_HDB-1 FOUND");
    expect(await clamdScanner({ host: "127.0.0.1", port }).scan(eicarTestBytes())).toBe("infected");
  });

  it("calls a scanner error 'failed', so the applicant uploads again", async () => {
    const port = await fakeClamd(() => "INSTREAM size limit exceeded. ERROR");
    expect(await clamdScanner({ host: "127.0.0.1", port }).scan(buildPdf())).toBe("failed");
  });

  it("calls no answer 'unavailable', so the worker retries", async () => {
    const hung = await fakeClamd(() => null);
    expect(await clamdScanner({ host: "127.0.0.1", port: hung, timeoutMs: 300 }).scan(buildPdf())).toBe("unavailable");
    expect(await clamdScanner({ host: "127.0.0.1", port: 1 }).scan(buildPdf())).toBe("unavailable");
  });
});
