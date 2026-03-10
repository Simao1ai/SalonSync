# SalonSync — Claude Code Context

> Read this file before every session. This is the single source of truth for the project.

---

## What Is SalonSync?

SalonSync is a **multi-tenant SaaS platform for hair salons**. It handles appointment scheduling, staff and client management, payment processing, cancellation fee enforcement, employee ratings, and AI-powered features — all from one platform.

**Target users:** Salon owners (admin), stylists (staff), and salon clients.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS (utility classes only, no custom CSS unless necessary) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma (`src/lib/prisma.ts`) |
| Auth | Supabase Auth (`src/lib/supabase.ts`) |
| Payments | Stripe (`src/lib/stripe.ts`) |
| AI | Claude API — Anthropic (`src/lib/claude.ts`) |
| Email | Resend |
| SMS | Twilio |

---

## Project Structure

```
salonsync/
├── src/
│   ├── app/
│   │   ├── (auth)/               # Public: login, register
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/          # Protected: role-based dashboards
│   │   │   ├── admin/            # Salon owner views
│   │   │   ├── staff/            # Stylist views
│   │   │   └── client/           # Client booking portal
│   │   ├── api/                  # API route handlers
│   │   │   ├── appointments/
│   │   │   ├── auth/
│   │   │   ├── payments/
│   │   │   ├── staff/
│   │   │   ├── ai/
│   │   │   └── webhooks/
│   │   │       └── stripe/       # Stripe webhook handler
│   │   └── layout.tsx
│   ├── components/
│   │   ├── calendar/             # Calendar and scheduling UI
│   │   ├── booking/              # Booking flow components
│   │   ├── dashboard/            # Dashboard widgets
│   │   └── ui/                   # Shared UI primitives (buttons, modals, etc.)
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client (use this for auth)
│   │   ├── stripe.ts             # Stripe helpers (charges, refunds, cancel fees)
│   │   ├── prisma.ts             # Prisma client singleton
│   │   └── claude.ts             # All AI features live here
│   └── types/
│       └── index.ts              # Shared TypeScript types
├── prisma/
│   └── schema.prisma             # Full DB schema — always reference this
├── public/
├── .env.local                    # Never commit this
├── .env.example                  # Committed template
├── CLAUDE.md                     # This file
└── README.md
```

---

## Database Models (from prisma/schema.prisma)

These are the core models. Always reference `prisma/schema.prisma` for the full field list.

| Model | Purpose |
|---|---|
| `User` | Admins, staff, and clients. Role field = `ADMIN`, `STAFF`, `CLIENT` |
| `Location` | Each salon location. Users and appointments belong to a location |
| `Service` | Services offered. Category = `STANDARD` or `HIGH_VALUE` |
| `Appointment` | Core booking record. Has risk score, payment status, cancellation data |
| `AppointmentService` | Join table — appointments can include multiple services |
| `Payment` | Payment transactions linked to appointments |
| `Review` | Client reviews of staff. Includes AI sentiment fields |
| `Availability` | Staff working hours and blocked times |
| `GiftCard` | Digital gift cards with balance tracking |
| `ServicePackage` | Pre-paid service bundles |
| `Notification` | In-app notifications for all user types |
| `Reminder` | Scheduled appointment reminders (48hr, 24hr, high-risk) |
| `Product` | Retail products for AI recommendation feature |
| `ProductRecommendation` | AI-generated product suggestions per service |
| `Analytics` | Daily aggregated stats per location |

---

## User Roles & Routing

| Role | Login Redirect | Access |
|---|---|---|
| `ADMIN` | `/admin/dashboard` | Full access — all locations, all staff, all analytics |
| `STAFF` | `/staff/dashboard` | Own calendar, own appointments, own ratings |
| `CLIENT` | `/client/dashboard` | Booking portal, own appointments, own billing |

- Role is stored on the `User` model in Prisma
- Auth is handled by Supabase Auth — use `supabase.ts` for session management
- Always protect dashboard routes with middleware that checks role

---

## Key Business Rules — CRITICAL

These rules must be enforced in every relevant API route and UI flow:

### High-Value Appointments
- Services with `category = HIGH_VALUE` (highlights, extensions) **must** collect full prepayment or a configured deposit at booking
- These appointments must have a card on file via Stripe
- Flag `isHighValue = true` on the `Appointment` record
- Trigger cancellation risk scoring automatically on creation

