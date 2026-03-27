import twilio from "twilio";
import { Resend } from "resend";
import { db } from "@workspace/db";
import { notificationsTable, notificationPreferencesTable, usersTable, locationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  appointmentConfirmationEmail,
  appointmentReminderEmail,
  cancellationEmail,
  reviewRequestEmail,
  staffCancellationEmail,
} from "./email-templates";

const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
const hasResend = !!process.env.RESEND_API_KEY;

let twilioClient: ReturnType<typeof twilio> | null = null;
if (hasTwilio) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

let resendClient: Resend | null = null;
if (hasResend) {
  resendClient = new Resend(process.env.RESEND_API_KEY!);
}

interface BrandingConfig {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  tagline: string | null;
}

export async function sendSMS(to: string, message: string): Promise<{ sent: boolean; status: string }> {
  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    console.log(`[SMS no-op] To: ${to} | ${message.substring(0, 80)}`);
    return { sent: false, status: "no_provider" };
  }
  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`[SMS sent] To: ${to} | SID: ${result.sid}`);
    return { sent: true, status: "delivered" };
  } catch (err: any) {
    console.error(`[SMS error] ${err?.message}`);
    return { sent: false, status: "failed" };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  fromName?: string
): Promise<{ sent: boolean; status: string }> {
  if (!resendClient) {
    console.log(`[Email no-op] To: ${to} | Subject: ${subject}`);
    return { sent: false, status: "no_provider" };
  }
  try {
    const { data, error } = await resendClient.emails.send({
      from: `${fromName || "SalonSync"} <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`,
      to: [to],
      subject,
      html: htmlBody,
    });
    if (error) {
      console.error(`[Email error] ${JSON.stringify(error)}`);
      return { sent: false, status: "failed" };
    }
    console.log(`[Email sent] To: ${to} | ID: ${data?.id}`);
    return { sent: true, status: "delivered" };
  } catch (err: any) {
    console.error(`[Email error] ${err?.message}`);
    return { sent: false, status: "failed" };
  }
}

interface ApptDetails {
  id: string;
  startTime: string | Date;
  endTime?: string | Date;
  locationId: string;
  staffId: string;
  clientId: string;
  status: string;
  totalPrice: number;
  services?: Array<{ name?: string }>;
  staff?: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null };
  client?: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null };
  location?: { name?: string | null };
}

function formatTime(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

function serviceList(appt: ApptDetails): string {
  return appt.services?.map(s => s.name).filter(Boolean).join(", ") || "Salon Service";
}

function staffFullName(appt: ApptDetails): string {
  return [appt.staff?.firstName, appt.staff?.lastName].filter(Boolean).join(" ") || "Your stylist";
}

function clientFullName(appt: ApptDetails): string {
  return [appt.client?.firstName, appt.client?.lastName].filter(Boolean).join(" ") || "Client";
}

async function getBranding(locationId: string): Promise<BrandingConfig> {
  try {
    const [loc] = await db.select({
      name: locationsTable.name,
      brandName: locationsTable.brandName,
      logoUrl: locationsTable.logoUrl,
      primaryColor: locationsTable.primaryColor,
      tagline: locationsTable.tagline,
    }).from(locationsTable).where(eq(locationsTable.id, locationId));
    if (!loc) return { brandName: "SalonSync", logoUrl: null, primaryColor: "#C9956A", tagline: null };
    return {
      brandName: loc.brandName || loc.name || "SalonSync",
      logoUrl: loc.logoUrl || null,
      primaryColor: loc.primaryColor || "#C9956A",
      tagline: loc.tagline || null,
    };
  } catch {
    return { brandName: "SalonSync", logoUrl: null, primaryColor: "#C9956A", tagline: null };
  }
}

async function storeNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  channel: string = "in_app",
  deliveryStatus: string = "sent"
) {
  await db.insert(notificationsTable).values({
    type, title, message, userId, channel, deliveryStatus,
    sentAt: new Date(),
  }).catch(() => {});
}

