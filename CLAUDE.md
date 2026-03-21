# CLAUDE.md — SalonSync

## Project Overview

SalonSync is a multi-tenant SaaS platform for hair salons. Built as a **pnpm monorepo** with TypeScript throughout. Features multi-location support, three user roles (Admin/Staff/Client), AI-powered features (risk scoring, sentiment analysis, receptionist chatbot), analytics, gift cards, reviews, and notifications.

**Deployment target**: Replit (Autoscale)

## Architecture

```
├── artifacts/
│   ├── api-server/        # Express 5 backend (port 8080)
│   └── salonsync/         # React 19 + Vite frontend
├── lib/
│   ├── db/                # Drizzle ORM schema + PostgreSQL client (21 tables)
│   ├── api-spec/          # OpenAPI spec (source of truth for API contract)
│   ├── api-client-react/  # Generated React Query hooks (via Orval)
│   ├── api-zod/           # Generated Zod validation schemas (via Orval)
│   ├── replit-auth-web/   # Replit Auth browser hooks (useAuth)
│   ├── integrations/      # General integrations
│   └── integrations-anthropic-ai/  # Claude AI client wrapper
└── scripts/               # Build/utility scripts
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24, TypeScript 5.9 |
| Frontend | React 19, Vite 7, Wouter (routing), TanStack Query v5 |
| UI | Radix UI, TailwindCSS v4, Framer Motion, Recharts, Lucide icons |
| Backend | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Replit Auth (OpenID Connect) |
| AI | Anthropic Claude (Replit-proxied, no API key needed) |
| Payments | Stripe (graceful no-op when keys absent — mock mode for dev) |
| Notifications | Twilio SMS + SendGrid email (graceful no-op when keys absent) |
| Codegen | OpenAPI → Orval → React Query hooks + Zod schemas |

## Common Commands

```bash
# Development
pnpm run dev                              # Start dev server (frontend + backend)

# Database
pnpm --filter @workspace/db run push      # Push schema changes to PostgreSQL

# Codegen (after editing lib/api-spec/openapi.yaml)
pnpm --filter @workspace/api-spec run codegen  # Regenerates api-client-react + api-zod

# Type checking
pnpm run typecheck

# Build
pnpm run build
pnpm run build:libs                       # Build library packages only
```

## Design Language

- **Background**: `#0F172A` (deep slate)
- **Accent**: `#C9956A` (rose-gold)
- **Headings**: Playfair Display
- **Body**: DM Sans
- **Dark theme** throughout — do not introduce light-mode styles
- Tailwind CSS with custom CSS variables defined in `index.css`

## Database Schema (21 tables)

Schema files live in `lib/db/src/schema/`. Key tables:

- **users** — roles: ADMIN, STAFF, CLIENT. Has stripeCustomerId, specialties, locationId, smsEnabled, emailEnabled
- **locations** — multi-tenant. Each has cancellation policies, platform fees, timezone
- **services** — STANDARD or HIGH_VALUE category. Has basePrice, durationMinutes, depositPercent
- **appointments** — links client + staff + location. Tracks riskLevel, paymentStatus, cancelFeeCharged, recurringRule, parentAppointmentId
- **appointment_services** — M2M junction between appointments and services
- **payments** — Stripe payment records (amount, type, stripeId, status)
- **tips** — post-appointment tips (appointmentId, clientId, staffId, amount, stripePaymentId)
- **reviews** — with AI sentimentScore + sentimentTags
- **availability** — staff weekly schedules + block dates
- **gift_cards** — code, balance, status (ACTIVE/REDEEMED/EXPIRED)
- **notifications** / **reminders** — in-app notifications and scheduled reminders
- **conversations** / **messages** — AI chatbot conversation history
- **direct_message_threads** / **direct_messages** — staff-client direct messaging with read receipts
- **waitlist** — client waitlist entries (serviceId, staffId, locationId, preferredDayOfWeek, preferredTimeRange, status)
- **analytics** — daily aggregated metrics by location
- **products** / **product_recommendations** — retail products + AI recommendations
- **service_packages** — bundled service packages

**Enums**: appointmentStatus, paymentStatus, riskLevel, serviceCategory, userRole, giftCardStatus

## API Routes (all under `/api`)

Route files: `artifacts/api-server/src/routes/`

| Route file | Endpoints | Notes |
|-----------|-----------|-------|
| `auth.ts` | login, callback, logout, user | Replit OIDC flow |
| `users.ts` | GET/PUT users | Filter by role, locationId |
| `locations.ts` | CRUD locations | Soft delete |
| `services.ts` | CRUD services | Filter by category, locationId |
| `appointments.ts` | CRUD + cancel | Complex filtering, fee enforcement on cancel |
| `availability.ts` | CRUD availability | By userId, dayOfWeek, block dates |
| `reviews.ts` | GET/POST reviews | Requires completed appointment |
| `analytics.ts` | GET analytics | Aggregated metrics by location + date range |
| `gift-cards.ts` | GET/POST gift cards | Auto-generates GC-TIMESTAMP-RANDOM codes |
| `notifications.ts` | GET + mark read | Per-user notification feed |
| `ai.ts` | risk-score, sentiment, chat | Claude-powered analysis |
| `anthropic.ts` | conversations + messages | SSE streaming chat with Claude |
| `payments.ts` | create-intent, confirm, webhook, refund, history | Stripe integration with mock fallback |
| `messages.ts` | threads CRUD, send, read, unread-count, SSE | Real-time staff-client DMs |
| `tips.ts` | POST tip, GET staff tips, GET appointment tip | Post-appointment tipping |
| `waitlist.ts` | CRUD waitlist, PATCH status | Client waitlist with preferences |
| `health.ts` | GET /healthz | Health check |
| `dev.ts` | Dev/seed endpoints | Development only |

