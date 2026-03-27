# SalonSync

## Overview

SalonSync is a production-grade, multi-tenant SaaS platform for hair salons. Built as a pnpm monorepo with TypeScript throughout. Features multi-location support, four user roles (Super Admin/Admin/Staff/Client), AI-powered appointment risk scoring, sentiment analysis, an AI receptionist chatbot, analytics, Stripe-ready payments, gift cards, reviews, notifications, and a full platform super-admin interface.

## Design Language

- **Background**: `#0F172A` (deep slate)
- **Accent**: `#C9956A` (rose-gold)
- **Headings**: Playfair Display
- **Body**: DM Sans
- **Tailwind CSS** with custom CSS variables in `index.css`

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24, **TypeScript**: 5.9
- **Frontend**: React + Vite (artifacts/salonsync)
- **Backend**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM (`@workspace/db`)
- **Auth**: Replit Auth (OpenID Connect) via `@workspace/replit-auth-web`
- **AI**: Anthropic Claude via `@workspace/integrations-anthropic-ai` (Replit-proxied, no API key needed)
- **API contract**: OpenAPI spec → Orval codegen → React Query hooks + Zod schemas
- **Payments**: Stripe UI built, connect account pending

## Monorepo Structure

```text
├── artifacts/
│   ├── api-server/          # Express 5 API server (port 8080)
│   └── salonsync/           # React + Vite frontend (port from $PORT)
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod validation schemas
│   ├── db/                  # Drizzle ORM schema + PostgreSQL client
│   ├── replit-auth-web/     # Replit Auth hooks for browser (useAuth)
│   └── integrations-anthropic-ai/  # Anthropic Claude client
├── scripts/                 # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

## Database Schema (19 tables)

- `enums` — appointmentStatus, paymentStatus, riskLevel, serviceCategory, userRole (includes SUPER_ADMIN)
- `locations` — salon locations with cancellation fee policy
- `users` (auth.ts) + `sessions` — Replit Auth users extended with role, phone, locationId, specialties, stripeCustomerId
- `services` — STANDARD/HIGH_VALUE services with base price, duration
- `appointments` — with risk score, cancellation tracking, fee charging
- `appointment_services` — M2M: appointment → services
- `payments` — Stripe payment records
- `reviews` — with AI sentiment score + tags
- `availability` — staff weekly schedules + block dates
- `gift_cards` — purchasable gift cards with balance
- `service_packages` — bundled service packages
- `notifications` — in-app notification feed
- `reminders` — scheduled appointment reminders
- `products` — retail products sold at salon
- `analytics` — daily aggregated metrics by location
- `conversations` (id serial, userId, title) — AI chat sessions
- `messages` (id serial, conversationId int FK) — AI chat messages
- `announcements` (id serial) — platform-wide announcements (title, message, type, targetRole, createdBy)
- `subscriptions` — tenant billing/subscription plans (locationId, plan, status, monthlyAmount)

## API Routes (all under `/api`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Health check |
| GET/POST | `/auth/user`, `/auth/login`, `/auth/callback`, `/auth/logout` | Replit Auth |
| GET/POST | `/locations` | List/create locations |
| GET/PUT/DELETE | `/locations/:id` | Get/update/deactivate location |
| GET/PUT | `/users`, `/users/:id` | List/update users |
| GET/POST | `/services` | List/create services |
| GET/PUT/DELETE | `/services/:id` | Get/update/deactivate service |
| GET/POST | `/appointments` | List/create appointments |
| GET/PUT | `/appointments/:id` | Get/update appointment |
| POST | `/appointments/:id/cancel` | Cancel with fee enforcement |
| GET/POST/DELETE | `/availability` | Staff availability |
| GET/POST | `/reviews` | List/create reviews |
| GET | `/analytics` | Analytics summary for location |
| GET/POST | `/gift-cards` | Gift card management |
| GET/POST | `/notifications` | Notifications + mark read |
| POST | `/ai/risk-score` | AI appointment risk scoring (Claude) |
| POST | `/ai/sentiment` | AI review sentiment analysis (Claude) |
| POST | `/ai/chat` | AI receptionist one-shot chat (Claude) |
| GET/POST/DELETE | `/anthropic/conversations` | Conversation management |
| GET/POST | `/anthropic/conversations/:id/messages` | SSE streaming chat |

## Frontend Pages

- `/` — Landing page (login redirect if not authenticated)
- `/admin/dashboard` — Admin: stats, recent appointments, risk badges
- `/admin/analytics` — Charts: revenue, appointments, cancellations (Recharts)
- `/staff/dashboard` — Staff: today's schedule, personal stats
- `/client/dashboard` — Client: upcoming appointments, book CTA, gift card balance
- `/client/book` — 4-step booking wizard: service → stylist → time → confirm
- `/admin/:page` — Stub fallback for admin sub-pages

## Key Behaviors

### Cancellation Fee Enforcement
When cancelling within `location.cancellationWindowHours` (default 48h):
- Standard services: 50% of total price charged
- HIGH_VALUE services: 100% of total price charged
- Fee logged to `appointments.cancelFeeCharged`

### AI Risk Scoring
On appointment creation, async POST to `/api/ai/risk-score`:
- Claude analyzes client history + day/time → returns LOW/MEDIUM/HIGH
- Score stored on the appointment, shown as colored badges in admin view

### AI Chatbot (SSE)
POST `/api/anthropic/conversations/:id/messages` streams `text/event-stream`:
- Events: `{"type":"text","text":"..."}` chunks, then `{"type":"done"}`
- Frontend uses `use-chat-stream.ts` hook (EventSource/fetch reader)

## Seeded Demo Data

A single location "SalonSync Downtown" (Beverly Hills, CA) with 6 services has been seeded:
- Classic Cut & Style ($85, STANDARD)
- Color Treatment ($225, HIGH_VALUE)
- Balayage ($350, HIGH_VALUE)
- Deep Conditioning ($65, STANDARD)
- Blowout ($55, STANDARD)
- Keratin Smoothing ($400, HIGH_VALUE)

## Codegen

After editing `lib/api-spec/openapi.yaml`:
```
pnpm --filter @workspace/api-spec run codegen
```
This regenerates both `lib/api-client-react` and `lib/api-zod`.

## DB Schema Push

```
pnpm --filter @workspace/db run push
```

## TypeScript Project References

Root `tsconfig.json` references all packages. API server depends on `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-anthropic-ai`, `@workspace/replit-auth-web`. Frontend depends on `@workspace/api-client-react`, `@workspace/replit-auth-web`.

## Recently Added Features

### Public Salon Marketplace (`/explore`)
- `GET /api/explore/locations` — public, no auth, aggregates avg rating + top 3 services per location
- `Explore.tsx` — card grid with search, sort (Top Rated / Lowest Price), price range filter
- "Find a Salon" button on Landing hero links to `/explore`

### Staff Schedule Calendar (`/admin/schedule`)
- `GET /api/schedule?locationId=&weekOf=` — returns appointments + staff + availability for the week
- `PATCH /api/appointments/:id/reschedule` — changes staffId/startTime, recalculates endTime
- `AdminSchedule.tsx` — staff-as-columns weekly grid with @dnd-kit drag-and-drop
- Drag appointment blocks to reassign staff or move to a different day
- AI risk score badges (LOW/MED/HIGH), block-time overlays, appointment detail modal
- Added "Schedule" link to Admin sidebar

### Deep Financial Reporting (`/admin/analytics`)
- Analytics page refactored into tabbed layout:
  - **Overview** — all existing KPI cards, charts, staff table (unchanged)
  - **Stylist Productivity** — per-stylist revenue, avg ticket, cancellation/no-show rates
  - **Revenue Per Chair** — utilization % (booked vs available minutes), dual-axis chart
  - **Retail Sales** — top services by revenue, products catalog, performance table
  - **Multi-Location** — network-wide revenue/appointments/ratings comparison
- Custom date range picker alongside preset buttons (7/30/90 days)
- 4 new API endpoints: `GET /api/analytics/stylist-productivity`, `/revenue-per-chair`, `/retail-sales`, `/multi-location`

### Platform Super Admin Interface
- **Four roles**: SUPER_ADMIN, ADMIN, STAFF, CLIENT — `SUPER_ADMIN` has full platform access
- **Production setup**: POST `/api/auth/make-super-admin` secured by `PLATFORM_SETUP_KEY` env var; UI at `/setup-platform`
- **Dev login**: "Super Admin" button in DEV switcher (seed user `seed-superadmin-001`)
- **Platform pages** (violet/indigo theme via `PlatformLayout.tsx`):
  - `/platform/dashboard` — network-wide KPIs, revenue chart, recent activity
  - `/platform/tenants` — salon list with metrics, "Add Salon" modal, subscription plan badges
  - `/platform/users` — all users with role filters, "Login As" (impersonation) button per user
  - `/platform/announcements` — create/delete platform-wide announcements (info/warning/alert/update types, targetable by role)
  - `/platform/analytics` — aggregated charts, salon performance breakdown
  - `/platform/support` — high-risk alerts, cancellation monitoring
- **User impersonation**: POST `/api/platform/impersonate/:userId` creates a session as target user with `impersonatorSid` backlink; POST `/api/platform/stop-impersonation` restores original super admin session. Amber banner shows "Viewing as [Name]" with "Stop Impersonation" button. Audit logged.
- **Announcements**: DB table with type/targetRole; endpoints GET/POST/DELETE `/api/platform/announcements`; tenant-facing GET `/api/announcements` (filters by user role, shows global + role-targeted). AnnouncementsBanner component on admin/staff/client dashboards shows up to 3 latest announcements with dismiss-per-session.
- **Subscriptions**: DB table linking locationId to plan (free/starter/professional/enterprise) with status and billing amount; GET/PATCH `/api/platform/subscriptions`
- **Input validation**: All mutation endpoints validate input types, lengths, and enum values
- **Audit logging**: Structured JSON logs for CREATE_TENANT, CREATE_ANNOUNCEMENT, IMPERSONATE_START, IMPERSONATE_STOP

### White-Label Branding
- **Location fields**: `brandName`, `logoUrl`, `primaryColor`, `tagline` on `locations` table
- **PATCH `/api/locations/:id/branding`**: Admin-only (tenant-scoped — admins can only edit their own location), Super Admin can edit any
- **BrandingContext** (`contexts/BrandingContext.tsx`): Provides `useBranding()` hook returning `{ name, logoUrl, primaryColor, tagline, locationId }`
- **Sidebar**: Shows tenant's `brandName` (or `location.name` fallback) instead of "SalonSync"; logo rendered if `logoUrl` is set
- **Admin Dashboard**: Heading shows tenant brand name
- **Settings > Branding tab**: Admin can configure brand name, logo URL, tagline, and accent color with live preview

## Pending / Future Work

- Stripe payment integration (UI built, connect Stripe account to activate)
- Email notifications via Resend
- Role-based route guards (currently uses `useAuth()` redirect on Landing)
- White-label: apply `primaryColor` to CSS custom properties for full theme customization