async function getUserPrefs(userId: string) {
  const [prefs] = await db.select().from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));

  const [user] = await db.select({
    email: usersTable.email,
    phone: usersTable.phone,
    smsEnabled: usersTable.smsEnabled,
    emailEnabled: usersTable.emailEnabled,
  }).from(usersTable).where(eq(usersTable.id, userId));

  return {
    email: user?.email ?? null,
    phone: user?.phone ?? null,
    smsEnabled: prefs?.smsEnabled ?? user?.smsEnabled ?? true,
    emailEnabled: prefs?.emailEnabled ?? user?.emailEnabled ?? true,
    reminderHoursBefore: prefs?.reminderHoursBefore ?? 24,
    secondReminderHours: prefs?.secondReminderHours ?? 2,
    marketingOptIn: prefs?.marketingOptIn ?? false,
    reviewRequestEnabled: prefs?.reviewRequestEnabled ?? true,
  };
}

export async function sendAppointmentConfirmation(appt: ApptDetails) {
  const start = new Date(appt.startTime);
  const services = serviceList(appt);
  const staff = staffFullName(appt);
  const clientN = clientFullName(appt);
  const location = appt.location?.name ?? "our salon";
  const branding = await getBranding(appt.locationId);
  const clientPrefs = await getUserPrefs(appt.clientId);

  await storeNotification(
    appt.clientId,
    "APPOINTMENT_CONFIRMED",
    "Booking Confirmed!",
    `Your appointment on ${formatTime(start)} with ${staff} is confirmed.`
  );

  if (clientPrefs.phone && clientPrefs.smsEnabled) {
    const smsBody = `Hi ${clientN}! Your appointment at ${branding.brandName} is confirmed for ${formatTime(start)} with ${staff} (${services}). See you then!`;
    const result = await sendSMS(clientPrefs.phone, smsBody);
    await storeNotification(appt.clientId, "APPOINTMENT_CONFIRMED", "Booking Confirmed (SMS)", smsBody, "sms", result.status);
  }

  if (clientPrefs.email && clientPrefs.emailEnabled) {
    const html = appointmentConfirmationEmail(
      branding, clientN, services, staff, location,
      formatTime(start), `$${appt.totalPrice.toFixed(2)}`
    );
    const result = await sendEmail(clientPrefs.email, `Booking Confirmed — ${branding.brandName}`, html, branding.brandName);
    await storeNotification(appt.clientId, "APPOINTMENT_CONFIRMED", "Booking Confirmed (Email)", `Confirmation sent to ${clientPrefs.email}`, "email", result.status);
  }
}

export async function sendAppointmentReminder(appt: ApptDetails, hoursAhead: number) {
  const start = new Date(appt.startTime);
  const services = serviceList(appt);
  const staff = staffFullName(appt);
  const clientN = clientFullName(appt);
  const location = appt.location?.name ?? "our salon";
  const branding = await getBranding(appt.locationId);
  const clientPrefs = await getUserPrefs(appt.clientId);

  const timeLabel = hoursAhead >= 24 ? "tomorrow" : hoursAhead === 1 ? "in 1 hour" : `in ${hoursAhead} hours`;

  const notifTitle = hoursAhead >= 24 ? "Appointment Tomorrow" : `Appointment in ${hoursAhead}h`;
  await storeNotification(
    appt.clientId,
    "APPOINTMENT_REMINDER",
    notifTitle,
    `Your ${services} appointment with ${staff} is ${timeLabel}.`
  );

  if (clientPrefs.phone && clientPrefs.smsEnabled) {
    const smsBody = `Hi ${clientN}! Reminder: your appointment ${timeLabel} at ${branding.brandName} with ${staff} (${services}).`;
    const result = await sendSMS(clientPrefs.phone, smsBody);
    await storeNotification(appt.clientId, "APPOINTMENT_REMINDER", `Reminder (SMS)`, smsBody, "sms", result.status);
  }

  if (clientPrefs.email && clientPrefs.emailEnabled) {
    const html = appointmentReminderEmail(branding, clientN, services, staff, location, formatTime(start), timeLabel);
    const result = await sendEmail(clientPrefs.email, `Reminder: Appointment ${timeLabel} — ${branding.brandName}`, html, branding.brandName);
    await storeNotification(appt.clientId, "APPOINTMENT_REMINDER", `Reminder (Email)`, `Reminder sent to ${clientPrefs.email}`, "email", result.status);
  }
}

