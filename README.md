# Corinthia Hotel Tripoli — Ramadan Iftar Booking

Guests reserve Iftar seats for a date; staff confirm, check in or mark no-shows;
pending bookings expire automatically. Arabic (default, RTL) and English.

- **backend/** — Node.js 20+ / Express / Mongoose (MongoDB Atlas). Serves the API under `/api` and the static frontend.
- **frontend/** — static HTML/CSS/JS pages (no build step).

## Run locally

```bash
cd backend
cp .env.example .env      # then fill in MONGODB_URI and JWT_SECRET
npm ci
npm start                 # http://localhost:5000
```

The server refuses to start if `JWT_SECRET` is missing, shorter than 32
characters, or a placeholder.

First superadmin (only if none exists yet):

```bash
SETUP_ADMIN_USERNAME=<name> SETUP_ADMIN_PASSWORD=<12+ chars> npm run setup
```

## Upgrading an existing installation (one-time data migration)

Older versions kept checked-in / no-show bookings in a separate `bookingarchives`
collection. They now live in `bookings` with a status (`Arrived`, `No-Show`,
`Cancelled`, `Expired`) and a full `statusHistory`. The server refuses to start
until old archive records are migrated:

```bash
cd backend
npm run migrate              # dry run: shows exactly what will change
npm run migrate -- --apply   # writes a JSON backup to backend/backups/, then migrates
```

## Code layout

```
backend/
  server.js        startup: DB connection, expiry job, graceful shutdown
  app.js           Express app: security middleware, routes, static pages
  config/env.js    validated configuration
  routes/          auth, bookings (public + staff), admin (dashboard data, users)
  services/        booking lifecycle: create, change status, expire
  models/          Booking (single collection, status history), Admin
  utils/           business rules, errors
  scripts/         data migration
  test/            node:test suites (npm test)
```

## Booking lifecycle

```
Pending ──► Confirmed ──► Arrived | No-Show
   │            │
   └──► Cancelled / Expired ◄──┘
```

Pending bookings expire after `PENDING_EXPIRY_HOURS`. Closed bookings appear on
the Archives page; an admin can restore one (if the date still has capacity).
Every change records who, when and why.

## Tests

```bash
cd backend && npm test
```

## Production notes

- Published through **Cloudflare Tunnel** to this server on port 5000. Rate limits key on
  the `CF-Connecting-IP` header, so do not expose port 5000 directly to the internet.
- `.env` must **never** be committed. Use a MongoDB user with `readWrite` on `CorinthiaDB`
  only, and restrict the Atlas IP access list to the server's egress IP.
- Business rules are configurable via env: `MAX_DAILY_CAPACITY` (200),
  `PENDING_EXPIRY_HOURS` (24), `BUSINESS_TIMEZONE` (Africa/Tripoli).

## Roles

| Role | Can |
|---|---|
| staff | view bookings, change status, check-in / no-show |
| admin | + delete bookings, archives, create staff users |
| superadmin | + create admins, activate/deactivate users, reset passwords, delete users |
