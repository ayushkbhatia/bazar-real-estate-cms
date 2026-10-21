import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { SalesforceListingRow } from "@/lib/queries/salesforce-listings";

const h = vi.hoisted(() => ({
  role: "admin" as string,
  org: "bazarrealestate.my.salesforce.com" as string | null,
  rows: [] as SalesforceListingRow[],
}));

vi.mock("@/lib/auth", () => ({
  requireRole: async () => ({ staff: { role: h.role, status: "active" } }),
}));
vi.mock("@/lib/env", () => ({ env: {}, isSalesforceConfigured: true }));
vi.mock("@/lib/salesforce/client", () => ({
  salesforceOrgHost: () => h.org,
  isSandboxOrgHost: (host: string | null) => !!host && host.includes("--"),
}));
vi.mock("@/lib/queries/salesforce-listings", () => ({
  listSalesforceListings: async () => h.rows,
  getListingSyncSettings: async () => ({ paused: false, writeBack: false, lastRunAt: null, lastSummary: {} }),
  getMappingOptions: async () => ({
    areas: [{ id: "00000000-0000-4000-8000-000000000006", label: "Al Reem Island" }],
    developers: [],
    staff: [],
  }),
}));
vi.mock("@/lib/queries/health", () => ({
  listHeartbeats: async () => [
    { job: "salesforce-listing-sync", last_run_at: new Date().toISOString(), last_ok: true, last_detail: "seen 2, live 1", consecutive_failures: 0 },
  ],
}));
vi.mock("@/components/brand/cms-shell", () => ({
  CmsShell: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="shell" data-title={title}>
      {children}
    </div>
  ),
}));
vi.mock("./_actions", () => ({
  saveSalesforceMapping: vi.fn(),
  setSalesforceListingHidden: vi.fn(),
  syncSalesforceListingsNow: vi.fn(),
  updateListingSyncSettings: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: SalesforceListingsPage } = await import("./page");

function row(over: Partial<SalesforceListingRow>): SalesforceListingRow {
  return {
    sfListingId: "a03iy000000XHoUAAW",
    orgHost: "bazarrealestate.my.salesforce.com",
    name: "LST-00003",
    reference: "BZR-PROP-003",
    title: "3BR Apartment",
    location: "Sobha City, Abu Dhabi",
    price: 145000,
    offering: "Rent",
    state: "held",
    holds: [],
    notes: [],
    unresolved: {},
    imagesTotal: 1,
    imagesReady: 1,
    approvedAt: null,
    hiddenAt: null,
    withdrawnAt: null,
    withdrawnReason: null,
    lastSyncedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    lastError: null,
    property: null,
    ...over,
  };
}

beforeEach(() => {
  h.role = "admin";
  h.org = "bazarrealestate.my.salesforce.com";
  h.rows = [
    row({
      holds: [
        {
          code: "unmapped_location",
          fix: "website",
          message: '"Sobha City, Abu Dhabi" does not match an area on the website.',
        },
      ],
      unresolved: { location: "Sobha City, Abu Dhabi" },
    }),
    row({
      sfListingId: "a03iy000000XI30AAG",
      name: "LST-00002",
      title: "4BR Villa on Yas Island",
      state: "on_website",
      property: { id: "p1", slug: "4br-villa", reference: "BAZ-AD-04891", status: "draft" },
    }),
  ];
});

describe("Salesforce listings screen", () => {
  it("puts the decision an editor can make on the page, once per value", async () => {
    render(await SalesforceListingsPage());
    expect(screen.getByText("Needs a decision")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /Map "Sobha City, Abu Dhabi" to a area/ })).toBeTruthy();
    expect(screen.getByText("1 listing waiting")).toBeTruthy();
  });

  it("says whose job each hold is", async () => {
    render(await SalesforceListingsPage());
    const held = screen.getByText("3BR Apartment").closest("li")!;
    expect(within(held).getByText("Fix here")).toBeTruthy();
  });

  it("sends a listing on the website to its editor, with no buttons of its own", async () => {
    render(await SalesforceListingsPage());
    const drafted = screen.getByText("4BR Villa on Yas Island").closest("li")!;
    expect(within(drafted).getByText("on the website")).toBeTruthy();
    expect(within(drafted).getByText(/BAZ-AD-04891 · draft/)).toBeTruthy();
    expect(within(drafted).queryByRole("button")).toBeNull();
    expect(within(drafted).getByRole("link", { name: "Open in editor" }).getAttribute("href")).toBe("/admin/properties/p1");
  });

  it("offers to keep a waiting listing out before its draft is made", async () => {
    render(await SalesforceListingsPage());
    const held = screen.getByText("3BR Apartment").closest("li")!;
    expect(within(held).getByRole("button", { name: "Don’t bring in" })).toBeTruthy();
  });

  it("flags a withdrawn listing the website still shows", async () => {
    h.rows = [
      row({
        state: "withdrawn",
        withdrawnReason: "Deleted in Salesforce",
        property: { id: "p1", slug: "x", reference: "BAZ-AD-04891", status: "published" },
      }),
    ];
    render(await SalesforceListingsPage());
    expect(screen.getByText(/Still published on the website/)).toBeTruthy();
  });

  it("gives an agent the view without the controls", async () => {
    h.role = "agent";
    render(await SalesforceListingsPage());
    expect(screen.queryByRole("button", { name: "Don’t bring in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("says plainly when the org is a sandbox, and offers nothing to decide", async () => {
    h.org = "bazarrealestate--sand.sandbox.my.salesforce.com";
    h.rows = [row({ state: "mirror_only" })];
    render(await SalesforceListingsPage());
    expect(screen.getByText("sandbox · nothing is published")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Don’t bring in|Allow on website/ })).toBeNull();
  });
});
