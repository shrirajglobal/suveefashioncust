/**
 * Locale-safe date parsing for CSV imports.
 * Avoids `new Date(string)` ambiguity (DD/MM vs MM/DD) and timezone shifts
 * caused by parsing as UTC then formatting with toISOString().
 */

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "auto";

export type ParseResult =
  | { ok: true; date: Date }
  | { ok: false; reason: string };

/**
 * Build a Date at LOCAL noon to avoid any TZ shift when later formatted
 * with toDbDateString() or compared by .getDate().
 */
function localNoon(year: number, month1to12: number, day: number): Date {
  return new Date(year, month1to12 - 1, day, 12, 0, 0, 0);
}

function isValidYMD(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 2000 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  // Verify the date actually exists (e.g. reject 31/02)
  const probe = localNoon(y, m, d);
  return (
    probe.getFullYear() === y &&
    probe.getMonth() === m - 1 &&
    probe.getDate() === d
  );
}

/**
 * Parse a raw CSV date string using an explicit format.
 * - Trims, normalises separators (- . / -> /)
 * - Rejects ambiguous values when fmt='auto' unless ISO or day>12
 * - Returns a local-noon Date so it survives any toLocale/toString round-trip
 */
export function parseImportDate(raw: string | undefined | null, fmt: DateFormat): ParseResult {
  if (raw === undefined || raw === null) {
    return { ok: false, reason: "empty value" };
  }
  const trimmed = String(raw).trim();
  if (!trimmed) return { ok: false, reason: "empty value" };

  // ISO YYYY-MM-DD (always unambiguous)
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (!isValidYMD(y, m, d)) return { ok: false, reason: `invalid ISO date "${trimmed}"` };
    if (fmt !== "auto" && fmt !== "YYYY-MM-DD") {
      // ISO is unambiguous and acceptable regardless of selected format
    }
    return { ok: true, date: localNoon(y, m, d) };
  }

  // Normalise other separators to /
  const norm = trimmed.replace(/[.\-]/g, "/");
  const parts = norm.split("/").map((p) => p.trim());
  if (parts.length !== 3) {
    return { ok: false, reason: `unrecognised date format "${trimmed}"` };
  }

  const [a, b, c] = parts.map(Number);
  if ([a, b, c].some((n) => !Number.isFinite(n))) {
    return { ok: false, reason: `non-numeric date "${trimmed}"` };
  }

  // 4-digit year must be in position 3 (we don't accept YYYY/MM/DD with slashes here)
  if (c < 1000) {
    return { ok: false, reason: `year must be 4 digits in "${trimmed}"` };
  }

  let day: number, month: number;
  const year = c;

  if (fmt === "DD/MM/YYYY") {
    day = a; month = b;
  } else if (fmt === "MM/DD/YYYY") {
    month = a; day = b;
  } else if (fmt === "YYYY-MM-DD") {
    return { ok: false, reason: `expected YYYY-MM-DD but got "${trimmed}"` };
  } else {
    // auto: only safe when one interpretation is impossible
    const looksLikeDDMM = a > 12 && b <= 12;
    const looksLikeMMDD = b > 12 && a <= 12;
    if (looksLikeDDMM) { day = a; month = b; }
    else if (looksLikeMMDD) { month = a; day = b; }
    else {
      return {
        ok: false,
        reason: `ambiguous date "${trimmed}" — please re-import and choose an explicit date format`,
      };
    }
  }

  if (!isValidYMD(year, month, day)) {
    return { ok: false, reason: `invalid date "${trimmed}" for selected format ${fmt}` };
  }

  return { ok: true, date: localNoon(year, month, day) };
}

/**
 * Format a Date as YYYY-MM-DD using LOCAL components.
 * NEVER use d.toISOString().split('T')[0] — that shifts the day in non-UTC zones.
 */
export function toDbDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
