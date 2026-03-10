# 💇 SalonSync

> AI-powered SaaS platform for hair salons — scheduling, payments, cancellation enforcement, staff ratings, and analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| ORM | Prisma |
| Payments | Stripe |
| AI | Claude API (Anthropic) |
| Email | Resend |
| SMS | Twilio |
| Styling | Tailwind CSS |

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/salonsync.git
cd salonsync
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local` (see comments in the file).

### 3. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → Create a new project
2. Copy your **Project URL** and **Anon Key** into `.env.local`
3. Copy the **Database connection string** into `DATABASE_URL`

### 4. Set Up Prisma & Database

```bash
npx prisma generate
npx prisma db push
```

### 5. Set Up Stripe

1. Go to [stripe.com](https://stripe.com) → Create account
2. Copy your test API keys into `.env.local`
3. Set up a webhook endpoint pointing to `/api/webhooks/stripe`

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
salonsync/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login, register pages
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/      # Role-based dashboards
│   │   │   ├── admin/
│   │   │   ├── staff/
│   │   │   └── client/
│   │   ├── api/              # API route handlers
│   │   │   ├── appointments/
│   │   │   ├── auth/
│   │   │   ├── payments/
│   │   │   ├── staff/
│   │   │   ├── ai/
│   │   │   └── webhooks/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── calendar/
│   │   ├── booking/
│   │   ├── dashboard/
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client
│   │   ├── stripe.ts         # Stripe helpers
│   │   ├── prisma.ts         # Prisma client
│   │   └── claude.ts         # AI features (chatbot, risk scoring, etc.)
│   └── types/
│       └── index.ts          # Shared TypeScript types
├── prisma/
│   └── schema.prisma         # Full database schema
├── public/
├── .env.example              # Copy to .env.local
└── package.json
```

---

## Key Features

- **Multi-location support** — each salon location has its own staff, calendar, and settings
- **Role-based access** — Admin, Staff, and Client dashboards
- **High-value appointment flow** — highlights & extensions trigger prepayment and stricter cancellation rules
- **Cancellation enforcement** — automatic fee deduction 48hrs before appointment
- **AI Receptionist** — 24/7 chatbot powered by Claude API
- **Cancellation Risk Scoring** — AI flags high-risk appointments before they no-show
- **Smart Rebooking** — AI nudges clients when they're due for a return visit
- **Employee Ratings** — client reviews with AI sentiment analysis
- **Analytics Dashboard** — revenue, retention, staff performance, and predictive forecasts
- **Gift Cards & Packages** — digital gift cards and pre-paid service bundles
- **Two-way Calendar Sync** — Google Calendar & Apple Calendar

---

## Pricing Model

- **$20/month** base fee per location
- **$10/month** per seat (owner + staff + secretary)
- Example: 5-person salon = **$70/month**

---

## Roadmap

### Phase 1 — MVP
- [ ] Auth (admin, staff, client)
- [ ] Scheduling & calendar
- [ ] Payments & deposits (Stripe)
- [ ] Cancellation policy enforcement
- [ ] Multi-location support
- [ ] Two-way calendar sync
- [ ] Gift cards & service packages

### Phase 2 — AI + Core Features
- [ ] High-value appointment flow
- [ ] Employee rating system
- [ ] AI cancellation risk scoring
- [ ] AI smart rebooking predictions
- [ ] AI receptionist chatbot
- [ ] Basic analytics dashboard

### Phase 3 — Growth
- [ ] AI dynamic pricing suggestions
- [ ] AI product recommendations
- [ ] Predictive analytics & forecasting
- [ ] Mobile app (iOS/Android)
- [ ] Loyalty/rewards program

---

## License

Private — All rights reserved.
