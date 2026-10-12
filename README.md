<p align="center"><img src="public/brand/meraki-icon.png" width="96" alt="Meraki logo"></p>

# Meraki: caring babysitters, near you

Meraki is a babysitting marketplace. Parents find verified sitters near their address, request a time, and are only charged after the job. Sitters set their own rate, hours and travel distance. An admin team verifies sitters, settles disputes and sends payouts.

This is the web rebuild of the original Meraki Windows Forms app. It keeps the brand, colors and features of the desktop app and redesigns the structure, booking flow and payments.

## Features

**Parents**
- Search by address, ZIP code, neighborhood or "use my location". Results show sitters who travel to you, nearest first (OpenStreetMap geocoding, cached in the database).
- Browse by neighborhood, filter by day, skill, price and rating.
- Book inside a sitter's real weekly availability. The price is shown live and nothing is charged up front.
- Message the sitter on each booking, save favorite sitters, see receipts, leave reviews.

**Sitters**
- Profile with photo, bio, skills, hourly rate, max children and travel radius.
- Weekly availability editor; pause new bookings at any time.
- Accept or decline requests, see the schedule, earnings and payouts. Sitters keep 100% of their rate.

**Admins**
- Approve or reject new sitters, suspend users.
- Resolve disputes with a full, partial or zero refund.
- Refund captured payments, send weekly payouts, see revenue and an audit log of every money movement.

## Booking and payment flow

```
Parent requests ──► card AUTHORIZED (hold, not charged)
   │
   ├─ sitter declines / no answer in 24h ──► hold VOIDED (released)
   ├─ cancelled > 24h before start ───────► hold VOIDED
   ├─ parent cancels < 24h before ───────► 50% CAPTURED, paid to sitter
   │
   ▼ sitter accepts
ACCEPTED ── job ends ──► parent confirms (or auto after 48h) ──► CAPTURED, payout queued
                    └─► parent reports a problem ──► DISPUTED ──► admin refunds 0-100%
```

All transitions live in [`src/lib/bookings.ts`](src/lib/bookings.ts). Each one only runs if the booking is still in the expected status, so double clicks and two tabs can't charge twice. A row lock stops two parents from booking the same slot. Money is stored as integer cents.

Payments use a **simulated provider** ([`src/lib/payments/provider.ts`](src/lib/payments/provider.ts)) that behaves like Stripe test mode. Only a token, brand and last 4 digits are saved; card numbers and CVCs are never stored. To go live, implement the same five methods (`tokenizeCard`, `authorize`, `capture`, `void`, `refund`) with Stripe or another processor, and replace the card form with the provider's hosted fields.

Test cards (any future expiry, any CVC):

| Number | Result |
| --- | --- |
| 4242 4242 4242 4242 | Succeeds (Visa) |
| 5555 5555 5555 4444 | Succeeds (Mastercard) |
| 4000 0000 0000 0002 | Declined |
| 4000 0000 0000 9995 | Insufficient funds |

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions) + **React 19** + **TypeScript**
- **MySQL 8** with **Prisma** ORM
- **Tailwind CSS v4**, Motion, Phosphor icons, Quicksand + Nunito fonts
- Sessions: random token in an httpOnly cookie, SHA-256 hash stored in the database; passwords hashed with bcrypt (cost 12)
- Zod validation on every form, rate-limited login and signup

## Getting started

Requirements: Node.js 20+, MySQL 8.

```bash
npm install
cp .env.example .env        # then set DATABASE_URL (and the other values)
npm run db:migrate          # create the tables
npm run db:seed             # demo data in New York neighborhoods
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
| `npm test` | Booking and payment flow tests against the database |
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

## Going to production

- Set `CRON_SECRET` and call `GET /api/cron` every 5 minutes with `Authorization: Bearer <secret>` so requests expire and jobs auto-confirm even when nobody is browsing.
- Set `GEOCODER_USER_AGENT` with a contact email (OpenStreetMap's usage policy), or switch `geocode()` to a paid geocoder for higher volume.
- Replace the simulated payment provider with a real one (see above).
- Profile photos are stored on local disk in `uploads/`; use object storage (S3, R2) when running more than one server.
- The login rate limiter is in memory; use Redis when running more than one server.
- Add transactional email (booking requests, confirmations, receipts). Notifications are currently in-app.
