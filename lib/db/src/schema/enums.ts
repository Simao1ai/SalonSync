import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "ADMIN", "STAFF", "CLIENT"]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);
export const riskLevelEnum = pgEnum("risk_level", ["LOW", "MEDIUM", "HIGH"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "UNPAID",
  "DEPOSIT_PAID",
  "FULLY_PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);
export const serviceCategoryEnum = pgEnum("service_category", [
  "STANDARD",
  "HIGH_VALUE",
]);
export const giftCardStatusEnum = pgEnum("gift_card_status", [
  "ACTIVE",
  "REDEEMED",
  "EXPIRED",
]);
