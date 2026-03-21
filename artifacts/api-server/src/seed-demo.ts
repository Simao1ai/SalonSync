import { db } from "@workspace/db";
import {
  usersTable,
  appointmentsTable,
  appointmentServicesTable,
  reviewsTable,
  giftCardsTable,
  availabilityTable,
  notificationsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const LOCATION_ID = "da62c8fa-580b-44c9-bed8-e19938402d39";

// Services from the original seed
const SERVICES = {
  cut:        { id: "75c4539a-8e51-4770-b932-14f348634236", price: 85,  duration: 60,  isHV: false },
  color:      { id: "ec9498d0-1a1e-456a-bcc4-767311756336", price: 225, duration: 150, isHV: true  },
  balayage:   { id: "8120f16c-df00-47c7-a403-9eba42eda45d", price: 350, duration: 210, isHV: true  },
  condition:  { id: "abf27e3e-c808-4675-8881-ef9a1fde83c2", price: 65,  duration: 45,  isHV: false },
  blowout:    { id: "97082a67-941b-4f22-aada-7f922c5e7eb4", price: 55,  duration: 45,  isHV: false },
  keratin:    { id: "b9ace072-53b0-4c59-9436-2b5c3dc3a433", price: 400, duration: 240, isHV: true  },
};

// Fixed IDs so the dev login can reference them
export const DEMO_IDS = {
  admin:    "seed-admin-001",
  staff1:   "seed-staff-001",
  staff2:   "seed-staff-002",
  staff3:   "seed-staff-003",
  client1:  "seed-client-001",
  client2:  "seed-client-002",
  client3:  "seed-client-003",
  client4:  "seed-client-004",
  client5:  "seed-client-005",
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function setHour(date: Date, h: number, m = 0): Date {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}
function addMins(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60_000);
}

async function upsertUser(values: Parameters<typeof db.insert>[0] extends { values: (v: infer V) => unknown } ? V : never) {
  const v = values as Parameters<typeof usersTable.$inferInsert extends infer R ? (r: R) => void : never>[0];
  await db.insert(usersTable).values(v as any).onConflictDoUpdate({
    target: usersTable.id,
    set: { ...(v as any), updatedAt: new Date() },
  });
}

async function createAppointment(opts: {
  id: string;
  start: Date;
  svc: typeof SERVICES[keyof typeof SERVICES];
  staffId: string;
  clientId: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  paymentStatus?: "UNPAID" | "DEPOSIT_PAID" | "FULLY_PAID" | "REFUNDED";
  notes?: string;
}) {
  const end = addMins(opts.start, opts.svc.duration);
  await db.insert(appointmentsTable).values({
    id: opts.id,
    startTime: opts.start,
    endTime: end,
    status: opts.status,
    notes: opts.notes ?? null,
    isHighValue: opts.svc.isHV,
    riskScore: "LOW",
    totalPrice: opts.svc.price,
    depositAmount: opts.svc.isHV ? opts.svc.price * 0.5 : 0,
    paymentStatus: opts.paymentStatus ?? "UNPAID",
    locationId: LOCATION_ID,
    staffId: opts.staffId,
    clientId: opts.clientId,
  }).onConflictDoNothing();

  await db.insert(appointmentServicesTable).values({
    appointmentId: opts.id,
    serviceId: opts.svc.id,
    price: opts.svc.price,
    durationMinutes: opts.svc.duration,
  }).onConflictDoNothing();
}

async function seed() {
  console.log("Seeding demo users...");

  // ── USERS ──────────────────────────────────────────────────
  await db.insert(usersTable).values([
    {
      id: DEMO_IDS.admin,
      email: "admin@salonsync.com",
      firstName: "Sarah",
      lastName: "Chen",
      role: "ADMIN",
      phone: "(310) 555-0001",
      locationId: LOCATION_ID,
    },
    {
      id: DEMO_IDS.staff1,
      email: "maria@salonsync.com",
      firstName: "Maria",
      lastName: "Rodriguez",
      role: "STAFF",
      phone: "(310) 555-0101",
      locationId: LOCATION_ID,
      bio: "10 years of experience specializing in color and balayage. Master colorist trained in Paris.",
      specialties: ["Color", "Balayage", "Highlights"],
    },
    {
      id: DEMO_IDS.staff2,
      email: "james@salonsync.com",
      firstName: "James",
      lastName: "Kim",
      role: "STAFF",
      phone: "(310) 555-0102",
      locationId: LOCATION_ID,
      bio: "Precision cut specialist and blowout artist. Known for transformative styles.",
      specialties: ["Precision Cut", "Blowout", "Men's Styling"],
    },
    {
      id: DEMO_IDS.staff3,
      email: "aisha@salonsync.com",
      firstName: "Aisha",
      lastName: "Johnson",
      role: "STAFF",
      phone: "(310) 555-0103",
      locationId: LOCATION_ID,
      bio: "Treatment expert and keratin specialist. Passionate about healthy hair transformations.",
      specialties: ["Keratin", "Deep Conditioning", "Scalp Treatments"],
    },
    {
      id: DEMO_IDS.client1,
      email: "emma.williams@email.com",
      firstName: "Emma",
      lastName: "Williams",
      role: "CLIENT",
      phone: "(323) 555-1001",
    },
    {
      id: DEMO_IDS.client2,
      email: "sophia.davis@email.com",
      firstName: "Sophia",
      lastName: "Davis",
      role: "CLIENT",
      phone: "(323) 555-1002",
    },
    {
      id: DEMO_IDS.client3,
      email: "olivia.brown@email.com",
      firstName: "Olivia",
      lastName: "Brown",
      role: "CLIENT",
      phone: "(323) 555-1003",
    },
    {
      id: DEMO_IDS.client4,
      email: "ava.martinez@email.com",
      firstName: "Ava",
      lastName: "Martinez",
      role: "CLIENT",
      phone: "(323) 555-1004",
    },
    {
      id: DEMO_IDS.client5,
      email: "isabella.taylor@email.com",
      firstName: "Isabella",
      lastName: "Taylor",
      role: "CLIENT",
      phone: "(323) 555-1005",
    },
  ]).onConflictDoUpdate({
    target: usersTable.id,
    set: { updatedAt: new Date() },
  });

  console.log("Seeding availability for staff...");

  // ── AVAILABILITY (Mon–Sat, 9am–6pm) ────────────────────────
  const staffIds = [DEMO_IDS.staff1, DEMO_IDS.staff2, DEMO_IDS.staff3];
  for (const staffId of staffIds) {
    // days 1-6 = Monday-Saturday
    for (let day = 1; day <= 6; day++) {
      await db.insert(availabilityTable).values({
        userId: staffId,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "18:00",
        isBlocked: false,
      }).onConflictDoNothing();
    }
  }

  console.log("Seeding appointments...");

  // ── PAST APPOINTMENTS (completed) ──────────────────────────
  await createAppointment({
    id: "appt-001",
    start: setHour(daysAgo(18), 10),
    svc: SERVICES.balayage,
    staffId: DEMO_IDS.staff1,
    clientId: DEMO_IDS.client1,
    status: "COMPLETED",
    paymentStatus: "FULLY_PAID",
    notes: "Client requested extra brightness around face",
  });
  await createAppointment({
    id: "appt-002",
    start: setHour(daysAgo(15), 14),
    svc: SERVICES.cut,
    staffId: DEMO_IDS.staff2,
    clientId: DEMO_IDS.client2,
    status: "COMPLETED",
    paymentStatus: "FULLY_PAID",
  });
  await createAppointment({
    id: "appt-003",
    start: setHour(daysAgo(12), 11),
    svc: SERVICES.keratin,
    staffId: DEMO_IDS.staff3,
    clientId: DEMO_IDS.client3,
    status: "COMPLETED",
    paymentStatus: "FULLY_PAID",
    notes: "Sensitive scalp — use gentle formula",
  });
  await createAppointment({
    id: "appt-004",
    start: setHour(daysAgo(10), 9),
    svc: SERVICES.color,
    staffId: DEMO_IDS.staff1,
    clientId: DEMO_IDS.client4,
    status: "COMPLETED",
    paymentStatus: "FULLY_PAID",
  });
  await createAppointment({
    id: "appt-005",
    start: setHour(daysAgo(8), 15),
    svc: SERVICES.blowout,
    staffId: DEMO_IDS.staff2,
    clientId: DEMO_IDS.client5,
    status: "COMPLETED",
    paymentStatus: "FULLY_PAID",
  });
  await createAppointment({
    id: "appt-006",
    start: setHour(daysAgo(7), 13),
    svc: SERVICES.condition,
    staffId: DEMO_IDS.staff3,
    clientId: DEMO_IDS.client1,
    status: "COMPLETED",
    paymentStatus: "FULLY_PAID",
  });

  // ── CANCELLED ───────────────────────────────────────────────
  await createAppointment({
    id: "appt-007",
    start: setHour(daysAgo(5), 10),
    svc: SERVICES.balayage,
    staffId: DEMO_IDS.staff1,
    clientId: DEMO_IDS.client2,
    status: "CANCELLED",
    paymentStatus: "REFUNDED",
    notes: "Client cancelled 72 hrs in advance",
  });

  // ── NO SHOW ─────────────────────────────────────────────────
  await createAppointment({
    id: "appt-008",
    start: setHour(daysAgo(3), 9),
    svc: SERVICES.color,
    staffId: DEMO_IDS.staff1,
    clientId: DEMO_IDS.client3,
    status: "NO_SHOW",
    paymentStatus: "DEPOSIT_PAID",
  });

  // ── UPCOMING CONFIRMED ──────────────────────────────────────
  await createAppointment({
    id: "appt-009",
    start: setHour(daysFromNow(1), 10),
    svc: SERVICES.balayage,
    staffId: DEMO_IDS.staff1,
    clientId: DEMO_IDS.client1,
    status: "CONFIRMED",
    paymentStatus: "DEPOSIT_PAID",
    notes: "Birthday appointment — wants extra attention",
  });
  await createAppointment({
    id: "appt-010",
    start: setHour(daysFromNow(2), 14),
    svc: SERVICES.cut,
    staffId: DEMO_IDS.staff2,
    clientId: DEMO_IDS.client2,
    status: "CONFIRMED",
    paymentStatus: "UNPAID",
  });
  await createAppointment({
    id: "appt-011",
    start: setHour(daysFromNow(3), 11),
    svc: SERVICES.keratin,
    staffId: DEMO_IDS.staff3,
    clientId: DEMO_IDS.client4,
    status: "CONFIRMED",
    paymentStatus: "DEPOSIT_PAID",
    notes: "First keratin treatment",
  });
  await createAppointment({
    id: "appt-012",
    start: setHour(daysFromNow(4), 9),
    svc: SERVICES.color,
    staffId: DEMO_IDS.staff1,
    clientId: DEMO_IDS.client5,
    status: "CONFIRMED",
    paymentStatus: "DEPOSIT_PAID",
  });
  await createAppointment({
    id: "appt-013",
    start: setHour(daysFromNow(5), 15),
    svc: SERVICES.blowout,
    staffId: DEMO_IDS.staff2,
    clientId: DEMO_IDS.client3,
    status: "PENDING",
    paymentStatus: "UNPAID",
  });
  await createAppointment({
    id: "appt-014",
    start: setHour(daysFromNow(7), 10),
    svc: SERVICES.condition,
    staffId: DEMO_IDS.staff3,
    clientId: DEMO_IDS.client2,
    status: "PENDING",
    paymentStatus: "UNPAID",
  });
  await createAppointment({
    id: "appt-015",
    start: setHour(daysFromNow(10), 13),
    svc: SERVICES.balayage,
    staffId: DEMO_IDS.staff1,
    clientId: DEMO_IDS.client4,
    status: "CONFIRMED",
    paymentStatus: "DEPOSIT_PAID",
  });

  console.log("Seeding reviews...");

  // ── REVIEWS (for completed appointments) ────────────────────
  const reviews = [
    {
      id: "rev-001", appointmentId: "appt-001", clientId: DEMO_IDS.client1,
      staffId: DEMO_IDS.staff1, rating: 5,
      comment: "Maria is absolutely incredible. My balayage turned out exactly how I imagined. The color blending is seamless!",
      sentimentScore: 0.98, sentimentTags: ["impressed", "satisfied", "loyal"],
      isPublished: true,
    },
    {
      id: "rev-002", appointmentId: "appt-002", clientId: DEMO_IDS.client2,
      staffId: DEMO_IDS.staff2, rating: 5,
      comment: "James gave me the best haircut I've had in years. Precision is everything and he nailed it.",
      sentimentScore: 0.95, sentimentTags: ["satisfied", "impressed"],
      isPublished: true,
    },
    {
      id: "rev-003", appointmentId: "appt-003", clientId: DEMO_IDS.client3,
      staffId: DEMO_IDS.staff3, rating: 4,
      comment: "Aisha was so gentle and knowledgeable. My hair feels amazing. Slightly long wait but worth it.",
      sentimentScore: 0.82, sentimentTags: ["satisfied", "mild_concern"],
      isPublished: true,
    },
    {
      id: "rev-004", appointmentId: "appt-004", clientId: DEMO_IDS.client4,
      staffId: DEMO_IDS.staff1, rating: 5,
      comment: "Color came out perfect. Maria really listens and understands what you want.",
      sentimentScore: 0.97, sentimentTags: ["impressed", "satisfied"],
      isPublished: true,
    },
    {
      id: "rev-005", appointmentId: "appt-005", clientId: DEMO_IDS.client5,
      staffId: DEMO_IDS.staff2, rating: 4,
      comment: "Great blowout. James is skilled and fast. Will definitely book again!",
      sentimentScore: 0.88, sentimentTags: ["satisfied", "returning"],
      isPublished: true,
    },
    {
      id: "rev-006", appointmentId: "appt-006", clientId: DEMO_IDS.client1,
      staffId: DEMO_IDS.staff3, rating: 5,
      comment: "The deep conditioning treatment was heavenly. My hair has never felt this soft.",
      sentimentScore: 0.99, sentimentTags: ["delighted", "satisfied"],
      isPublished: true,
    },
  ];

  for (const r of reviews) {
    await db.insert(reviewsTable).values(r).onConflictDoNothing();
  }

  console.log("Seeding gift cards...");

  // ── GIFT CARDS ───────────────────────────────────────────────
  await db.insert(giftCardsTable).values([
    {
      id: "gc-001",
      code: "SALON-GIFT-100",
      initialValue: 100,
      balance: 100,
      status: "ACTIVE",
      purchasedById: DEMO_IDS.client1,
      expiresAt: daysFromNow(365),
    },
    {
      id: "gc-002",
      code: "SALON-GIFT-250",
      initialValue: 250,
      balance: 175,
      status: "ACTIVE",
      purchasedById: DEMO_IDS.client2,
      expiresAt: daysFromNow(180),
    },
    {
      id: "gc-003",
      code: "SALON-LXRY-500",
      initialValue: 500,
      balance: 500,
      status: "ACTIVE",
      purchasedById: DEMO_IDS.client4,
      expiresAt: daysFromNow(365),
    },
    {
      id: "gc-004",
      code: "SALON-USED-050",
      initialValue: 50,
      balance: 0,
      status: "REDEEMED",
      purchasedById: DEMO_IDS.client3,
      expiresAt: daysAgo(30),
    },
  ]).onConflictDoNothing();

  console.log("Seeding notifications...");

  // ── NOTIFICATIONS ────────────────────────────────────────────
  await db.insert(notificationsTable).values([
    {
      userId: DEMO_IDS.client1,
      title: "Appointment Confirmed",
      message: "Your balayage appointment with Maria on tomorrow at 10:00 AM is confirmed.",
      type: "APPOINTMENT_REMINDER",
      isRead: false,
    },
    {
      userId: DEMO_IDS.client2,
      title: "Appointment Reminder",
      message: "Don't forget your cut & style with James in 2 days at 2:00 PM.",
      type: "APPOINTMENT_REMINDER",
      isRead: true,
    },
    {
      userId: DEMO_IDS.client3,
      title: "Booking Request Received",
      message: "Your blowout appointment request is pending confirmation.",
      type: "APPOINTMENT_REMINDER",
      isRead: false,
    },
    {
      userId: DEMO_IDS.staff1,
      title: "New Appointment",
      message: "Emma Williams has booked a balayage for tomorrow at 10:00 AM.",
      type: "APPOINTMENT_REMINDER",
      isRead: false,
    },
    {
      userId: DEMO_IDS.staff2,
      title: "Upcoming Appointment",
      message: "You have 2 appointments scheduled this week.",
      type: "APPOINTMENT_REMINDER",
      isRead: true,
    },
    {
      userId: DEMO_IDS.admin,
      title: "No-Show Alert",
      message: "Olivia Brown did not show up for her color appointment today.",
      type: "CANCELLATION_ALERT",
      isRead: false,
    },
    {
      userId: DEMO_IDS.admin,
      title: "New Review",
      message: "Emma Williams left a 5-star review for Maria Rodriguez.",
      type: "GENERAL",
      isRead: false,
    },
  ]).onConflictDoNothing();

  console.log("✅ Demo seed complete!");
  console.log("   Admin:   seed-admin-001 (Sarah Chen)");
  console.log("   Staff:   seed-staff-001 (Maria), seed-staff-002 (James), seed-staff-003 (Aisha)");
  console.log("   Clients: seed-client-001 to seed-client-005");
  console.log("   Appts:   15 appointments (completed, upcoming, cancelled, no-show)");
  console.log("   Reviews: 6 reviews");
  console.log("   Gift cards: 4 (3 active, 1 redeemed)");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
