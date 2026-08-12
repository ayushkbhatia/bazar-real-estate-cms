import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DeleteDevelopmentCard } from "./_delete-card";

// The card imports the server action by reference; that module reaches for the
// Supabase server client and next/cache, neither of which belongs in jsdom.
const deleteDevelopment = vi.fn();
vi.mock("../_actions", () => ({
  deleteDevelopment: (...args: unknown[]) => deleteDevelopment(...args),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const NAME = "Bayviews Saadiyat";

function setup(
  props: Partial<React.ComponentProps<typeof DeleteDevelopmentCard>> = {},
) {
  return render(
    <DeleteDevelopmentCard
      developmentId="dev-1"
      name={NAME}
      published={false}
      enquiryCount={0}
      propertyCount={0}
      canDelete
      recordHref="/admin/developments/dev-1"
      {...props}
    />,
  );
}

beforeEach(() => {
  deleteDevelopment.mockReset().mockResolvedValue({
    status: "ok",
    message: "Deleted.",
  });
  push.mockReset();
});

describe("DeleteDevelopmentCard", () => {
  it("refuses to delete a live project, and says what to do instead", () => {
    setup({ published: true });
    expect(screen.queryByRole("button", { name: /Delete project/ })).toBeNull();
    expect(screen.getByText(/can't be deleted yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Unpublish it" })).toHaveAttribute(
      "href",
      "/admin/developments/dev-1",
    );
  });

  it("holds the delete until the name is typed exactly", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Delete project/ }));
    const confirm = screen.getByRole("button", { name: /Delete permanently/ });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type/), {
      target: { value: "bayviews saadiyat" },
    });
    expect(confirm).toBeDisabled(); // case matters

    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: NAME } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(deleteDevelopment).toHaveBeenCalledWith("dev-1", NAME);
  });

  it("returns to the list once the project is gone", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Delete project/ }));
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: NAME } });
    fireEvent.click(screen.getByRole("button", { name: /Delete permanently/ }));
    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/pages/sub/development"),
    );
  });

  it("warns that enquiries and listings will lose their link", () => {
    // Both columns are ON DELETE SET NULL — the records survive, the link
    // doesn't, and that is not recoverable.
    setup({ enquiryCount: 3, propertyCount: 2 });
    expect(
      screen.getByText(/3 enquiries and 2 listings/),
    ).toBeInTheDocument();
  });

  it("reads naturally for a single linked record", () => {
    setup({ enquiryCount: 1, propertyCount: 0 });
    expect(screen.getByText(/1 enquiry/)).toBeInTheDocument();
    expect(screen.getByText(/that record/)).toBeInTheDocument();
  });

  it("says nothing about links when there are none", () => {
    setup();
    expect(screen.queryByText(/lose the link|clears the link/)).toBeNull();
  });

  it("offers no delete to a role that can't delete", () => {
    setup({ canDelete: false });
    expect(screen.getByRole("button", { name: /Delete project/ })).toBeDisabled();
    expect(screen.getByText(/but not delete it/)).toBeInTheDocument();
  });

  it("can be backed out of", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Delete project/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: /Delete permanently/ })).toBeNull();
    expect(deleteDevelopment).not.toHaveBeenCalled();
  });
});
