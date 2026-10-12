// Business rules live here so they are easy to find and change.

export const config = {
  appName: "Meraki",
  currency: process.env.NEXT_PUBLIC_CURRENCY ?? "USD",
  locale: process.env.NEXT_PUBLIC_LOCALE ?? "en-US",
  // Bookings are entered and shown in this time zone.
  timeZone: process.env.APP_TIMEZONE ?? "UTC",

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

  // After a job ends the parent has this long to confirm or report a problem;
  // after that it is confirmed automatically and the card is charged.
  autoConfirmHours: 48,

  minRateCents: 1000,
  maxRateCents: 10000,

  sessionDays: 30,
} as const;
