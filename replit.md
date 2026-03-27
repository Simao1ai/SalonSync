# SalonSync

## Overview

SalonSync is a multi-tenant SaaS platform for hair salons, designed as a pnpm monorepo using TypeScript. It provides multi-location support, four distinct user roles, and a suite of AI-powered features including appointment risk scoring, sentiment analysis, and an AI receptionist chatbot. The platform also includes analytics, Stripe-ready payment functionality, gift cards, reviews, notifications, and a comprehensive super-admin interface. The vision is to offer a production-grade solution that streamlines salon operations and enhances client engagement through advanced technology.

## User Preferences

No specific user preferences were provided in the original document.

## System Architecture

SalonSync is built as a pnpm monorepo, utilizing Node.js 24 and TypeScript 5.9. The frontend is developed with React and Vite, while the backend uses Express 5. PostgreSQL is the chosen database, managed with Drizzle ORM. Authentication is handled via Replit Auth (OpenID Connect). AI capabilities are integrated using Anthropic Claude. The API contract is defined with OpenAPI and generated using Orval, producing React Query hooks and Zod schemas for validation. Stripe is integrated for payment processing.

The monorepo is structured into `artifacts` for frontend and backend applications, and `lib` for shared packages such as API specifications, database schema, authentication hooks, and AI integrations. The application features a comprehensive database schema with 25 tables covering various aspects like user roles, locations, services, appointments (including risk scores), payments, reviews (with AI sentiment), staff availability, gift cards, notifications, and platform-wide announcements.

Key architectural decisions include:
- **UI/UX:** A consistent design language with a deep slate background, rose-gold accent, Playfair Display for headings, and DM Sans for body text, implemented with Tailwind CSS.
- **AI Integration:** AI features like appointment risk scoring and review sentiment analysis leverage Anthropic Claude, processing data asynchronously to provide insights. The AI chatbot uses Server-Sent Events (SSE) for real-time interaction.
- **Cancellation Fee Enforcement:** A rule-based system charges cancellation fees based on service type and cancellation window.
- **Role-Based Access Control:** Four distinct roles (Super Admin, Admin, Staff, Client) dictate access and functionalities across the platform.
- **Scalability:** The multi-tenant architecture supports multiple salon locations, each with its branding and specific configurations.
- **Extensibility:** The platform allows for white-label branding, customizable intake forms, and integrations with external services like Google Calendar.
- **Advanced Reporting:** Analytics are provided through a dedicated dashboard with various metrics, including stylist productivity, revenue per chair, retail sales, and multi-location comparisons, with export capabilities (CSV/PDF).
- **Platform Super Admin:** A dedicated interface for super administrators to manage tenants, users, announcements, and subscriptions across the entire platform, including user impersonation for support.
- **AI Superpowers (Phase 2):** AI Schedule Optimizer, AI Marketing Campaign Generator, AI Business Insights (NL→SQL), AI Churn Prediction, AI Smart Pricing — all implemented with security hardening.
- **Marketplace & Growth (Phase 3):** Enhanced public marketplace with geolocation search, salon detail pages, gallery carousels, staff profiles, verified reviews with sentiment badges, JSON-LD structured data. Social media booking link generator with click/booking tracking. Google Reserve availability/service feeds.
- **Polish & Differentiation (Phase 5):** PWA support (manifest, service worker, push notifications, Add to Home Screen). Multi-language i18n (English/Spanish via react-i18next, language selector in sidebar). Webhook/Zapier integration (CRUD API, HMAC-signed payloads, event firing on appointments/reviews/payments, SSRF-safe URL validation). E-commerce product store (admin product CRUD with categories/SKU/inventory, client storefront with cart/checkout/order history, stock tracking). 31 DB tables total.

## External Dependencies

- **PostgreSQL:** Primary database for all application data.
- **Drizzle ORM:** Used for database schema definition and interaction.
- **Replit Auth (OpenID Connect):** For user authentication and authorization.
- **Anthropic Claude:** Powers AI features like appointment risk scoring, sentiment analysis, and the AI receptionist chatbot.
- **Stripe:** Integrated for payment processing and gift card management.
- **Orval:** Codegen tool for generating API client hooks and Zod schemas from OpenAPI specifications.
- **React Query:** Used for data fetching and state management in the frontend.
- **Zod:** For runtime schema validation.
- **Recharts:** For rendering charts and analytics in the frontend.
- **@dnd-kit:** Used for drag-and-drop functionalities in the Staff Schedule Calendar and Intake Forms Builder.
- **Google Calendar API:** For integrating staff schedules and availability.
- **@react-pdf/renderer:** For generating PDF reports.