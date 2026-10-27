import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const actions = vi.hoisted(() => ({
  addMortgageNote: vi.fn(),
  startCaseDocument: vi.fn(),
  completeCaseDocument: vi.fn(),
  removeCaseDocument: vi.fn(),
}));
vi.mock("../_case-actions", () => actions);
// file-actions pulls in every other action module; only useAction is used here.
vi.mock("./file-actions", async () => {
  const { useTransition } = await import("react");
  return {
    useAction: () => {
      const [pending, start] = useTransition();
      return {
        pending,
        run: (action: () => Promise<{ ok: boolean }>, done?: (r: { ok: boolean }) => void) =>
          start(async () => done?.(await action())),
      };
    },
  };
});

import { CaseDocumentsCard, InternalNotesCard } from "./internal-cards";

/**
 * The file page is behind the mortgage team's sign-in, so this is where the
 * two cards (0171) are exercised: what they show, and that their forms call
 * the right action with the request's target.
 */

const target = { requestId: "11111111-1111-4111-8111-111111111111", reference: "BZM-26-0401", updatedAt: "2026-10-27T10:00:00Z" };
const yasmin = { id: "u1", name: "Yasmin Abdalla" } as never;

afterEach(() => vi.clearAllMocks());

describe("InternalNotesCard", () => {
  it("lists notes with author and time, and adds one through the action", async () => {
    actions.addMortgageNote.mockResolvedValue({ ok: true, message: "Note added." });
    render(
      <InternalNotesCard
        target={target}
        canAdd
        notes={[{ id: "n1", body: "Bank asked for a salary letter.", author: yasmin, when: "27 Oct, 10:05" }]}
      />,
    );
    expect(screen.getByText("Bank asked for a salary letter.")).toBeTruthy();
    expect(screen.getByText("Yasmin Abdalla · 27 Oct, 10:05")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Add a note for the team…"), { target: { value: "Valuation booked." } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() =>
      expect(actions.addMortgageNote).toHaveBeenCalledWith({ ...target, body: "Valuation booked." }),
    );
  });

  it("hides the form from someone who can't add", () => {
    render(<InternalNotesCard target={target} canAdd={false} notes={[]} />);
    expect(screen.queryByRole("button", { name: "Add note" })).toBeNull();
    expect(screen.getByText("No notes yet.")).toBeTruthy();
  });
});

describe("CaseDocumentsCard", () => {
  const doc = {
    id: "d1",
    title: "Offer letter",
    description: "Signed by the bank.",
    addedBy: yasmin,
    when: "27 Oct, 11:00",
    file: { id: "f1", name: "offer.pdf", mime: "application/pdf", sizeBytes: 250_000 },
  };

  it("shows each document with its count, description and logged open / download links", () => {
    render(<CaseDocumentsCard target={target} canAdd documents={[doc]} />);
    expect(screen.getByText("1 of 10")).toBeTruthy();
    expect(screen.getByText("Offer letter")).toBeTruthy();
    expect(screen.getByText("Signed by the bank.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open/ }).getAttribute("href")).toBe("/api/admin/mortgages/files/f1");
    expect(screen.getByRole("link", { name: /Download/ }).getAttribute("href")).toBe(
      "/api/admin/mortgages/files/f1?download=1",
    );
  });

  it("uploads: starts the document, PUTs the file to the signed URL, then completes it", async () => {
    actions.startCaseDocument.mockResolvedValue({
      ok: true, fileId: "f2", caseDocumentId: "d2", url: "https://bucket.test/upload", headers: { "content-type": "application/pdf" },
    });
    actions.completeCaseDocument.mockResolvedValue({ ok: true, message: "Document uploaded." });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<CaseDocumentsCard target={target} canAdd documents={[]} />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Valuation report" } });
    fireEvent.change(screen.getByLabelText("Short description"), { target: { value: "From the valuer." } });
    const pdf = new File(["%PDF-1.4"], "valuation.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("File"), { target: { files: [pdf] } });
    // Submitted directly: jsdom's `required` check can't see a file set this
    // way, where a browser sees the one the user picked.
    fireEvent.submit(screen.getByRole("button", { name: "Upload document" }).closest("form")!);

    await waitFor(() => expect(actions.startCaseDocument).toHaveBeenCalled());
    await waitFor(() => expect(actions.completeCaseDocument).toHaveBeenCalled());
    expect(actions.startCaseDocument).toHaveBeenCalledWith(
      expect.objectContaining({ ...target, title: "Valuation report", description: "From the valuer.", fileName: "valuation.pdf", mime: "application/pdf" }),
    );
    expect(fetchMock).toHaveBeenCalledWith("https://bucket.test/upload", expect.objectContaining({ method: "PUT", body: pdf }));
    expect(actions.completeCaseDocument).toHaveBeenCalledWith({ reference: target.reference, caseDocumentId: "d2", fileId: "f2" });
    vi.unstubAllGlobals();
  });

  it("offers no upload form once the case holds 10 documents", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...doc, id: `d${i}` }));
    render(<CaseDocumentsCard target={target} canAdd documents={ten} />);
    expect(screen.queryByRole("button", { name: "Upload document" })).toBeNull();
    expect(screen.getByText("This case already holds 10 documents.")).toBeTruthy();
  });
});
