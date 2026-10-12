import { config } from "./config";

// Wall-clock parts of an instant in the app time zone.
export function zonedParts(date: Date, timeZone = config.timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

// "2026-10-14" + "18:30" in the app time zone -> UTC instant.
export function zonedToUtc(dateStr: string, timeStr: string, timeZone = config.timeZone) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Find the zone offset at that moment and correct for it (twice, for DST edges).
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(ts), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    ts += guess - asUtc;
  }
  return new Date(ts);
}

export function minuteOfDay(date: Date) {
  const p = zonedParts(date);
  return p.hour * 60 + p.minute;
}

// "YYYY-MM-DD" of an instant in the app time zone (for <input type="date">).
export function toDateInput(date: Date) {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export const HOUR = 60 * 60 * 1000;
