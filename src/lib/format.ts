// Dates render in UTC so the server and the browser produce identical markup.
const day = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });
const dayYear = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const fmtDay = (iso: string | Date) => day.format(new Date(iso));
export const fmtDayYear = (iso: string | Date) => dayYear.format(new Date(iso));

export function fmtValue(value: number, unit: string) {
  const n = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (unit === "%") return `${n}%`;
  if (unit === "h" || unit === "ms") return `${n} ${unit}`;
  return unit ? `${n} ${unit}` : n;
}
