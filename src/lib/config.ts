// Business rules live here so they are easy to find and change.

export const config = {
  appName: "Meraki",
  // Defaults are for the Malaysia launch. Another country only needs these
  // environment variables changed (currency, locale, time zone, geocoder country).
  currency: process.env.NEXT_PUBLIC_CURRENCY ?? "MYR",
  locale: process.env.NEXT_PUBLIC_LOCALE ?? "en-MY",
  // Bookings are entered and shown in this time zone.
  timeZone: process.env.APP_TIMEZONE ?? "Asia/Kuala_Lumpur",

  // Parent pays rate x hours + a service fee. The sitter keeps the full rate.
  serviceFeeRate: 0.1,
  serviceFeeMinCents: 250,

  minBookingHours: 1,
  maxBookingHours: 12,
  minLeadTimeHours: 2, // earliest a booking can start
  maxDaysAhead: 90,
  sitterResponseHours: 24, // request expires if the sitter doesn't answer

  // Free cancellation until this many hours before the start; after that the
  // parent pays lateCancelFeeRate of the subtotal (the sitter receives it).
  freeCancelHours: 24,
  lateCancelFeeRate: 0.5,

  // After the sitter marks a job completed, the parent has this long to
  // confirm or report a problem; after that it counts as confirmed and goes
  // to an admin for payment approval. The card is only charged on approval.
  autoConfirmHours: 48,

  // Normally a sitter can mark a job completed only once it has started.
  // While testing the flow (bookings in the future), set
  // ALLOW_EARLY_COMPLETION=1 to allow it straight after accepting.
  // Parents and admins still have to confirm, so nobody is paid by mistake.
  allowEarlyCompletion: process.env.ALLOW_EARLY_COMPLETION === "1",

  minRateCents: 1000,
  maxRateCents: 10000,

  sessionDays: 30, // absolute session lifetime
  sessionIdleDays: 7, // signed out after a week without visits
  maxFailedLogins: 8, // then the account is locked for lockMinutes
  lockMinutes: 15,
  resetTokenMinutes: 30,

  // Job board
  jobMaxDaysAhead: 60,
  jobSearchRadiusKm: 15,
} as const;
