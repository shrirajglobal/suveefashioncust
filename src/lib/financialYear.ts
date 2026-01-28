/**
 * Indian Financial Year utilities (April to March)
 * FY 2024-25 means April 2024 to March 2025
 */

/**
 * Get the financial year start year for a given date
 * e.g., Jan 2025 returns 2024 (FY 2024-25), May 2024 returns 2024 (FY 2024-25)
 */
export function getFinancialYear(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  // If month is Jan-Mar (0-2), it belongs to previous FY start year
  return month < 3 ? year - 1 : year;
}

/**
 * Get the start date of a financial year (April 1st)
 */
export function getFinancialYearStart(fyStartYear: number): Date {
  return new Date(fyStartYear, 3, 1, 0, 0, 0, 0); // April 1st
}

/**
 * Get the end date of a financial year (March 31st)
 */
export function getFinancialYearEnd(fyStartYear: number): Date {
  return new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999); // March 31st next year
}

/**
 * Get the current financial year date range
 */
export function getCurrentFinancialYearRange(): { start: Date; end: Date } {
  const now = new Date();
  const fyStartYear = getFinancialYear(now);
  return {
    start: getFinancialYearStart(fyStartYear),
    end: getFinancialYearEnd(fyStartYear),
  };
}

/**
 * Get financial year month index (0 = April, 11 = March)
 */
export function getFYMonthIndex(date: Date): number {
  const month = date.getMonth();
  // Convert calendar month to FY month (Apr=0, May=1, ..., Mar=11)
  return month >= 3 ? month - 3 : month + 9;
}

/**
 * Format financial year label (e.g., "FY 2024-25")
 */
export function formatFYLabel(startYear: number): string {
  return `FY ${startYear}-${(startYear + 1).toString().slice(-2)}`;
}

/**
 * Get the Indian fiscal quarter range for a given date
 * Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
 */
export function getCurrentFiscalQuarterRange(): { start: Date; end: Date } {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  let quarterStart: Date;
  let quarterEnd: Date;

  if (month >= 3 && month <= 5) {
    // Q1: April - June
    quarterStart = new Date(year, 3, 1, 0, 0, 0, 0);
    quarterEnd = new Date(year, 5, 30, 23, 59, 59, 999);
  } else if (month >= 6 && month <= 8) {
    // Q2: July - September
    quarterStart = new Date(year, 6, 1, 0, 0, 0, 0);
    quarterEnd = new Date(year, 8, 30, 23, 59, 59, 999);
  } else if (month >= 9 && month <= 11) {
    // Q3: October - December
    quarterStart = new Date(year, 9, 1, 0, 0, 0, 0);
    quarterEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  } else {
    // Q4: January - March
    quarterStart = new Date(year, 0, 1, 0, 0, 0, 0);
    quarterEnd = new Date(year, 2, 31, 23, 59, 59, 999);
  }

  return { start: quarterStart, end: quarterEnd };
}

/**
 * Financial year months in order (April to March)
 */
export const FY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