### Cancellation Policy
- Default cancellation window = **48 hours** before appointment
- If client cancels **before** the window → full refund automatically via Stripe
- If client cancels **after** the window → charge cancellation fee to card on file
- If client **no-shows** → charge full service amount to card on file
- All fee logic lives in `src/lib/stripe.ts` — use `chargeCancellationFee()`
- Client must acknowledge the policy (checkbox) at time of booking — store this acknowledgment

### Pricing Model
- $20/month base fee per location + $10/month per seat
- Seat = any user with role `ADMIN`, `STAFF`, or secretary (also STAFF role)

---

## AI Features (src/lib/claude.ts)

All AI features use the **Claude API (Anthropic)**. Functions are already scaffolded in `src/lib/claude.ts`.

| Function | Trigger | What it does |
|---|---|---|
| `chatWithReceptionist()` | Client booking portal | 24/7 chatbot for booking and FAQs |
| `scoreCancellationRisk()` | On appointment creation | Returns LOW/MEDIUM/HIGH risk + factors |
| `analyzeReviewSentiment()` | On review submission | Returns sentiment score + tags |
| `getProductRecommendations()` | On appointment completion | Suggests retail products to stylist |

**Future AI (Phase 3):**
- Smart rebooking predictions (cron job, analyzes booking intervals)
- Dynamic pricing suggestions (demand pattern analysis)
- Predictive analytics (revenue + churn forecasting)

---

## Coding Conventions

- **TypeScript strict mode** — no `any` types, ever
- **Server Components by default** — only use `"use client"` when you need interactivity or hooks
- **API routes** go in `src/app/api/` using Next.js Route Handlers
- **Prisma queries** always go through `src/lib/prisma.ts` — never instantiate PrismaClient directly
- **Error handling** — all API routes must return proper HTTP status codes and JSON error messages
- **Environment variables** — server-only vars (no `NEXT_PUBLIC_` prefix) must never be exposed to the client
- **Components** — keep components small and focused. Extract reusable UI to `src/components/ui/`
- **Stripe amounts** — always work in **cents** (e.g., $50.00 = 5000)
- **Dates** — always store in UTC, display in the location's timezone

---

## Development Phases

### ✅ Phase 1 — MVP (Build this first)
- [ ] Auth flow (login, register, role-based routing)
- [ ] Admin, staff, client dashboards (basic)
- [ ] Service management (CRUD)
- [ ] Appointment scheduling + calendar
- [ ] Stripe payments + deposits
- [ ] Cancellation policy enforcement (48hr, auto fee charge)
- [ ] Multi-location support
- [ ] Two-way Google Calendar sync
- [ ] Gift cards & service packages

### 🔲 Phase 2 — AI + Core Features
- [ ] High-value appointment flow (highlights, extensions)
- [ ] Employee rating system + AI sentiment analysis
- [ ] AI cancellation risk scoring (on booking)
- [ ] AI smart rebooking predictions (cron nudges)
- [ ] AI receptionist chatbot (client portal)
- [ ] Analytics dashboard (revenue, cancellations, staff performance)

### 🔲 Phase 3 — Growth
- [ ] AI dynamic pricing suggestions
- [ ] AI product recommendations at checkout
- [ ] Predictive analytics + forecasting
- [ ] Mobile app (iOS/Android)
- [ ] Loyalty/rewards program

---

## Environment Variables Required

See `.env.example` for the full list. Minimum required to run:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ANTHROPIC_API_KEY
```

---

## Current Status

- [x] Prisma schema defined (`prisma/schema.prisma`)
- [x] Core lib files scaffolded (`supabase.ts`, `stripe.ts`, `prisma.ts`, `claude.ts`)
- [x] TypeScript types defined (`src/types/index.ts`)
- [ ] Next.js project initialized
- [ ] Auth flow built
- [ ] Dashboards built
- [ ] Booking flow built

---

## When In Doubt

1. Check `prisma/schema.prisma` for data model field names
2. Check `src/types/index.ts` for TypeScript interfaces
3. Check `src/lib/` for existing helper functions before writing new ones
4. Follow the phase order — don't build Phase 2 features before Phase 1 is working
