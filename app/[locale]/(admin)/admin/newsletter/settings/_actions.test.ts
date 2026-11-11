/**
 * @vitest-environment node
 *
 * The Resend account also sends for other sites, so their domains show as
 * verified. A newsletter From on one of them would have every bounce ignored
 * by the delivery webhook, so the save refuses it — whether or not Resend can
 * be asked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { domains, update, envMock } = vi.hoisted(() => ({
  domains: vi.fn(),
  update: vi.fn(),
  envMock: { RESEND_FROM_ADDRESS: "hello@bazarrealestate.com" as string | undefined },
}));

function builder(result: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = () => b;
  b.update = (payload: unknown) => {
    update(payload);
    return b;
  };
  b.maybeSingle = async () => ({ data: result, error: null });
  return b;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/email", () => ({ resendSendingDomains: domains }));
vi.mock("@/lib/auth", () => ({
  requireRole: async () => ({
    user: { id: "u1" },
    supabase: { from: () => builder({ id: true }) },
  }),
}));

import { saveSenderSettings } from "./_actions";

const VERIFIED = ["news.indushydraulics.com", "indushydraulics.com", "bazarrealestate.com"];
const input = (from_address: string) => ({
  from_name: "Marketing",
  from_address,
  reply_to: "marketing@bazarrealestate.ae",
});

describe("saveSenderSettings", () => {
  beforeEach(() => {
    update.mockReset();
    domains.mockReset();
    domains.mockResolvedValue({ status: "ok", domains: VERIFIED });
  });

  it("refuses another site's domain even though Resend has it verified", async () => {
    for (const from of ["newsletter@news.indushydraulics.com", "info@indushydraulics.com"]) {
      const res = await saveSenderSettings(input(from));
      expect(res.status).toBe("error");
      expect(res.status === "error" && res.fieldErrors?.from_address).toMatch(/bazarrealestate\.com/);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses it when Resend can't be asked, too", async () => {
    domains.mockResolvedValue({ status: "unavailable", reason: "RESEND_API_KEY not set" });
    const res = await saveSenderSettings(input("info@indushydraulics.com"));
    expect(res.status).toBe("error");
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses Bazar's own domain while Resend hasn't verified it", async () => {
    const res = await saveSenderSettings(input("marketing@bazarrealestate.ae"));
    expect(res.status).toBe("error");
    expect(res.status === "error" && res.message).toMatch(/can't send from bazarrealestate\.ae/);
    expect(update).not.toHaveBeenCalled();
  });

  it("saves a From on a verified Bazar domain", async () => {
    const res = await saveSenderSettings(input("marketing@bazarrealestate.com"));
    expect(res.status).toBe("ok");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ from_address: "marketing@bazarrealestate.com" }),
    );
  });
});
