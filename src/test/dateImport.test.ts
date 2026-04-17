import { describe, it, expect } from "vitest";
import { parseImportDate, toDbDateString } from "@/lib/dateImport";

describe("parseImportDate — DD/MM/YYYY (Indian)", () => {
  it("parses 01/02/2024 as 1 Feb 2024", () => {
    const r = parseImportDate("01/02/2024", "DD/MM/YYYY");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.date.getFullYear()).toBe(2024);
      expect(r.date.getMonth()).toBe(1); // Feb
      expect(r.date.getDate()).toBe(1);
    }
  });

  it("parses 13/02/2024 as 13 Feb 2024 (was previously dropped)", () => {
    const r = parseImportDate("13/02/2024", "DD/MM/YYYY");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.date.getDate()).toBe(13);
      expect(r.date.getMonth()).toBe(1);
    }
  });

  it("rejects 31/02/2024 (invalid)", () => {
    const r = parseImportDate("31/02/2024", "DD/MM/YYYY");
    expect(r.ok).toBe(false);
  });

  it("accepts dash and dot separators", () => {
    expect(parseImportDate("13-02-2024", "DD/MM/YYYY").ok).toBe(true);
    expect(parseImportDate("13.02.2024", "DD/MM/YYYY").ok).toBe(true);
  });
});

describe("parseImportDate — MM/DD/YYYY (US)", () => {
  it("parses 01/02/2024 as 2 Jan 2024", () => {
    const r = parseImportDate("01/02/2024", "MM/DD/YYYY");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.date.getMonth()).toBe(0); // Jan
      expect(r.date.getDate()).toBe(2);
    }
  });
});

describe("parseImportDate — ISO YYYY-MM-DD", () => {
  it("parses 2024-02-01 unambiguously regardless of selected format", () => {
    for (const fmt of ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "auto"] as const) {
      const r = parseImportDate("2024-02-01", fmt);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.date.getMonth()).toBe(1);
        expect(r.date.getDate()).toBe(1);
      }
    }
  });
});

describe("parseImportDate — auto mode", () => {
  it("rejects ambiguous 01/02/2024", () => {
    const r = parseImportDate("01/02/2024", "auto");
    expect(r.ok).toBe(false);
  });

  it("accepts unambiguous 13/02/2024 as DD/MM", () => {
    const r = parseImportDate("13/02/2024", "auto");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date.getDate()).toBe(13);
  });
});

describe("parseImportDate — invalid input", () => {
  it.each(["", "   ", "Feb 1 2024", "2024/02/01", "abc", "1/2/24"])(
    "rejects %s",
    (val) => {
      const r = parseImportDate(val, "DD/MM/YYYY");
      expect(r.ok).toBe(false);
    }
  );
});

describe("toDbDateString — TZ-safe", () => {
  it("returns local date components (no UTC shift)", () => {
    const d = new Date(2024, 1, 1, 12, 0, 0); // 1 Feb 2024 local noon
    expect(toDbDateString(d)).toBe("2024-02-01");
  });

  it("matches parseImportDate round-trip", () => {
    const r = parseImportDate("13/02/2024", "DD/MM/YYYY");
    expect(r.ok).toBe(true);
    if (r.ok) expect(toDbDateString(r.date)).toBe("2024-02-13");
  });
});
