/**
 * What a date field stores for a picked day:
 * - `"date"`: a `Date`, at local midnight.
 * - `"iso-date"`: the day as `YYYY-MM-DD`, as `z.iso.date()` accepts and a
 *   `date` column stores it.
 * - `"iso-datetime"`: the day's local midnight as an ISO 8601 timestamp in
 *   UTC (`toISOString()`), as `z.iso.datetime()` accepts and a timestamp
 *   column takes it.
 */
type DateValueType = "date" | "iso-date" | "iso-datetime"

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0")
}

// `new Date("2026-10-09")` reads a date-only string as UTC midnight, which is
// the day before anywhere west of UTC. Read it as the local day instead.
function parseIsoDate(value: string): Date | undefined {
  const match = ISO_DATE.exec(value)
  if (!match) {
    return
  }
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ]
  const date = new Date(year, month - 1, day)
  // `new Date` reads the years 0 to 99 as 1900 to 1999.
  date.setFullYear(year, month - 1, day)
  // `2026-02-31` would roll over to March.
  return date.getMonth() === month - 1 ? date : undefined
}

/**
 * The day a stored value stands for, as a local `Date`, or `undefined` for an
 * empty or unreadable one. Reads a `Date`, a `YYYY-MM-DD` string as that day
 * in local time, and any other string `Date` parses, such as an ISO 8601
 * timestamp.
 */
function parseDateValue(value: unknown): Date | undefined {
  let date: Date | undefined
  if (value instanceof Date) {
    date = value
  } else if (typeof value === "string" && value !== "") {
    date = ISO_DATE.test(value) ? parseIsoDate(value) : new Date(value)
  }
  return date && !Number.isNaN(date.getTime()) ? date : undefined
}

/** The day of a local `Date` as `YYYY-MM-DD`, without going through UTC. */
function formatIsoDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`
}

/** The value to store for `date`, a day picked in local time. */
function toDateValue(date: Date, type: DateValueType): Date | string {
  if (type === "iso-date") {
    return formatIsoDate(date)
  }
  if (type === "iso-datetime") {
    return date.toISOString()
  }
  return date
}

export type { DateValueType }
export { formatIsoDate, parseDateValue, toDateValue }
