import "server-only";
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Payment provider interface + a simulated implementation.
//
// The rest of the app only talks to `payments` below, so moving to a real
// processor (Stripe, Adyen, ...) means writing one new class with these five
// methods. The simulator behaves like Stripe's test mode: authorize places a
// hold, capture charges (all or part of) it, void releases it.
//
// Test cards (any future expiry, any 3-digit CVC):
//   4242 4242 4242 4242  succeeds (Visa)
//   5555 5555 5555 4444  succeeds (Mastercard)
//   3782 822463 10005    succeeds (Amex, 4-digit CVC)
//   4000 0000 0000 0002  declined when charged
//   4000 0000 0000 9995  insufficient funds when charged
// ---------------------------------------------------------------------------

export type CardInput = {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  holderName: string;
};

export type TokenizeResult =
  | { ok: true; token: string; brand: string; last4: string; expMonth: number; expYear: number }
  | { ok: false; field: "number" | "expiry" | "cvc"; message: string };

export type ChargeResult = { ok: true; ref: string } | { ok: false; reason: string };

export interface PaymentProvider {
  tokenizeCard(card: CardInput): Promise<TokenizeResult>;
  authorize(methodToken: string, amountCents: number): Promise<ChargeResult>;
  capture(ref: string, amountCents: number): Promise<{ ok: boolean }>;
  void(ref: string): Promise<{ ok: boolean }>;
  refund(ref: string, amountCents: number): Promise<{ ok: boolean }>;
}

export function luhnValid(digits: string) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export function cardBrand(digits: string) {
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^6(011|5)/.test(digits)) return "Discover";
  return "Card";
}

const id = (prefix: string) => `${prefix}_${randomBytes(12).toString("hex")}`;

class SimulatedProvider implements PaymentProvider {
  async tokenizeCard(card: CardInput): Promise<TokenizeResult> {
    const digits = card.number.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) {
      return { ok: false, field: "number", message: "That card number isn't valid." };
    }
    const now = new Date();
    const year = card.expYear < 100 ? 2000 + card.expYear : card.expYear;
    const expired =
      year < now.getFullYear() || (year === now.getFullYear() && card.expMonth < now.getMonth() + 1);
    if (card.expMonth < 1 || card.expMonth > 12 || expired || year > now.getFullYear() + 20) {
      return { ok: false, field: "expiry", message: "Check the expiry date." };
    }
    const brand = cardBrand(digits);
    const cvcLen = brand === "Amex" ? 4 : 3;
    if (!new RegExp(`^\\d{${cvcLen}}$`).test(card.cvc)) {
      return { ok: false, field: "cvc", message: `Enter the ${cvcLen}-digit security code.` };
    }
    // The behaviour of special test numbers is carried in the token itself.
    const behaviour =
      digits === "4000000000000002" ? "decline_" : digits === "4000000000009995" ? "nofunds_" : "";
    // The full number and CVC go out of scope here and are never stored.
    return {
      ok: true,
      token: id(`pm_sim_${behaviour}`.replace(/_$/, "")),
      brand,
      last4: digits.slice(-4),
      expMonth: card.expMonth,
      expYear: year,
    };
  }

  async authorize(methodToken: string, amountCents: number): Promise<ChargeResult> {
    if (amountCents <= 0) return { ok: false, reason: "Invalid amount." };
    if (methodToken.startsWith("pm_sim_decline")) {
      return { ok: false, reason: "Your card was declined. Try another card." };
    }
    if (methodToken.startsWith("pm_sim_nofunds")) {
      return { ok: false, reason: "Your card has insufficient funds." };
    }
    return { ok: true, ref: id("pi_sim") };
  }

  async capture() {
    return { ok: true };
  }

  async void() {
    return { ok: true };
  }

  async refund() {
    return { ok: true };
  }
}

export const payments: PaymentProvider = new SimulatedProvider();
