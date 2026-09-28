/**
 * Malware scanning for applicants' documents (SPEC §5 `file.scan`, §8). A
 * file can't be attached to a request or opened by staff until it is clean.
 *
 * Which scanner runs is decision D6, so it's an interface:
 *   · `clamdScanner` — a ClamAV daemon over TCP (the INSTREAM protocol).
 *   · `devScanner` — development and tests only: flags the EICAR test string,
 *     passes everything else. lib/mortgage-requests/server/deps.ts never picks
 *     it in production.
 * With no scanner configured in production, files stay `pending` and nothing
 * can be opened — failing closed, so launch can't happen without D6.
 */

import { connect } from "node:net";

/**
 * clean / infected are final. `failed`: the scanner answered but couldn't scan
 * it (too big, corrupt) — the applicant uploads again. `unavailable`: no answer
 * (down, timed out) — the file stays pending and the worker retries.
 */
export type ScanVerdict = "clean" | "infected" | "failed" | "unavailable";

export interface Scanner {
  readonly name: string;
  scan(bytes: Uint8Array): Promise<ScanVerdict>;
}

// The EICAR anti-virus test string, assembled at runtime so this source file
// doesn't itself trip a developer's anti-virus.
const EICAR = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join("");

export const devScanner: Scanner = {
  name: "dev",
  async scan(bytes) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(EICAR)
      ? "infected"
      : "clean";
  },
};

/** The EICAR string as bytes, for tests of the infected path. */
export const eicarTestBytes = () => new TextEncoder().encode(EICAR);

const CHUNK = 64 * 1024;

/** ClamAV's clamd over TCP: `zINSTREAM`, length-prefixed chunks, a zero-length chunk, one reply line. */
export function clamdScanner(opts: { host: string; port: number; timeoutMs?: number }): Scanner {
  return {
    name: "clamd",
    scan(bytes) {
      return new Promise<ScanVerdict>((resolve) => {
        let settled = false;
        let reply = "";
        const socket = connect({ host: opts.host, port: opts.port });
        const done = (verdict: ScanVerdict) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve(verdict);
        };
        const judge = () => {
          const line = reply.replace(/\0/g, "").trim();
          if (/: OK$/.test(line)) done("clean");
          else if (/ FOUND$/.test(line)) done("infected");
          else done(line ? "failed" : "unavailable");
        };

        socket.setTimeout(opts.timeoutMs ?? 30_000, () => done("unavailable"));
        socket.on("error", () => done("unavailable"));
        socket.on("connect", () => {
          socket.write("zINSTREAM\0");
          for (let offset = 0; offset < bytes.length; offset += CHUNK) {
            const chunk = bytes.subarray(offset, offset + CHUNK);
            const size = Buffer.alloc(4);
            size.writeUInt32BE(chunk.length);
            socket.write(size);
            socket.write(chunk);
          }
          socket.write(Buffer.alloc(4));
        });
        socket.on("data", (data) => {
          reply += data.toString("utf8");
          if (reply.includes("\0") || reply.includes("\n")) judge();
        });
        socket.on("end", judge);
      });
    },
  };
}
