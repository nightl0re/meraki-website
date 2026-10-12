import { config } from "./config";

const money = new Intl.NumberFormat(config.locale, {
  style: "currency",
  currency: config.currency,
});

export function formatMoney(cents: number) {
  return money.format(cents / 100);
}

export function formatRate(cents: number) {
  return `${formatMoney(cents)}/hr`;
}

const dateFmt = new Intl.DateTimeFormat(config.locale, {
  timeZone: config.timeZone,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const longDateFmt = new Intl.DateTimeFormat(config.locale, {
  timeZone: config.timeZone,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(config.locale, {
  timeZone: config.timeZone,
  hour: "numeric",
  minute: "2-digit",
});
const shortDateFmt = new Intl.DateTimeFormat(config.locale, {
  timeZone: config.timeZone,
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const formatDate = (d: Date) => dateFmt.format(d);
export const formatLongDate = (d: Date) => longDateFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d);
export const formatShortDate = (d: Date) => shortDateFmt.format(d);
export const formatTimeRange = (a: Date, b: Date) => `${formatTime(a)} to ${formatTime(b)}`;

export function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

export function timeAgo(d: Date, now = new Date()) {
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.round(h / 24);
  if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
  return formatShortDate(d);
}

export function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
