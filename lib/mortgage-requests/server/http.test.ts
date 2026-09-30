/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readJson } from "./http";

const Body = z.object({ name: z.string() });
const post = (body: string, type?: string) =>
  new Request("http://localhost/api/mortgage/example", {
    method: "POST",
    body,
    headers: type ? { "content-type": type } : {},
  });

describe("readJson", () => {
  it("reads a JSON request", async () => {
    expect(await readJson(post('{"name":"x"}', "application/json"), Body)).toEqual({ name: "x" });
    expect(await readJson(post('{"name":"x"}', "application/json; charset=utf-8"), Body)).toEqual({ name: "x" });
  });

  it("refuses the same body sent as a cross-site form could send it (SR-16)", async () => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", undefined]) {
      await expect(readJson(post('{"name":"x"}', type), Body), String(type)).rejects.toMatchObject({ status: 415 });
    }
  });

  it("still refuses a JSON request that isn't JSON, or isn't the right shape", async () => {
    await expect(readJson(post("not json", "application/json"), Body)).rejects.toMatchObject({ status: 400 });
    await expect(readJson(post('{"other":1}', "application/json"), Body)).rejects.toMatchObject({ status: 422 });
  });
});