export async function sendCancellationNotice(appt: ApptDetails, feeAmount?: number) {
  const start = new Date(appt.startTime);
  const staff = staffFullName(appt);
  const clientN = clientFullName(appt);
  const location = appt.location?.name ?? "our salon";
  const branding = await getBranding(appt.locationId);
  const feeNote = feeAmount && feeAmount > 0 ? `A cancellation fee of $${feeAmount.toFixed(2)} has been applied.` : "";

  const clientPrefs = await getUserPrefs(appt.clientId);
  const staffPrefs = await getUserPrefs(appt.staffId);

  await storeNotification(appt.clientId, "APPOINTMENT_CANCELLED", "Appointment Cancelled", `Your appointment on ${formatTime(start)} was cancelled.${feeNote ? ` ${feeNote}` : ""}`);

  if (clientPrefs.phone && clientPrefs.smsEnabled) {
    const smsBody = `Hi ${clientN}, your appointment at ${branding.brandName} on ${formatTime(start)} has been cancelled.${feeNote ? ` ${feeNote}` : ""}`;
    const result = await sendSMS(clientPrefs.phone, smsBody);
    await storeNotification(appt.clientId, "APPOINTMENT_CANCELLED", "Cancelled (SMS)", smsBody, "sms", result.status);
  }

  if (clientPrefs.email && clientPrefs.emailEnabled) {
    const html = cancellationEmail(branding, clientN, serviceList(appt), staff, location, formatTime(start), feeNote);
    const result = await sendEmail(clientPrefs.email, `Appointment Cancelled — ${branding.brandName}`, html, branding.brandName);
    await storeNotification(appt.clientId, "APPOINTMENT_CANCELLED", "Cancelled (Email)", `Cancellation sent to ${clientPrefs.email}`, "email", result.status);
  }

  await storeNotification(appt.staffId, "APPOINTMENT_CANCELLED", "Appointment Cancelled", `${clientN}'s appointment on ${formatTime(start)} was cancelled.`);

  if (staffPrefs.phone && staffPrefs.smsEnabled) {
    const smsBody = `${branding.brandName}: ${clientN}'s appointment on ${formatTime(start)} has been cancelled.`;
    await sendSMS(staffPrefs.phone, smsBody);
  }

  if (staffPrefs.email && staffPrefs.emailEnabled) {
    const sName = [appt.staff?.firstName, appt.staff?.lastName].filter(Boolean).join(" ") || "Team member";
    const html = staffCancellationEmail(branding, sName, clientN, serviceList(appt), formatTime(start), location);
    await sendEmail(staffPrefs.email, `Appointment Cancelled — ${branding.brandName}`, html, branding.brandName);
  }
}

export async function sendReviewRequest(appt: ApptDetails) {
  const start = new Date(appt.startTime);
  const services = serviceList(appt);
  const staff = staffFullName(appt);
  const clientN = clientFullName(appt);
  const location = appt.location?.name ?? "our salon";
  const branding = await getBranding(appt.locationId);
  const clientPrefs = await getUserPrefs(appt.clientId);

  if (!clientPrefs.reviewRequestEnabled) return;

  await storeNotification(
    appt.clientId,
    "REVIEW_REQUEST",
    "How was your visit?",
    `We'd love to hear about your ${services} appointment with ${staff}. [ref:${appt.id}]`
  );

  if (clientPrefs.phone && clientPrefs.smsEnabled) {
    const smsBody = `Hi ${clientN}! How was your visit to ${branding.brandName}? We'd love your feedback on your ${services} appointment with ${staff}. Leave a review in the app!`;
    const result = await sendSMS(clientPrefs.phone, smsBody);
    await storeNotification(appt.clientId, "REVIEW_REQUEST", "Review Request (SMS)", smsBody, "sms", result.status);
  }

  if (clientPrefs.email && clientPrefs.emailEnabled) {
    const html = reviewRequestEmail(branding, clientN, services, staff, location, formatTime(start));
    const result = await sendEmail(clientPrefs.email, `How was your visit? — ${branding.brandName}`, html, branding.brandName);
    await storeNotification(appt.clientId, "REVIEW_REQUEST", "Review Request (Email)", `Review request sent to ${clientPrefs.email}`, "email", result.status);
  }
}

export async function sendNewMessageNotification(recipientId: string, senderName: string) {
  const prefs = await getUserPrefs(recipientId);
  const title = "New Message";
  const msg = `You have a new message from ${senderName}.`;
  await storeNotification(recipientId, "NEW_MESSAGE", title, msg);

  if (prefs.phone && prefs.smsEnabled) {
    await sendSMS(prefs.phone, msg);
  }
}

export { scheduleReminders } from "./reminder-scheduling";
