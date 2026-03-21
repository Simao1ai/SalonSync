import twilio from "twilio";
import { db } from "@workspace/db";
import { notificationsTable, remindersTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// ── Twilio / SendGrid clients (gracefully no-op when keys absent) ─────────
const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
const hasSendGrid = !!(process.env.SENDGRID_API_KEY);

let twilioClient: ReturnType<typeof twilio> | null = null;
if (hasTwilio) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

// ── Primitives ────────────────────────────────────────────────────────────

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    console.log(`[SMS no-op] To: ${to} | ${message.substring(0, 80)}`);
    return false;
  }
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    return true;
  } catch (err: any) {
    console.error(`[SMS error] ${err?.message}`);
    return false;
  }
}

export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  if (!hasSendGrid) {
    console.log(`[Email no-op] To: ${to} | Subject: ${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], subject }],
        from: { email: process.env.SENDGRID_FROM_EMAIL ?? "noreply@salonsync.app", name: "SalonSync" },
        content: [{ type: "text/plain", value: body }],
      }),
    });
    return res.status === 202;
  } catch (err: any) {
    console.error(`[Email error] ${err?.message}`);
    return false;
  }
}

// ── Appointment detail type (matches getAppointmentWithDetails output) ────
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
  client?: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; smsEnabled?: boolean | null; emailEnabled?: boolean | null };
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

function staffName(appt: ApptDetails): string {
  return [appt.staff?.firstName, appt.staff?.lastName].filter(Boolean).join(" ") || "Your stylist";
}

function clientName(appt: ApptDetails): string {
  return [appt.client?.firstName, appt.client?.lastName].filter(Boolean).join(" ") || "Client";
}

// ── In-app DB notification ─────────────────────────────────────────────────
async function storeNotification(userId: string, type: string, title: string, message: string) {
  await db.insert(notificationsTable).values({ type, title, message, userId }).catch(() => {});
}

// ── Fetch user prefs ──────────────────────────────────────────────────────
async function getUserPrefs(userId: string) {
  const [u] = await db.select({
    email: usersTable.email,
    phone: usersTable.phone,
    smsEnabled: usersTable.smsEnabled,
    emailEnabled: usersTable.emailEnabled,
  }).from(usersTable).where(eq(usersTable.id, userId));
  return u ?? { email: null, phone: null, smsEnabled: true, emailEnabled: true };
}

// ── High-level notification functions ─────────────────────────────────────

export async function sendAppointmentConfirmation(appt: ApptDetails) {
  const start = new Date(appt.startTime);
  const services = serviceList(appt);
  const staff = staffName(appt);
  const location = appt.location?.name ?? "our salon";

  const clientPrefs = await getUserPrefs(appt.clientId);

  const smsBody = `Hi ${clientName(appt)}! Your appointment at ${location} is confirmed for ${formatTime(start)} with ${staff} (${services}). See you then! — SalonSync`;
  const emailSubject = `Booking Confirmed — ${formatTime(start)}`;
  const emailBody = `Hi ${clientName(appt)},\n\nYour appointment is confirmed!\n\nDetails:\n• Services: ${services}\n• Stylist: ${staff}\n• Location: ${location}\n• Date & Time: ${formatTime(start)}\n• Total: $${appt.totalPrice.toFixed(2)}\n\nNeed to cancel? Please do so at least 24 hours in advance.\n\n— SalonSync`;

  await storeNotification(appt.clientId, "APPOINTMENT_CONFIRMED", "Booking Confirmed!", `Your appointment on ${formatTime(start)} with ${staff} is confirmed.`);

  if (clientPrefs.phone && clientPrefs.smsEnabled !== false) {
    await sendSMS(clientPrefs.phone, smsBody);
  }
  if (clientPrefs.email && clientPrefs.emailEnabled !== false) {
    await sendEmail(clientPrefs.email, emailSubject, emailBody);
  }
}

export async function sendAppointmentReminder(appt: ApptDetails, hoursAhead: 24 | 1) {
  const start = new Date(appt.startTime);
  const services = serviceList(appt);
  const staff = staffName(appt);
  const location = appt.location?.name ?? "our salon";
  const timeLabel = hoursAhead === 24 ? "tomorrow" : "in 1 hour";

  const clientPrefs = await getUserPrefs(appt.clientId);

  const smsBody = `Hi ${clientName(appt)}! Reminder: you have an appointment ${timeLabel} at ${formatTime(start)} with ${staff} at ${location} (${services}). — SalonSync`;
  const emailSubject = `Reminder: Appointment ${timeLabel}`;
  const emailBody = `Hi ${clientName(appt)},\n\nJust a reminder — your appointment is coming up ${timeLabel}.\n\n• Services: ${services}\n• Stylist: ${staff}\n• Location: ${location}\n• Date & Time: ${formatTime(start)}\n\nSee you soon!\n— SalonSync`;

  const notifTitle = hoursAhead === 24 ? "Appointment Tomorrow" : "Appointment in 1 Hour";
  await storeNotification(appt.clientId, "APPOINTMENT_REMINDER", notifTitle, `Your ${services} appointment with ${staff} is ${timeLabel}.`);

  if (clientPrefs.phone && clientPrefs.smsEnabled !== false) {
    await sendSMS(clientPrefs.phone, smsBody);
  }
  if (clientPrefs.email && clientPrefs.emailEnabled !== false) {
    await sendEmail(clientPrefs.email, emailSubject, emailBody);
  }
}

export async function sendCancellationNotice(appt: ApptDetails, feeAmount?: number) {
  const start = new Date(appt.startTime);
  const staff = staffName(appt);
  const clientN = clientName(appt);
  const feeNote = feeAmount && feeAmount > 0 ? ` A cancellation fee of $${feeAmount.toFixed(2)} has been applied.` : "";
  const location = appt.location?.name ?? "our salon";

  const clientPrefs = await getUserPrefs(appt.clientId);
  const staffPrefs = await getUserPrefs(appt.staffId);

  // Notify client
  const clientSms = `Hi ${clientN}, your appointment at ${location} on ${formatTime(start)} has been cancelled.${feeNote} — SalonSync`;
  const clientEmailSubject = "Appointment Cancelled";
  const clientEmailBody = `Hi ${clientN},\n\nYour appointment on ${formatTime(start)} with ${staff} at ${location} has been cancelled.${feeNote}\n\nBook a new appointment any time.\n\n— SalonSync`;

  await storeNotification(appt.clientId, "APPOINTMENT_CANCELLED", "Appointment Cancelled", `Your appointment on ${formatTime(start)} was cancelled.${feeNote}`);

  if (clientPrefs.phone && clientPrefs.smsEnabled !== false) {
    await sendSMS(clientPrefs.phone, clientSms);
  }
  if (clientPrefs.email && clientPrefs.emailEnabled !== false) {
    await sendEmail(clientPrefs.email, clientEmailSubject, clientEmailBody);
  }

  // Notify staff
  const staffSms = `SalonSync: The appointment with ${clientN} on ${formatTime(start)} has been cancelled.`;
  await storeNotification(appt.staffId, "APPOINTMENT_CANCELLED", "Appointment Cancelled", `${clientN}'s appointment on ${formatTime(start)} was cancelled.`);
  if (staffPrefs.phone) await sendSMS(staffPrefs.phone, staffSms);
}

export async function sendNewMessageNotification(recipientId: string, senderName: string) {
  const prefs = await getUserPrefs(recipientId);
  const title = "New Message";
  const msg = `You have a new message from ${senderName} in SalonSync.`;
  await storeNotification(recipientId, "NEW_MESSAGE", title, msg);

  if (prefs.phone && prefs.smsEnabled !== false) {
    await sendSMS(prefs.phone, `SalonSync: ${msg}`);
  }
}

// ── Reminder scheduling helpers ────────────────────────────────────────────
// Called after appointment creation — schedules 24h and 1h reminders in the DB
export async function scheduleReminders(appointmentId: string, startTime: Date) {
  const minus24h = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
  const minus1h  = new Date(startTime.getTime() -      60 * 60 * 1000);
  const now = new Date();

  const toSchedule = [
    { type: "REMINDER_24H", scheduledFor: minus24h, channel: "SMS" },
    { type: "REMINDER_24H", scheduledFor: minus24h, channel: "EMAIL" },
    { type: "REMINDER_1H",  scheduledFor: minus1h,  channel: "SMS" },
    { type: "REMINDER_1H",  scheduledFor: minus1h,  channel: "EMAIL" },
  ].filter(r => r.scheduledFor > now);

  if (toSchedule.length > 0) {
    await db.insert(remindersTable).values(
      toSchedule.map(r => ({ ...r, appointmentId }))
    ).catch(() => {});
  }
}
