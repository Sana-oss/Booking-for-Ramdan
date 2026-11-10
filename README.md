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
