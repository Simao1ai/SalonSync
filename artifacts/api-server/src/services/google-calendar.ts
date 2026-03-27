import { google, calendar_v3 } from "googleapis";
import { db } from "@workspace/db";
import { usersTable, availabilityTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(): string | null {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function handleCallback(code: string, userId: string): Promise<boolean> {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return false;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find(c => c.primary) ?? calendarList.data.items?.[0];
    const calendarId = primaryCalendar?.id || "primary";

    await db.update(usersTable).set({
      googleAccessToken: tokens.access_token ?? null,
      googleRefreshToken: tokens.refresh_token ?? null,
      googleCalendarId: calendarId,
    }).where(eq(usersTable.id, userId));

    return true;
  } catch (err: any) {
    console.error(`[GoogleCalendar] Callback error: ${err?.message}`);
    return false;
  }
}

export async function disconnectCalendar(userId: string): Promise<void> {
  await db.update(usersTable).set({
    googleAccessToken: null,
    googleRefreshToken: null,
    googleCalendarId: null,
  }).where(eq(usersTable.id, userId));
}

async function getAuthenticatedCalendar(userId: string): Promise<{ calendar: calendar_v3.Calendar; calendarId: string } | null> {
  const [user] = await db.select({
    googleAccessToken: usersTable.googleAccessToken,
    googleRefreshToken: usersTable.googleRefreshToken,
    googleCalendarId: usersTable.googleCalendarId,
  }).from(usersTable).where(eq(usersTable.id, userId));

  if (!user?.googleAccessToken || !user?.googleRefreshToken) return null;

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;

  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });

  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await db.update(usersTable).set({
        googleAccessToken: tokens.access_token,
      }).where(eq(usersTable.id, userId));
    }
  });

  return {
    calendar: google.calendar({ version: "v3", auth: oauth2Client }),
    calendarId: user.googleCalendarId || "primary",
  };
}

interface AppointmentEvent {
  appointmentId: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  locationName?: string;
  clientName?: string;
}

export async function createCalendarEvent(
  staffUserId: string,
  event: AppointmentEvent
): Promise<string | null> {
  const auth = await getAuthenticatedCalendar(staffUserId);
  if (!auth) return null;

  try {
    const result = await auth.calendar.events.insert({
      calendarId: auth.calendarId,
      requestBody: {
        summary: event.title,
        description: `${event.description}\n\nSalonSync Appointment: ${event.appointmentId}`,
        start: { dateTime: event.startTime.toISOString() },
        end: { dateTime: event.endTime.toISOString() },
        location: event.locationName,
        extendedProperties: {
          private: { salonsyncAppointmentId: event.appointmentId },
        },
      },
    });
    console.log(`[GoogleCalendar] Created event ${result.data.id} for appt ${event.appointmentId}`);
    return result.data.id ?? null;
  } catch (err: any) {
    console.error(`[GoogleCalendar] Create event error: ${err?.message}`);
    return null;
  }
}

export async function updateCalendarEvent(
  staffUserId: string,
  googleEventId: string,
  event: Partial<AppointmentEvent>
): Promise<boolean> {
  const auth = await getAuthenticatedCalendar(staffUserId);
  if (!auth) return false;

  try {
    const update: any = {};
    if (event.title) update.summary = event.title;
    if (event.description) update.description = event.description;
    if (event.startTime) update.start = { dateTime: event.startTime.toISOString() };
    if (event.endTime) update.end = { dateTime: event.endTime.toISOString() };
    if (event.locationName) update.location = event.locationName;

    await auth.calendar.events.patch({
      calendarId: auth.calendarId,
      eventId: googleEventId,
      requestBody: update,
    });
    return true;
  } catch (err: any) {
    console.error(`[GoogleCalendar] Update event error: ${err?.message}`);
    return false;
  }
}

export async function deleteCalendarEvent(
  staffUserId: string,
  googleEventId: string
): Promise<boolean> {
  const auth = await getAuthenticatedCalendar(staffUserId);
  if (!auth) return false;

  try {
    await auth.calendar.events.delete({
      calendarId: auth.calendarId,
      eventId: googleEventId,
    });
    return true;
  } catch (err: any) {
    console.error(`[GoogleCalendar] Delete event error: ${err?.message}`);
    return false;
  }
}

export async function syncGoogleBlocksToAvailability(staffUserId: string): Promise<number> {
  const auth = await getAuthenticatedCalendar(staffUserId);
  if (!auth) return 0;

  try {
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const events = await auth.calendar.events.list({
      calendarId: auth.calendarId,
      timeMin: now.toISOString(),
      timeMax: twoWeeksOut.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    const blockedEvents = (events.data.items ?? []).filter(evt => {
      const isSalonSync = evt.extendedProperties?.private?.salonsyncAppointmentId;
      return !isSalonSync && evt.start?.dateTime && evt.end?.dateTime;
    });

    let synced = 0;
    for (const evt of blockedEvents) {
      if (!evt.start?.dateTime || !evt.end?.dateTime) continue;

      const startDt = new Date(evt.start.dateTime);
      const endDt = new Date(evt.end.dateTime);
      const blockDate = startDt.toISOString().split("T")[0];
      const startTimeStr = startDt.toTimeString().slice(0, 5);
      const endTimeStr = endDt.toTimeString().slice(0, 5);

      const existing = await db.select({ id: availabilityTable.id })
        .from(availabilityTable)
        .where(
          and(
            eq(availabilityTable.userId, staffUserId),
            eq(availabilityTable.blockDate, blockDate),
            eq(availabilityTable.startTime, startTimeStr),
            eq(availabilityTable.endTime, endTimeStr),
          )
        );

      if (existing.length === 0) {
        await db.insert(availabilityTable).values({
          userId: staffUserId,
          dayOfWeek: startDt.getDay(),
          startTime: startTimeStr,
          endTime: endTimeStr,
          blockDate,
          isAvailable: false,
        });
        synced++;
      }
    }

    console.log(`[GoogleCalendar] Synced ${synced} blocks for user ${staffUserId}`);
    return synced;
  } catch (err: any) {
    console.error(`[GoogleCalendar] Sync blocks error: ${err?.message}`);
    return 0;
  }
}

export function isGoogleCalendarConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}
