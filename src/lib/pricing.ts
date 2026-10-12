import { config } from "./config";

export type Quote = {
  hours: number;
  hourlyRateCents: number;
  subtotalCents: number;
  serviceFeeCents: number;
  totalCents: number;
};

// Single source of truth for what a booking costs. Used for the live preview
// in the browser and recomputed on the server when the booking is created.
export function quote(hourlyRateCents: number, minutes: number): Quote {
  const hours = Math.round((minutes / 60) * 100) / 100;
  const subtotalCents = Math.round((hourlyRateCents * minutes) / 60);
  const serviceFeeCents = Math.max(
    config.serviceFeeMinCents,
    Math.round(subtotalCents * config.serviceFeeRate),
  );
  return {
    hours,
    hourlyRateCents,
    subtotalCents,
    serviceFeeCents,
    totalCents: subtotalCents + serviceFeeCents,
  };
}

// What a parent is charged when cancelling late (inside freeCancelHours).
export function lateCancelChargeCents(subtotalCents: number) {
  return Math.round(subtotalCents * config.lateCancelFeeRate);
}
