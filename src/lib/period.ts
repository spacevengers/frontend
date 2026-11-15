export const FIRST_YEAR = 2018;
export const YEARS = 8;
export const MONTH_COUNT = YEARS * 12;
export const LAST_YEAR = FIRST_YEAR + YEARS - 1;
export const DEFAULT_MONTH = (2025 - FIRST_YEAR) * 12 + 7;

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const yearOf = (mi: number) => FIRST_YEAR + Math.floor(mi / 12);
export const monthLabel = (mi: number) => `${MONTHS_LONG[mi % 12]} ${yearOf(mi)}`;
export const monthShort = (mi: number) => `${MONTHS[mi % 12]} ${yearOf(mi)}`;

export const toYearMonth = (mi: number) => `${yearOf(mi)}-${String((mi % 12) + 1).padStart(2, "0")}`;

export function fromYearMonth(value: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < FIRST_YEAR || year > LAST_YEAR || month < 1 || month > 12) return null;
  return (year - FIRST_YEAR) * 12 + month - 1;
}
