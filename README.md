<p align="center"><img src="public/brand/meraki-icon.png" width="96" alt="Meraki logo"></p>

# Meraki: caring babysitters, near you

Meraki is a babysitting marketplace, launching first in the Klang Valley, Malaysia. Currency, language, time zone and geocoder country are settings, so it can run in any country. Parents find verified sitters near their address, request a time, and are only charged after the job. Sitters set their own rate, hours and travel distance. An admin team verifies sitters, settles disputes and sends payouts.

This is the web rebuild of the original Meraki Windows Forms app. It keeps the brand, colors and features of the desktop app and redesigns the structure, booking flow and payments.

## Features

**Parents**
- Home dashboard like the original app: greeting, quick actions, things that need attention, upcoming bookings, "Book again", family and payment cards, notifications.
- Family profile with children (first name, birth year, notes such as allergies); pick which children each booking is for.
- Post a job with a time and budget; nearby sitters are notified and apply; compare applicants and hire in one click.
- Search by address, ZIP code, neighborhood or "use my location". Results show sitters who travel to you, nearest first (OpenStreetMap geocoding, cached in the database).
- Browse by neighborhood, filter by day, skill, price and rating.
- Book inside a sitter's real weekly availability. The price is shown live and nothing is charged up front.
- Message the sitter on each booking, save favorite sitters, see receipts, leave reviews.

**Sitters**
- Sign-up is an application: take a verification (face) photo with the camera or upload one, add a profile photo, profile, availability and phone, then submit. Until an admin approves it, the sitter only sees their application page. Admins compare the private verification photo with the profile photo, then approve, reject or ask for a change.
- Home dashboard like the original app: earnings, bookings, rating and hours tiles; accept/decline requests inline; month calendar schedule; jobs near you; profile card with badges and a profile-strength checklist.
- Job board: browse open jobs within your travel distance, apply with a message, track applications.
- Trust badges: ID verified, background check, CPR certified, languages; public response time and repeat families.
- Profile with photo, bio, skills, hourly rate, max children and travel radius.
- Weekly availability editor; pause new bookings at any time.
- Accept or decline requests, see the schedule, earnings and payouts. Sitters keep 100% of their rate.

**Admins**
- Approve or reject new sitters, suspend users.
- Resolve disputes with a full, partial or zero refund.
- Refund captured payments, send weekly payouts, see revenue and an audit log of every money movement.

## Booking and payment flow

```
1. Parent books            REQUESTED              card AUTHORIZED (hold, not charged)
2. Sitter accepts          ACCEPTED
3. Sitter marks completed  AWAITING_CONFIRMATION
4. Parent confirms         AWAITING_PAYMENT       (automatic after 48 h without an answer)
5. Admin approves payment  COMPLETED              card CAPTURED, sitter payout queued

Parent reports a problem (from step 2 until step 5) ──► DISPUTED ──► admin refunds 0-100%
Sitter declines / no answer in 24 h ──► hold released
Cancelled > 24 h before start ──► hold released; < 24 h ──► 50% charged, paid to the sitter
```

Every booking page shows these steps as a timeline with dates, for the parent, the sitter and admins. Admins approve payments under **Payments to approve**, and see every stage under **Bookings**.

A sitter can mark a job completed once it has started. To try the whole flow right away with bookings in the future, set `ALLOW_EARLY_COMPLETION=1` (the parent and an admin still have to confirm, so nothing is paid by accident). Remove it before launch.

All transitions live in [`src/lib/bookings.ts`](src/lib/bookings.ts). Each one only runs if the booking is still in the expected status, so double clicks and two tabs can't charge twice. A row lock stops two parents from booking the same slot. Money is stored as integer cents.

Payments use a **simulated provider** ([`src/lib/payments/provider.ts`](src/lib/payments/provider.ts)) that behaves like Stripe test mode. Only a token, brand and last 4 digits are saved; card numbers and CVCs are never stored. To go live, implement the same five methods (`tokenizeCard`, `authorize`, `capture`, `void`, `refund`) with Stripe or another processor, and replace the card form with the provider's hosted fields.

Test cards (any future expiry, any CVC):

| Number | Result |
| --- | --- |
| 4242 4242 4242 4242 | Succeeds (Visa) |
| 5555 5555 5555 4444 | Succeeds (Mastercard) |
| 4000 0000 0000 0002 | Declined |
| 4000 0000 0000 9995 | Insufficient funds |

## Pages for visitors

- `/about`: about Meraki and how it works for parents (search or post a job, booking, safety, pricing, FAQ).
- `/about/sitters`: how Meraki works for babysitters (onboarding, verification, requests and jobs, pay, expectations, FAQ).

## Security

- Verification photos are private: `/files/[id]` only returns them to the sitter who uploaded them and to admins, with `Cache-Control: private, no-store`. Uploads are checked by their first bytes, limited to 2 MB, and re-encoded in the browser, which also strips location metadata.
- `npm run db:seed`, `npm run db:samples` and `npm test` refuse to run when `DATABASE_URL` isn't on this computer, because they delete or write data. Set `ALLOW_REMOTE_DB=1` to override on purpose.

