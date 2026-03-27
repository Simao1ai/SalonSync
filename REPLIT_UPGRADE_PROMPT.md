# SalonSync — Replit AI Prompt: Beat the Competition

Copy and paste the prompt below into Replit AI to systematically upgrade SalonSync beyond what Fresha, Vagaro, Booksy, Square Appointments, Boulevard, Mangomint, GlossGenius, Mindbody, Acuity, and Zenoti offer.

---

## THE PROMPT (copy everything below this line)

---

I need you to upgrade SalonSync to surpass every major salon software competitor on the market (Fresha, Vagaro, Booksy, Square, Boulevard, Mangomint, GlossGenius, Mindbody, Acuity, Zenoti). SalonSync is a production-grade multi-tenant SaaS platform for salons built as a pnpm monorepo with TypeScript, React + Vite frontend, Express 5 backend, PostgreSQL + Drizzle ORM, Anthropic Claude AI, and Stripe. Follow our existing architecture patterns, design language (dark slate #0F172A, rose-gold #C9956A, Playfair Display headings, DM Sans body), and OpenAPI-first codegen workflow.

Implement the following upgrades in priority order. After each major feature, update the OpenAPI spec, run codegen (`pnpm --filter @workspace/api-spec run codegen`), push the DB schema (`pnpm --filter @workspace/db run push`), and verify the app builds.

---

### PHASE 1: CRITICAL GAPS (Must-have to compete)

**1.1 — SMS & Email Notifications (Beats: all competitors have this, we only have in-app)**
- Integrate Twilio (already in package.json) for SMS appointment reminders and confirmations
- Integrate Resend for email notifications (appointment confirmation, cancellation, reminders, marketing)
- Add a `notification_preferences` table: userId, emailEnabled, smsEnabled, reminderHoursBefore (default 24), marketingOptIn
- Add notification preference settings to the client profile page and admin settings page
- Create a background job system using node-cron that:
  - Sends appointment reminders at the configured hours before (default 24h and 2h)
  - Sends confirmation emails/SMS on booking
  - Sends cancellation notifications to both client and staff
  - Sends review request emails 24h after completed appointments
- Add SMS/email delivery status tracking (sent, delivered, failed) in the notifications table
- Build beautiful HTML email templates with the salon's white-label branding (brandName, logoUrl, primaryColor)

**1.2 — Google Calendar Sync (Beats: Vagaro, Square, Boulevard, Mangomint, Acuity all have this)**
- Add Google OAuth2 integration for staff members
- Add `google_calendar_token` fields to users table (accessToken, refreshToken, calendarId)
- Two-way sync: when appointments are created/updated/cancelled in SalonSync, create/update/delete Google Calendar events
- When staff block time in Google Calendar, reflect it in SalonSync availability
- Add "Connect Google Calendar" button in staff settings
- Use Google Calendar API v3

**1.3 — Intake Forms Builder (Beats: Vagaro, Square, Boulevard, Mangomint, Mindbody, Zenoti)**
- Add `intake_forms` table: id, locationId, name, fields (JSONB — array of field definitions with type: text/textarea/select/checkbox/date/signature/file), isRequired, isActive
- Add `intake_form_responses` table: id, formId, clientId, appointmentId, responses (JSONB), submittedAt
- Build a drag-and-drop form builder UI for admins (reuse @dnd-kit already installed)
- Auto-send intake forms to new clients before their first appointment
- Display completed form responses in the appointment detail view
- Support digital signature capture for liability waivers
- Add HIPAA-compliant data handling flag for medspa-ready intake forms

**1.4 — Report Export (Beats: most competitors offer CSV/PDF export)**
- Add CSV export to all analytics pages (overview, stylist productivity, revenue per chair, retail sales, multi-location)
- Add PDF report generation using @react-pdf/renderer for formatted reports with charts
- Include salon branding (logo, name, colors) in exported PDFs
- Add "Export" dropdown button (CSV / PDF) to each analytics tab

---

### PHASE 2: AI SUPERPOWERS (Beats Zenoti's AI — the current market leader)

**2.1 — AI Scheduling Optimizer (Beats: Boulevard's "Precision Scheduling", Zenoti's AI scheduling)**
- Build an AI endpoint `POST /api/ai/optimize-schedule` that uses Claude to:
  - Analyze the week's appointments and identify gaps in the schedule
  - Suggest optimal slot placements for waitlisted clients to maximize chair utilization
  - Recommend schedule adjustments to minimize dead time between appointments
  - Factor in service duration, staff specialties, and travel time between services
- Show optimization suggestions in the admin schedule view with "Apply" buttons
- Display a "Schedule Efficiency Score" (% of available time booked) on the admin dashboard

**2.2 — AI Marketing Campaign Generator (Beats: Fresha, Vagaro, Zenoti's AI marketing)**
- Build `POST /api/ai/generate-campaign` that uses Claude to create:
  - Email subject lines and body copy personalized to client segments
  - SMS marketing messages (under 160 chars)
  - Social media post captions
  - Seasonal promotion ideas based on the salon's services and pricing
- Add a Marketing page (`/admin/marketing`) with:
  - Campaign builder: select audience segment, campaign type (email/SMS/social), and goal
  - AI generates the content, admin reviews and edits
  - Send campaigns via Resend (email) and Twilio (SMS)
  - Campaign performance tracking (sent, opened, clicked, booked)
- Add `campaigns` and `campaign_analytics` tables

**2.3 — AI Business Insights / Natural Language Analytics (Beats: GlossGenius "AI Growth Analyst", Zenoti "Zeenie")**
- Build `POST /api/ai/insights` that accepts natural language queries about the business
- Examples: "What was my revenue last month?", "Who are my top 5 clients by spend?", "Which stylist has the most cancellations?", "What's my busiest day of the week?"
- Claude generates SQL queries against the SalonSync database, executes them safely (read-only), and returns human-readable answers with data
- Add an "AI Insights" chat panel accessible from the admin dashboard (floating button, slides out from right)
- Include suggested questions to get started
- Store query history per admin for quick re-runs

**2.4 — AI Client Churn Prediction (Beats: Mindbody's "Clients At Risk", Zenoti's churn prediction)**
- Build `POST /api/ai/churn-prediction` that analyzes client behavior:
  - Days since last visit vs. their average visit frequency
  - Declining visit frequency trend
  - Recent negative review or low rating
  - Cancelled appointments without rebooking
  - Decreased spending per visit
- Returns a churn risk score (LOW/MEDIUM/HIGH) with recommended re-engagement actions
- Add a "Clients at Risk" section to the admin dashboard showing HIGH risk clients
- Auto-trigger re-engagement campaigns (email/SMS) for at-risk clients with admin approval

**2.5 — AI Smart Pricing Suggestions (Beats: Boulevard, Zenoti's dynamic pricing)**
- Build `POST /api/ai/pricing-suggestions` that analyzes:
  - Current service prices vs. local market rates
  - Demand patterns (which services are always booked vs. underbooked)
  - Peak vs. off-peak utilization
  - Client price sensitivity (booking patterns after price changes)
- Suggest price adjustments, happy-hour discounts for slow periods, and premium pricing for peak demand
- Show suggestions in admin settings with "Apply" buttons

---

### PHASE 3: MARKETPLACE & GROWTH (Compete with Fresha/Booksy/Mindbody marketplaces)

**3.1 — Enhanced Public Marketplace (Beats: basic Explore page → rival Fresha/Booksy marketplace)**
- Upgrade `/explore` to a full marketplace experience:
  - Add location-based search with distance sorting (use browser geolocation API)
  - Add service-specific search ("balayage near me")
  - Add staff profile cards with photos, specialties, ratings, and portfolio
  - Add "Book Now" buttons that link directly into the booking flow
  - Add salon photos/gallery carousel per location
  - Add verified review display with sentiment badges
  - Add filter by: rating, price range, service category, distance, availability (today/this week)
- Add SEO-friendly meta tags and structured data (JSON-LD) for Google rich results
- Add `gallery` table: id, locationId, imageUrl, caption, staffId (optional), serviceId (optional)

**3.2 — Google Reserve / Google Business Integration**
- Add Reserve with Google integration so clients can book directly from Google Search and Maps
- Implement the Google Reserve API (Actions Center) for real-time availability feeds
- Auto-sync salon info, services, and pricing to Google Business Profile

**3.3 — Social Media Booking Links**
- Add "Book Now" link generator for Instagram bio, Facebook page, and TikTok
- Generate unique tracking URLs per platform to measure social booking conversions
- Add social booking analytics to the marketing dashboard

---

### PHASE 4: ADVANCED OPERATIONS (Match Boulevard + Mangomint + Zenoti)

**4.1 — Resource/Room Scheduling**
- Add `resources` table: id, locationId, name, type (ROOM/CHAIR/EQUIPMENT), isActive
- Add `service_resources` table: serviceId, resourceId (which resources a service needs)
- Update appointment booking to check resource availability alongside staff availability
- Show resource utilization in analytics

**4.2 — Client Treatment Records & Color Formulas**
- Add `treatment_records` table: id, clientId, staffId, appointmentId, notes, colorFormula, products (JSONB), beforePhotoUrl, afterPhotoUrl, createdAt
- Build a treatment history view in the client profile (visible to staff)
- Add before/after photo upload with image compression
- Staff can record color formulas and product usage per appointment

**4.3 — Loyalty & Rewards Program**
- Add `loyalty_programs` table: id, locationId, pointsPerDollar, rewardThreshold, rewardType, rewardValue, isActive
- Add `loyalty_points` table: id, clientId, locationId, points, earnedFrom (appointment/referral/review), createdAt
- Clients earn points on every visit/purchase, redeemable for discounts or free services
- Show points balance on client dashboard and during booking checkout
- Admin can configure points-per-dollar and reward tiers

**4.4 — Referral System**
- Add `referrals` table: id, referrerId, referredClientId, locationId, status, rewardGiven, createdAt
- Generate unique referral links/codes per client
- Both referrer and new client get rewards (configurable by admin)
- Track referral conversions in marketing analytics

**4.5 — Automated Re-engagement Flows**
- Add `automation_flows` table: id, locationId, triggerType (NO_VISIT_30_DAYS / BIRTHDAY / POST_APPOINTMENT / ABANDONED_BOOKING), action (EMAIL/SMS), templateId, delayHours, isActive
- Pre-built flow templates:
  - "We miss you" — 30/60/90 days since last visit
  - Birthday discount — auto-send on client birthday
  - Post-appointment follow-up — aftercare tips + rebooking prompt
  - Review request — 24h after completed appointment
- Admin can customize timing, message content, and enable/disable each flow
- Track flow performance (sent, opened, converted)

---

### PHASE 5: POLISH & DIFFERENTIATION

**5.1 — PWA (Progressive Web App) Support**
- Add service worker for offline capability and push notifications
- Add web app manifest for "Add to Home Screen" on mobile
- Add push notification support for appointment reminders
- This gives us a native-app-like experience without building separate iOS/Android apps (most competitors require app downloads)

**5.2 — Multi-Language Support (i18n)**
- Add react-i18next for frontend internationalization
- Support English and Spanish initially (largest US salon market segments)
- Store user language preference
- Translate all UI strings, email templates, and SMS messages

**5.3 — Zapier/Webhook Integration**
- Add `webhooks` table: id, locationId, url, events (JSONB array), secret, isActive
- Fire webhooks on key events: appointment.created, appointment.cancelled, client.created, payment.completed, review.created
- Build a webhook management UI in admin settings
- This enables integration with 5000+ apps through Zapier without building individual connectors

**5.4 — Stripe Full Activation & POS**
- Activate Stripe Connect for real payment processing
- Add Stripe Terminal integration for in-person card payments (POS)
- Add Apple Pay / Google Pay support for online bookings
- Add automatic invoice generation on payment completion
- Add tipping prompt at checkout with preset percentages (15%, 20%, 25%, custom)

---

### IMPLEMENTATION GUIDELINES

- Follow existing patterns: Drizzle schema in `lib/db/schema.ts`, Express routes in `artifacts/api-server/routes/`, React pages in `artifacts/salonsync/pages/`
- Update `openapi.yaml` for every new endpoint, then run codegen
- Use the existing design system: shadcn/ui components, Tailwind classes, dark theme, rose-gold accents
- All new features must be tenant-scoped (filter by locationId) and respect the 4-tier role system
- AI features should use the existing Anthropic integration (`@workspace/integrations-anthropic-ai`)
- Keep the existing SSE streaming pattern for any new real-time features
- Add Zod validation on all new API inputs
- Log important operations with structured JSON (follow existing audit logging pattern)

Start with Phase 1 and work through each item sequentially. After completing each numbered item, confirm it builds successfully before moving to the next.
