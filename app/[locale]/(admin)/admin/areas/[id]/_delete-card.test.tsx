import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_AREA_USAGE, type AreaUsage } from "@/lib/area-usage";
import { DeleteAreaCard } from "./_delete-card";

// The card imports the server action by reference; that module reaches for the
// Supabase server client and next/cache, neither of which belongs in jsdom.
const deleteArea = vi.fn();
vi.mock("../../pages/sub/area/_record-actions", () => ({
  deleteArea: (...args: unknown[]) => deleteArea(...args),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const NAME = "Hudayriyat Island";

function setup(
  props: Partial<React.ComponentProps<typeof DeleteAreaCard>> = {},
) {
  return render(
    <DeleteAreaCard
      areaId="area-1"
      name={NAME}
      slug="hudayriyat-island"
      usage={EMPTY_AREA_USAGE}
      canDelete
      {...props}
    />,
  );
}

const inUse: AreaUsage = {
  properties: {
    count: 7,
    sample: [
      { id: "p1", label: "Sea-view villa · BZ-101", href: "/admin/properties/p1" },
    ],
  },
  developments: {
    count: 1,
    sample: [{ id: "d1", label: "Nawayef", href: "/admin/developments/d1" }],
  },
  children: { count: 0, sample: [] },
  unpublished: EMPTY_AREA_USAGE.unpublished,
  menuLinks: 0,
};

const draftsOnly: AreaUsage = {
  ...EMPTY_AREA_USAGE,
  unpublished: {
    properties: {
      count: 2,
      sample: [
        { id: "p2", label: "Draft villa · BZ-102", href: "/admin/properties/p2" },
        { id: "p3", label: "Archived flat · BZ-103", href: "/admin/properties/p3" },
      ],
    },
    developments: {
      count: 1,
      sample: [{ id: "d2", label: "Unlaunched", href: "/admin/developments/d2" }],
    },
  },
};

beforeEach(() => {
  deleteArea.mockReset().mockResolvedValue({ status: "ok", message: "Deleted." });
  push.mockReset();
});

describe("DeleteAreaCard", () => {
  it("refuses while published listings or projects sit in the area, and names them", () => {
    setup({ usage: inUse });
    expect(screen.queryByRole("button", { name: /Delete area/ })).toBeNull();
    expect(
      screen.getByText(
        /can't be deleted while it has 7 published listings and 1 published project/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Sea-view villa · BZ-101" }),
    ).toHaveAttribute("href", "/admin/properties/p1");
    expect(screen.getByRole("link", { name: "Nawayef" })).toHaveAttribute(
      "href",
      "/admin/developments/d1",
    );
    // Seven listings, one shown: the rest are counted, not dropped.
    expect(screen.getByText("and 6 more")).toBeInTheDocument();
  });

  it("lets unpublished listings and projects through, naming what loses its area", () => {
    setup({ usage: draftsOnly });
    expect(screen.getByRole("button", { name: /Delete area/ })).toBeEnabled();
    expect(
      screen.getByText(/still holds 2 unpublished listings and 1 unpublished project/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Draft villa · BZ-102" }),
    ).toHaveAttribute("href", "/admin/properties/p2");
    expect(screen.getByRole("link", { name: "Unlaunched" })).toHaveAttribute(
      "href",
      "/admin/developments/d2",
    );
    fireEvent.click(screen.getByRole("button", { name: /Delete area/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      /2 unpublished listings and 1 unpublished project will be left without an area/,
    );
  });

  it("refuses while another area sits inside it", () => {
    setup({
      usage: {
        ...EMPTY_AREA_USAGE,
        children: {
          count: 1,
          sample: [{ id: "c1", label: "Marina", href: "/admin/areas/c1" }],
        },
      },
    });
    expect(screen.queryByRole("button", { name: /Delete area/ })).toBeNull();
    expect(screen.getByText(/1 area inside it/)).toBeInTheDocument();
  });

  it("asks before deleting, and holds until the name is typed exactly", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Delete area/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(/Are you sure\?/);
    const confirm = screen.getByRole("button", { name: /Delete permanently/ });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type/), {
      target: { value: "hudayriyat island" },
    });
    expect(confirm).toBeDisabled(); // case matters

    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: NAME } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(deleteArea).toHaveBeenCalledWith("area-1", NAME);
  });

  it("returns to the areas list once the area is gone", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Delete area/ }));
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: NAME } });
    fireEvent.click(screen.getByRole("button", { name: /Delete permanently/ }));
    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/pages/sub/area"),
    );
  });

  it("stays put when the server refuses", async () => {
    deleteArea.mockResolvedValue({ status: "error", message: "Still in use." });
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Delete area/ }));
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: NAME } });
    fireEvent.click(screen.getByRole("button", { name: /Delete permanently/ }));
    await vi.waitFor(() => expect(deleteArea).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("warns when menu or footer links point at the page", () => {
    setup({ usage: { ...EMPTY_AREA_USAGE, menuLinks: 2 } });
    fireEvent.click(screen.getByRole("button", { name: /Delete area/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      /2 menu or footer links point at its page/,
    );
  });

  it("offers no delete to a role that can't delete", () => {
    setup({ canDelete: false });
    expect(screen.getByRole("button", { name: /Delete area/ })).toBeDisabled();
    expect(screen.getByText(/but not delete it/)).toBeInTheDocument();
  });

  it("can be backed out of", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Delete area/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteArea).not.toHaveBeenCalled();
  });
});
