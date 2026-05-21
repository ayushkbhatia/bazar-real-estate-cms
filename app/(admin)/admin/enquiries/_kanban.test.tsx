import { describe, it, expect } from "vitest";
import { KANBAN_COLUMNS } from "./_kanban";

describe("KANBAN_COLUMNS", () => {
  it("matches the enquiry_status enum in order", () => {
    expect(KANBAN_COLUMNS.map((c) => c.status)).toEqual([
      "new",
      "qualified",
      "viewing_scheduled",
      "offer",
      "closed_won",
      "closed_lost",
    ]);
  });

  it("every column has a readable label and accent colour", () => {
    for (const col of KANBAN_COLUMNS) {
      expect(col.label.length).toBeGreaterThan(2);
      expect(col.accent).toMatch(/oklch|var/);
    }
  });
});