- Passwords hashed with bcrypt (cost 12), with a shared policy (length, letters and digits, common passwords blocked).
- Sessions: random token in an httpOnly, SameSite cookie; only its SHA-256 hash is stored. Rotated on login, 30-day absolute and 7-day idle expiry, all sessions revoked on password change/reset or suspension.
- Account lockout after 8 wrong passwords (15 minutes) plus database-backed rate limits on login, sign-up and password reset.
- Password reset with single-use, 30-minute, hashed tokens; responses never reveal whether an email exists.
- Every server action re-checks the session, role and ownership; redirects after login only go to pages that role may open.
- Headers: Content-Security-Policy, HSTS (production), X-Frame-Options/frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy, COOP.
- Card numbers and CVCs are never stored; uploads are type-checked by magic bytes and size-limited; addresses and phone numbers are only shared after a booking is accepted.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions) + **React 19** + **TypeScript**
- **PostgreSQL** (Prisma Postgres in production) with **Prisma** ORM
- Photos stored in the database (`StoredFile` table) and served by `/files/[id]`; resized in the browser before upload
- **Tailwind CSS v4**, Motion, Phosphor icons, Quicksand + Nunito fonts
- Sessions: random token in an httpOnly cookie, SHA-256 hash stored in the database; passwords hashed with bcrypt (cost 12)
- Zod validation on every form, rate-limited login and signup

## Getting started

Requirements: Node.js 20+. The database is PostgreSQL; for local development
Prisma can run one for you, no install needed.

```bash
npm install
npx prisma dev --name meraki --detach   # starts a local Postgres, prints its TCP URL
cp .env.example .env        # set DATABASE_URL to that postgres:// URL (and the other values)
npm run db:migrate          # create the tables
npm run db:seed             # demo data in Klang Valley neighbourhoods (Malaysia)
npm run dev                 # http://localhost:3000
```

Demo accounts (password `Meraki-demo-2026`):

| Role | Email |
| --- | --- |
| Parent | parent@meraki.test |
| Sitter | sitter@meraki.test |
| Admin | admin@meraki.test |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Booking, payment, job board and security tests against the database |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:migrate` | Apply schema changes in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Reset and fill demo data |

## Project structure

```
prisma/
  schema.prisma        database schema (users, profiles, bookings, payments, payouts, reviews...)
  seed.ts              demo data
src/
  app/(site)/          public pages: home, search, sitter profiles, login, signup
  app/(app)/           signed-in pages: dashboards, bookings, settings, admin
  app/actions/         server actions (auth, parent, sitter, bookings, admin, account)
  app/api/cron/        scheduled job endpoint
  components/          UI components
  lib/
    bookings.ts        booking state machine and money movements
    payments/          payment provider interface + simulator
    geo.ts, sitters.ts location search
    auth.ts            sessions, roles, rate limiting
    config.ts          business rules (fees, cancellation window, timings)
tests/                 booking flow tests
```

## Deploying to Vercel

1. In the Vercel project, open **Storage**, add **Prisma Postgres** and connect it to the project (use the prefix `DATABASE`, so the variable is `DATABASE_URL`). Photos are stored in the database, so no other storage is needed.
2. In **Settings → Environment Variables**, add `GEOCODER_USER_AGENT`, `CRON_SECRET` (a long random string) and `APP_URL` (your site's URL). The country settings default to Malaysia (`NEXT_PUBLIC_CURRENCY=MYR`, `NEXT_PUBLIC_LOCALE=en-MY`, `APP_TIMEZONE=Asia/Kuala_Lumpur`, `GEOCODER_COUNTRY=my`); set them only to launch in another country.
3. Redeploy. The `vercel-build` script runs `prisma migrate deploy` before `next build`, so the tables are created automatically. Pages are never prerendered, so the build doesn't touch the database.
4. Optional demo data: on your computer, run `npm run db:seed` with `DATABASE_URL` pointing at the production database. This **wipes** that database first and creates demo accounts with known passwords, so only do it for a demo site.

`vercel.json` schedules `/api/cron` daily (the most the Hobby plan allows); Vercel sends `CRON_SECRET` automatically. Time-based updates also run after page views, so they happen promptly while people use the site.

## Going to production

- `/api/cron` expires unanswered requests, auto-confirms finished jobs and prunes expired sessions. On a paid plan, run it every few minutes.
- Set `GEOCODER_USER_AGENT` with a contact email (OpenStreetMap's usage policy), or switch `geocode()` to a paid geocoder for higher volume.
- Replace the simulated payment provider with a real one (see above).
- Remove or change the demo and sample accounts (`prisma/seed.ts`, `prisma/sample-accounts.ts`) before real users arrive.
- Connect an email provider in `src/lib/mail.ts` (Resend, Postmark, SES...) and set `APP_URL`. Until then, password reset emails are printed to the server console in development, and notifications are in-app.
