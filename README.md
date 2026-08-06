# Pilot Thread Mills

Digital operations platform for a thread manufacturing business. Built as a **Next.js web app** with **PWA** support so employees can install it on their phones.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React, Tailwind CSS |
| Database & Auth | Supabase (Postgres + Auth) |
| Deployment | Vercel |
| PWA | `@ducanh2912/next-pwa` |

## Authentication (v1)

**Employees** sign in with **phone number + PIN** — no SMS/OTP charges.

- Phone is mapped to a private Supabase Auth email (`919876543210@employee.pilotthreadmills.internal`)
- PIN is stored as the auth password (hashed by Supabase)
- Profile data (name, role) lives in the `profiles` table

**Future customers** can use `auth_method = otp_whatsapp` on the same `profiles` table without changing the core schema.

### Roles

- `admin` — full access, can add employees
- `manager` — operations oversight (modules coming)
- `operator` — shop-floor access (modules coming)

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/Pilot-Thread-Mills.git
cd Pilot-Thread-Mills
npm install
```

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. Run the migration in **SQL Editor** (paste contents of `supabase/migrations/20260702120000_initial_schema.sql`)  
   Or link the CLI: `npx supabase link` then `npx supabase db push`

### 3. Create the first admin

```bash
ADMIN_PHONE=9876543210 ADMIN_PIN=1234 ADMIN_NAME="Owner Name" npm run seed:admin
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login) and sign in with the admin phone + PIN.

## Deploy to Vercel

1. Push this repo to GitHub (`Pilot-Thread-Mills`)
2. Import the repo in [vercel.com/new](https://vercel.com/new)
3. Add the same environment variables from `.env.local`
4. Deploy — Vercel auto-detects Next.js

## PWA install (employees)

On Android Chrome or iOS Safari:

1. Open the deployed app URL
2. Use **Add to Home Screen** / **Install app**
3. The app opens standalone from the home screen

## Approval push notifications (admin)

Admins with the **Approvals** module can receive one phone notification per pending item (invoice, advance, return, or price list change), even when the PWA is closed.

### Setup

1. Run the migration `supabase/migrations/20260806170000_push_subscriptions.sql`
2. Generate VAPID keys: `npm run push:generate-vapid-keys`
3. Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to `.env.local` and Vercel
4. Deploy (push requires HTTPS; it does not work on local dev because the service worker is disabled there)

### On Android

1. Install the PWA from Chrome (**Add to Home screen**)
2. Sign in as an admin with Approvals access
3. Tap **Enable notifications** when prompted
4. Each new approval triggers its own notification; tap it to open `/approvals`

## API routes (v1)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | Employee phone + PIN sign-in |
| `/api/auth/logout` | POST | Sign out |
| `/api/admin/employees` | POST | Create employee (admin only) |

## Roadmap

- **v1** — Auth, dashboard shell, PWA *(current)*
- **v1.1** — Production & inventory modules
- **v1.2** — Orders & dispatch
- **v2** — Customer portal with WhatsApp OTP option

## Project structure

```
src/
  app/           # Pages and API routes
  lib/
    auth/        # Phone normalization, types
    supabase/    # Browser, server, admin clients
supabase/
  migrations/    # Database schema
scripts/
  seed-admin.ts  # Bootstrap first admin
```