**Backend services**: `artifacts/api-server/src/services/`
- `notifications.ts` — SMS (Twilio), email (SendGrid), in-app notifications. Gracefully no-ops when keys absent.
- `scheduler.ts` — 5-minute interval cron that sends due appointment reminders (24h and 1h before).

Routes are registered in `artifacts/api-server/src/routes/index.ts`.

## Frontend Pages

Pages live in `artifacts/salonsync/src/pages/`. Router: Wouter.

**Admin** (`/admin/*`): Dashboard, Analytics, Appointments, Calendar, Staff, Services, Waitlist, Settings
**Staff** (`/staff/*`): Dashboard, Clients, Earnings, Messages
**Client** (`/client/*`): Dashboard, BookingFlow (5-step wizard with payment), Reviews, Profile, Messages, Waitlist
**Public**: Landing page (`/`), Setup Admin (`/setup-admin`)

## Key Patterns — Follow These

### Adding a new API endpoint
1. Add route handler in `artifacts/api-server/src/routes/<resource>.ts`
2. Register in `artifacts/api-server/src/routes/index.ts`
3. Use `req.session.userId` for auth checks (session stored in PostgreSQL)
4. Use Drizzle ORM for all DB queries (`import { db } from "@workspace/db"`)
5. Use Zod schemas from `@workspace/api-zod` for request validation
6. Update `lib/api-spec/openapi.yaml` then run codegen to generate client hooks

### Adding a new database table
1. Create schema file in `lib/db/src/schema/<table>.ts`
2. Export from `lib/db/src/schema/index.ts`
3. Run `pnpm --filter @workspace/db run push` to apply

### Adding a frontend page
1. Create component in `artifacts/salonsync/src/pages/<role>/`
2. Add route in `artifacts/salonsync/src/App.tsx` (Wouter `<Route>`)
3. Add nav item in sidebar (`artifacts/salonsync/src/components/layout/Sidebar.tsx`)
4. Use generated hooks from `@workspace/api-client-react` for data fetching
5. Use Radix UI components from `src/components/ui/`
6. Use TanStack Query for server state

### AI integration
- Claude calls go through `@workspace/integrations-anthropic-ai` (Replit-proxied)
- Streaming uses SSE: `text/event-stream` with `{"type":"text","text":"..."}` chunks
- Frontend streaming hook: `src/hooks/use-chat-stream.ts`

## Implementation Status

### Complete
- Multi-role auth (Admin/Staff/Client) with Replit OIDC
- Appointment CRUD with cancellation fee enforcement + recurring appointments
- 5-step client booking wizard (service → stylist → date/time → confirm → payment)
- Stripe payment processing (create-intent, confirm, webhook, refund) — mock mode when no keys
- Post-appointment tipping with preset percentages and custom amounts
- Staff-client direct messaging with SSE real-time delivery and read receipts
- AI risk scoring + sentiment analysis
- AI receptionist chatbot with SSE streaming
- Staff availability management
- Gift card system (create, redeem, track balance)
- Review system with AI sentiment
- In-app notification feed + SMS/email notifications (Twilio/SendGrid, graceful no-op)
- Reminder scheduler (24h and 1h before appointment, runs every 5 minutes)
- Admin dashboard with KPIs
- Admin analytics with real data, date range picker, location selector, CSV export, staff performance table
- Waitlist system (join, manage, admin status updates)
- Staff dashboard, clients list, earnings (with tips)
- Client profile with notification preferences (smsEnabled, emailEnabled)
- Client waitlist management page

### Needs Work
- **Booking time slot selection** — BookingFlow date/time step is still mocked ("Tomorrow at 10:00 AM")
- **Role-based route guards** — currently relies on `useAuth()` redirect on Landing page only
- **Admin Settings persistence** — form saves show toast but don't persist to backend
- **Staff Dashboard KPIs** — hours booked, rating, repeat clients are hardcoded values
- **Stripe/Twilio not live** — payment and notification integrations work in mock/no-op mode until API keys are configured

## Seeded Demo Data

Location: "SalonSync Downtown" (Beverly Hills, CA)
Services: Classic Cut ($85), Color Treatment ($225), Balayage ($350), Deep Conditioning ($65), Blowout ($55), Keratin Smoothing ($400)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Frontend dev server port |
| `BASE_PATH` | No | Frontend base path |
| `ANTHROPIC_API_KEY` | No | Replit-proxied, not needed on Replit |
| `STRIPE_SECRET_KEY` | No | Stripe backend key (mock mode if absent) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `VITE_STRIPE_PUBLISHABLE_KEY` | No | Stripe frontend key (simulated card UI if absent) |
| `TWILIO_ACCOUNT_SID` | No | Twilio account SID (SMS no-op if absent) |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No | Twilio sender phone number |
| `SENDGRID_API_KEY` | No | SendGrid API key (email no-op if absent) |
| `SENDGRID_FROM_EMAIL` | No | Sender email (defaults to noreply@salonsync.app) |

## Guidelines

- **Do not** introduce light-mode or white backgrounds — the app is dark-themed throughout
- **Do not** add dependencies without necessity — check if Radix UI or existing packages cover the need
- **Do not** bypass the codegen pipeline — always update `openapi.yaml` and run codegen for new API endpoints
- **Do** use Drizzle ORM query builder, not raw SQL
- **Do** use existing UI components from `src/components/ui/` before creating new ones
- **Do** follow the Express 5 pattern with async route handlers
- **Do** keep the monorepo workspace structure — install deps in the correct workspace package
- **Do** use `pnpm --filter <package>` for workspace-specific commands
