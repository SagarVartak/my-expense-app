## 3D Printing Expense Tracker (Next.js)

This project contains:
- Login / logout screen
- Expense tracking + totals
- "Spent by person" summary
- Admin audit log panel
- Clean split components:
  - `Login`
  - `Summary`
  - `ExpensesTable`
  - `AuditTable`
- Backend auth via route handlers:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Signed httpOnly session cookie
- Bcrypt password hash verification on server
- Supabase-backed expenses + audit logs
- Admin user management API + UI (create/enable/disable)
- Expense filters by paid-by and date range
- Backend CSV import with quoted-field parsing

## Free storage options

Recommended:
- **Supabase (free)**: Postgres + APIs + optional auth
- **Firebase (free tier)**: Firestore + auth
- **Appwrite (free/self-host)**: DB + auth + storage

This repo is prepared for Supabase setup (`supabase/schema.sql` and `.env.example`).

## Supabase setup (recommended)

1. Create a free Supabase project.
2. Open SQL editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (recommended for server API routes)
   - `AUTH_SESSION_SECRET`
   - `ADMIN_PASSWORD_HASH`
   - `SAGAR_PASSWORD_HASH`

You can keep `ADMIN_PASSWORD_HASH` / `SAGAR_PASSWORD_HASH` empty to use built-in development hashes.
If you already created tables earlier, run the updated `supabase/schema.sql` again to add `app_users`.

## Run locally

Install dependencies and start:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Notes

- If Supabase env values are missing, API routes will return configuration errors.
- For production, set strong `AUTH_SESSION_SECRET` and custom password hashes.

