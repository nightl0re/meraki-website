import "server-only";

// Outgoing email. No provider is connected yet: in development messages are
// printed to the server console so flows like password reset can be tested.
// To go live, send through Resend, Postmark, SES, ... here.
export async function sendEmail(to: string, subject: string, text: string) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`\n--- email to ${to} ---\nSubject: ${subject}\n\n${text}\n----------------------\n`);
    return;
  }
  console.warn(`[mail] No email provider configured; message "${subject}" was not sent.`);
}

export function appUrl(path: string) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}
