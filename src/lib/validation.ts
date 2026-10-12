import { z } from "zod";

// Shared password policy for sign-up, change and reset.
const COMMON_PASSWORDS = new Set([
  "password123", "1234567890", "qwerty12345", "iloveyou123", "password1234", "abc1234567", "meraki12345",
]);

export const passwordRule = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use letters and at least one number.")
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), "That password is too common. Pick something less guessable.");

